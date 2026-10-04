"""Team service: business logic for creating and joining teams."""

import logging
import sqlite3
import unicodedata

from .config import settings
from .db import get_connection
from .pretix import (
    PretixUnavailableError,
    get_order_attendees as pretix_order_attendees,
    is_valid_order_attendee,
)

logger = logging.getLogger(__name__)


class TeamError(Exception):
    """Domain error with a user-facing message and HTTP status."""

    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def get_order_attendees(order_code: str) -> list[str]:
    try:
        return pretix_order_attendees(order_code.strip())
    except PretixUnavailableError as exc:
        logger.exception("Pretix attendee lookup failed.")
        raise TeamError(
            "Order lookup is temporarily unavailable. Please try again.", 503
        ) from exc


def require_valid_order_attendee(order_code: str, attendee_email: str) -> None:
    try:
        valid = is_valid_order_attendee(order_code.strip(), attendee_email.strip())
    except PretixUnavailableError as exc:
        logger.exception("Pretix attendee validation failed.")
        raise TeamError(
            "Order validation is temporarily unavailable. Please try again.", 503
        ) from exc
    if not valid:
        raise TeamError("Invalid order code or attendee email.")


def _normalize(name: str) -> str:
    return name.strip()


def _fold(text: str) -> str:
    """Canonical form for case- AND accent-insensitive comparisons.

    1. NFKD-decompose so accented characters split into base + combining mark
       (é -> e + U+0301), then drop the combining marks (accents).
    2. casefold() for Unicode-aware case folding (stronger than lower():
       'ß' -> 'ss').

    Result: 'Équipe' == 'équipe' == 'equipe' == 'EQUIPE'.
    """
    decomposed = unicodedata.normalize("NFKD", text.strip())
    without_accents = "".join(
        ch for ch in decomposed if not unicodedata.combining(ch)
    )
    return without_accents.casefold()


def create_team(name: str, attendee_email: str, order_code: str) -> dict:
    name = _normalize(name)
    attendee_email = _normalize(attendee_email)
    order_code = order_code.strip()
    if len(name) < settings.min_team_name_length:
        raise TeamError(
            f"Team name must be at least {settings.min_team_name_length} characters."
        )
    if len(name) > settings.max_team_name_length:
        raise TeamError(
            f"Team name must be at most {settings.max_team_name_length} characters."
        )

    conn = get_connection()
    try:
        conn.execute("BEGIN IMMEDIATE")
        cur = conn.execute(
            "INSERT INTO teams (name, name_folded) VALUES (?, ?)",
            (name, _fold(name)),
        )
        team_id = cur.lastrowid
        conn.execute(
            "INSERT INTO members "
            "(team_id, username, username_folded, order_code) "
            "VALUES (?, ?, ?, ?)",
            (team_id, attendee_email, _fold(attendee_email), order_code),
        )
        conn.commit()
    except sqlite3.IntegrityError as exc:
        conn.rollback()
        if "members.username_folded" in str(exc):
            raise TeamError("This email already belongs to a team.", 409) from exc
        raise TeamError("A team with this name already exists.", 409)
    return {"id": team_id, "name": name}


def join_team(name: str, attendee_email: str, order_code: str) -> dict:
    name = _normalize(name)
    attendee_email = _normalize(attendee_email)
    order_code = order_code.strip()
    if not attendee_email:
        raise TeamError("Attendee email is required.")
    if not order_code:
        raise TeamError("Order code is required.")

    conn = get_connection()
    team = conn.execute(
        "SELECT id, name FROM teams WHERE name_folded = ?", (_fold(name),)
    ).fetchone()
    if team is None:
        raise TeamError("No team found with this name.", 404)

    try:
        conn.execute("BEGIN IMMEDIATE")
        count = conn.execute(
            "SELECT COUNT(*) FROM members WHERE team_id = ?", (team["id"],)
        ).fetchone()[0]
        if count >= settings.max_members_per_team:
            conn.rollback()
            raise TeamError(
                f"This team is full (max {settings.max_members_per_team} members).",
                409,
            )
        conn.execute(
            "INSERT INTO members "
            "(team_id, username, username_folded, order_code) "
            "VALUES (?, ?, ?, ?)",
            (team["id"], attendee_email, _fold(attendee_email), order_code),
        )
        conn.commit()
    except sqlite3.IntegrityError as exc:
        conn.rollback()
        raise TeamError("This email already belongs to a team.", 409) from exc
    except TeamError:
        raise
    return {
        "id": team["id"],
        "name": team["name"],
        "attendee_email": attendee_email,
        "order_code": order_code,
    }


def verify_team_members(name: str, order_code: str) -> dict:
    conn = get_connection()
    team = conn.execute(
        "SELECT id, name FROM teams WHERE name_folded = ?", (_fold(name),)
    ).fetchone()
    if team is None:
        raise TeamError("No team found with this name.", 404)
    members = conn.execute(
        "SELECT username AS attendee_email, order_code, joined_at FROM members "
        "WHERE team_id = ? ORDER BY joined_at",
        (team["id"],),
    ).fetchall()
    if not any(
        member["order_code"].casefold() == order_code.strip().casefold()
        for member in members
    ):
        raise TeamError("Order code does not match a member of this team.", 403)
    return {
        "id": team["id"],
        "name": team["name"],
        "members": [dict(m) for m in members],
        "max_members": settings.max_members_per_team,
    }


def list_teams() -> list[dict]:
    conn = get_connection()
    rows = conn.execute("SELECT id, name FROM teams ORDER BY name").fetchall()
    return [dict(r) for r in rows]
