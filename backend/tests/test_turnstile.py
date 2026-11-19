"""Cloudflare Turnstile verification tests."""

import asyncio

import httpx
import pytest
from fastapi import HTTPException

from app import turnstile


class FakeAsyncClient:
    result = {"success": True, "action": "attendee_lookup", "hostname": "team-manager.nsec.io"}
    status_code = 200
    requests = []

    def __init__(self, *_, **__):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_):
        return None

    async def post(self, url, data):
        self.requests.append((url, data))
        return httpx.Response(self.status_code, json=self.result, request=httpx.Request("POST", url))


@pytest.fixture(autouse=True)
def configure_turnstile(monkeypatch):
    FakeAsyncClient.result = {
        "success": True,
        "action": "attendee_lookup",
        "hostname": "team-manager.nsec.io",
    }
    FakeAsyncClient.status_code = 200
    FakeAsyncClient.requests = []
    monkeypatch.setattr(turnstile.httpx, "AsyncClient", FakeAsyncClient)
    monkeypatch.setattr(turnstile.settings, "cloudflare_site_key", "test-site-key")
    monkeypatch.setattr(turnstile.settings, "cloudflare_secret_key", "test-secret")
    monkeypatch.setattr(turnstile.settings, "turnstile_hostnames", {"team-manager.nsec.io"})


def test_siteverify_validates_token_action_hostname_and_secret():
    asyncio.run(turnstile.require_valid_turnstile_token("one-time-token", "attendee_lookup"))

    url, data = FakeAsyncClient.requests[0]
    assert url == turnstile.SITEVERIFY_URL
    assert data == {"secret": "test-secret", "response": "one-time-token"}


@pytest.mark.parametrize(
    "result",
    [
        {"success": False, "action": "attendee_lookup", "hostname": "team-manager.nsec.io"},
        {"success": True, "action": "join_team", "hostname": "team-manager.nsec.io"},
        {"success": True, "action": "attendee_lookup", "hostname": "attacker.example"},
    ],
)
def test_siteverify_rejects_failure_wrong_action_or_hostname(result):
    FakeAsyncClient.result = result

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(turnstile.require_valid_turnstile_token("one-time-token", "attendee_lookup"))

    assert exc_info.value.status_code == 403


def test_siteverify_rejects_missing_and_oversized_tokens_without_network():
    for token in (None, "", "x" * (turnstile.MAX_TOKEN_LENGTH + 1)):
        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(turnstile.require_valid_turnstile_token(token, "attendee_lookup"))
        assert exc_info.value.status_code == 403
    assert FakeAsyncClient.requests == []


def test_siteverify_fails_closed_when_secret_missing(monkeypatch):
    monkeypatch.setattr(turnstile.settings, "cloudflare_secret_key", "")

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(turnstile.require_valid_turnstile_token("one-time-token", "attendee_lookup"))

    assert exc_info.value.status_code == 503
    assert FakeAsyncClient.requests == []