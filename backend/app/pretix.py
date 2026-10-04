"""Pretix order and attendee lookup."""

import json
import logging
import threading
import time
from collections.abc import Iterator
from typing import Any
from urllib.parse import quote, urlencode, urljoin, urlsplit

import httpx

from .config import settings

_REQUEST_TIMEOUT_SECONDS = 10
_RESPONSE_CACHE_TTL_SECONDS = 60
_RESPONSE_CACHE_MAX_ENTRIES = 256
_monotonic = time.monotonic
_response_cache: dict[tuple[str, str], tuple[float, dict | list]] = {}
_response_cache_lock = threading.Lock()
logger = logging.getLogger(__name__)


class PretixUnavailableError(Exception):
    """Raised when Pretix cannot be used to validate a ticket."""


def _get_json(url: str) -> dict | list:
    api_key = settings.pretix_api_key
    cache_key = (url, api_key)
    now = _monotonic()
    with _response_cache_lock:
        cached = _response_cache.get(cache_key)
        if cached is not None:
            expires_at, payload = cached
            if expires_at > now:
                return payload
            del _response_cache[cache_key]

    logger.info("Sending GET request to Pretix endpoint %s", urlsplit(url).path)
    response = httpx.get(
        url,
        headers={
            "Accept": "application/json",
            "Authorization": f"Token {api_key}",
        },
        timeout=_REQUEST_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    payload = response.json()
    if not isinstance(payload, (dict, list)):
        raise PretixUnavailableError("Pretix returned an invalid response.")

    with _response_cache_lock:
        expired_keys = [
            key for key, (expires_at, _) in _response_cache.items()
            if expires_at <= now
        ]
        for key in expired_keys:
            del _response_cache[key]
        if len(_response_cache) >= _RESPONSE_CACHE_MAX_ENTRIES:
            oldest_key = min(
                _response_cache,
                key=lambda key: _response_cache[key][0],
            )
            del _response_cache[oldest_key]
        _response_cache[cache_key] = (
            _monotonic() + _RESPONSE_CACHE_TTL_SECONDS,
            payload,
        )
    return payload


def _iter_results(path: str) -> Iterator[dict[str, Any]]:
    base_url = f"{settings.pretix_url}/"
    url = urljoin(base_url, path)
    base_origin = urlsplit(base_url)[:2]

    while url:
        payload = _get_json(url)
        if isinstance(payload, list):
            results = payload
            next_url = None
        else:
            results = payload.get("results")
            next_url = payload.get("next")
            if not isinstance(results, list):
                raise PretixUnavailableError("Pretix returned an invalid response.")

        if any(not isinstance(result, dict) for result in results):
            raise PretixUnavailableError("Pretix returned an invalid response.")
        yield from results
        if next_url is not None:
            if not isinstance(next_url, str):
                raise PretixUnavailableError("Pretix returned an invalid page URL.")
            if not next_url:
                url = None
                continue
            next_url = urljoin(url, next_url)
            if urlsplit(next_url)[:2] != base_origin:
                raise PretixUnavailableError("Pretix returned an invalid page URL.")
        url = next_url


def _ctf_events() -> list[tuple[str, str]]:
    configured_event = settings.pretix_ctf_name.strip().strip("/")
    if "/" in configured_event:
        organizer_slug, separator, event_slug = configured_event.partition("/")
        if not organizer_slug or not separator or not event_slug or "/" in event_slug:
            raise PretixUnavailableError(
                "PRETIX_CTF_NAME must be an event name or an organizer/event slug."
            )
        return [(organizer_slug, event_slug)]

    if not configured_event:
        raise PretixUnavailableError("Pretix ticket validation is not configured.")

    ctf_name = configured_event.casefold()
    matches = []
    for organizer in _iter_results("organizers/"):
        organizer_slug = organizer.get("slug")
        if not isinstance(organizer_slug, str):
            continue
        events_path = f"organizers/{quote(organizer_slug, safe='')}/events/"
        for event in _iter_results(events_path):
            event_name = event.get("name")
            event_slug = event.get("slug")
            if (
                isinstance(event_name, str)
                and ctf_name in event_name.casefold()
                and isinstance(event_slug, str)
            ):
                matches.append((organizer_slug, event_slug))

    if not matches:
        raise PretixUnavailableError(
            f"The configured CTF event ({configured_event}) was not found in Pretix."
        )
    return matches


def get_order_attendees(order_code: str) -> list[str]:
    """Return attendee emails for an order in the configured CTF event."""
    if not settings.pretix_api_key:
        raise PretixUnavailableError("Pretix ticket validation is not configured.")

    try:
        attendees = {}
        order_filter = urlencode({"order": order_code.strip()})
        for organizer_slug, event_slug in _ctf_events():
            event_path = (
                f"organizers/{quote(organizer_slug, safe='')}/"
                f"events/{quote(event_slug, safe='')}/"
            )
            positions_path = f"{event_path}orderpositions/?{order_filter}"
            for position in _iter_results(positions_path):
                email = position.get("attendee_email")
                if isinstance(email, str) and email.strip():
                    email = email.strip()
                    attendees.setdefault(email.casefold(), email)
        return sorted(attendees.values(), key=str.casefold)
    except (
        httpx.HTTPError,
        TimeoutError,
        OSError,
        json.JSONDecodeError,
    ) as exc:
        raise PretixUnavailableError("Pretix ticket validation is temporarily unavailable.") from exc


def is_valid_order_attendee(order_code: str, attendee_email: str) -> bool:
    """Check the selected attendee email belongs to the given order."""
    return attendee_email.strip().casefold() in {
        email.casefold() for email in get_order_attendees(order_code)
    }
