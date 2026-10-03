"""Team service: business logic for creating and joining teams."""

import sqlite3
import unicodedata

from .config import settings
from .db import get_connection


class TeamError(Exception):
    """Domain error with a user-facing message and HTTP status."""

    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


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


def create_team(name: str) -> dict:
    name = _normalize(name)
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
        cur = conn.execute(
            "INSERT INTO teams (name, name_folded) VALUES (?, ?)",
            (name, _fold(name)),
        )
        team_id = cur.lastrowid
    except sqlite3.IntegrityError:
        conn.rollback()
        raise TeamError("A team with this name already exists.", 409)
    return {"id": team_id, "name": name}


def join_team(name: str, username: str) -> dict:
    name = _normalize(name)
    username = _normalize(username)
    if not username:
        raise TeamError("Username is required.")

    conn = get_connection()
    team = conn.execute(
        "SELECT id, name FROM teams WHERE name_folded = ?", (_fold(name),)
    ).fetchone()
    if team is None:
        raise TeamError("No team found with this name.", 404)

    count = conn.execute(
        "SELECT COUNT(*) FROM members WHERE team_id = ?", (team["id"],)
    ).fetchone()[0]
    if count >= settings.max_members_per_team:
        raise TeamError(
            f"This team is full (max {settings.max_members_per_team} members).", 409
        )

    try:
        conn.execute(
            "INSERT INTO members (team_id, username, username_folded) VALUES (?, ?, ?)",
            (team["id"], username, _fold(username)),
        )
    except sqlite3.IntegrityError:
        conn.rollback()
        raise TeamError("You are already a member of this team.", 409)
    return {"id": team["id"], "name": team["name"], "username": username}


def get_team(name: str) -> dict | None:
    conn = get_connection()
    team = conn.execute(
        "SELECT id, name FROM teams WHERE name_folded = ?", (_fold(name),)
    ).fetchone()
    if team is None:
        return None
    members = conn.execute(
        "SELECT username, joined_at FROM members WHERE team_id = ? ORDER BY joined_at",
        (team["id"],),
    ).fetchall()
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
