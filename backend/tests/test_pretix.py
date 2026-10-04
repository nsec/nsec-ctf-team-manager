"""Pretix ticket lookup tests with mocked API responses."""

import logging
import httpx
from urllib.parse import parse_qs, urlsplit

import pytest

from app import pretix


@pytest.fixture
def configured_pretix(monkeypatch):
    monkeypatch.setattr(pretix.settings, "pretix_api_key", "test-key")
    monkeypatch.setattr(pretix.settings, "pretix_url", "https://tickets.example/api/v1")
    monkeypatch.setattr(pretix.settings, "pretix_ctf_name", "NorthSec CTF 2027")


def install_responses(monkeypatch, ticket_found):
    requests = []

    def fake_get(url, *, headers, timeout):
        request = httpx.Request("GET", url, headers=headers)
        requests.append(request)
        path = urlsplit(str(url)).path.removeprefix("/api/v1/")
        query = parse_qs(urlsplit(str(url)).query)
        if path == "organizers/":
            payload = {"results": [{"slug": "northsec"}], "next": None}
        elif path == "organizers/northsec/events/":
            payload = {
                "results": [
                    {"slug": "conf", "name": "NorthSec Conference"},
                    {"slug": "ctf", "name": "NorthSec CTF 2027"},
                ],
                "next": None,
            }
        elif path == "organizers/northsec/events/ctf/checkinlists/":
            payload = {"results": [{"id": 2}], "next": None}
        elif path == "organizers/northsec/events/2027/checkinlists/":
            payload = {"results": [{"id": 2}], "next": None}
        elif path in (
            "organizers/northsec/events/ctf/orderpositions/",
            "organizers/northsec/events/2027/orderpositions/",
        ):
            payload = {
                "results": (
                    [{"attendee_email": "attendee@example.com"}]
                    if ticket_found and query.get("order") == ["QHB8A"]
                    else []
                ),
                "next": None,
            }
        else:
            raise AssertionError(f"Unexpected Pretix request: {url}")
        return httpx.Response(200, json=payload, request=request)

    monkeypatch.setattr(pretix.httpx, "get", fake_get)
    return requests


def test_order_attendees_are_found_only_for_configured_ctf_event(
    monkeypatch, configured_pretix, caplog
):
    caplog.set_level(logging.INFO, logger=pretix.__name__)
    requests = install_responses(monkeypatch, ticket_found=True)

    assert pretix.get_order_attendees("QHB8A") == ["attendee@example.com"]
    assert len(requests) == 3
    position_request = requests[-1]
    assert parse_qs(urlsplit(str(position_request.url)).query) == {"order": ["QHB8A"]}
    assert position_request.headers["Authorization"] == "Token test-key"
    assert caplog.text.count("Sending GET request to Pretix endpoint") == 3
    assert "QHB8A" not in caplog.text


def test_configured_event_path_gets_attendees_without_listing_organizers(
    monkeypatch, configured_pretix
):
    monkeypatch.setattr(pretix.settings, "pretix_ctf_name", "northsec/2027")
    requests = install_responses(monkeypatch, ticket_found=True)

    assert pretix.get_order_attendees("QHB8A") == ["attendee@example.com"]
    assert len(requests) == 1
    assert str(requests[0].url).endswith(
        "/organizers/northsec/events/2027/orderpositions/?order=QHB8A"
    )


def test_unknown_order_has_no_attendees(monkeypatch, configured_pretix):
    install_responses(monkeypatch, ticket_found=False)

    assert pretix.get_order_attendees("QHB8A") == []


def test_attendee_email_must_belong_to_order(monkeypatch, configured_pretix):
    install_responses(monkeypatch, ticket_found=True)

    assert pretix.is_valid_order_attendee("QHB8A", "ATTENDEE@example.com")
    assert not pretix.is_valid_order_attendee("QHB8A", "someone-else@example.com")


def test_no_matching_ctf_event_is_an_api_configuration_error(
    monkeypatch, configured_pretix
):
    requests = install_responses(monkeypatch, ticket_found=False)
    monkeypatch.setattr(
        pretix.settings, "pretix_ctf_name", "Event not configured"
    )

    with pytest.raises(pretix.PretixUnavailableError):
        pretix.get_order_attendees("QHB8A")
    assert len(requests) == 2
