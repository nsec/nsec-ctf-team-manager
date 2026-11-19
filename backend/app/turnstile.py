"""Server-side Cloudflare Turnstile token verification."""

import httpx
from fastapi import HTTPException

from .config import settings

SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
MAX_TOKEN_LENGTH = 2048


async def require_valid_turnstile_token(
    token: str | None, expected_action: str
) -> None:
    """Reject the request unless Cloudflare validates its one-time token."""
    if not token or len(token) > MAX_TOKEN_LENGTH:
        raise HTTPException(status_code=403, detail="Turnstile verification failed.")

    if (
        not settings.cloudflare_site_key
        or not settings.cloudflare_secret_key
        or not settings.turnstile_hostnames
    ):
        raise HTTPException(
            status_code=503,
            detail="Request verification is temporarily unavailable. Please try again or contact NorthSec. (bad settings)",
        )

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                SITEVERIFY_URL,
                data={
                    "secret": settings.cloudflare_secret_key,
                    "response": token,
                },
            )
            response.raise_for_status()
            result = response.json()
    except (httpx.HTTPError, ValueError) as e:
        print(f"Turnstile verification failed: {expected_action} {e}")
        raise HTTPException(
            status_code=503,
            detail="Request verification is temporarily unavailable. Please try again or contact NorthSec. (error while contacting Turnstile Siteverify)",
        ) from None

    if not isinstance(result, dict):
        raise HTTPException(
            status_code=503,
            detail="Request verification is temporarily unavailable. Please try again or contact NorthSec. (result is not a dict)",
        )

    hostname = result.get("hostname")
    if (
        result.get("success") is not True
        or result.get("action") != expected_action
        or not isinstance(hostname, str)
        or hostname.lower().rstrip(".") not in settings.turnstile_hostnames
    ):
        raise HTTPException(status_code=403, detail="Turnstile verification failed.")