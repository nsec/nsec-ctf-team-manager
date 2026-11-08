"""Team service: business logic for creating and joining teams."""

import logging
import unicodedata

import psycopg

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


def create_team(
    name: str, attendee_email: str, order_code: str, ctf_experience: str = "regular"
) -> dict:
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
        with conn.transaction():
            cur = conn.execute(
                "INSERT INTO teams "
                "(name, name_folded, ctf_experience, creator_order_code) "
                "VALUES (%s, %s, %s, %s) RETURNING id",
                (name, _fold(name), ctf_experience, order_code),
            )
            inserted_team = cur.fetchone()
            if inserted_team is None:
                raise RuntimeError("Team insert did not return an id.")
            team_id = inserted_team[0]
            conn.execute(
                "INSERT INTO members "
                "(team_id, username, username_folded, order_code, membership_status) "
                "VALUES (%s, %s, %s, %s, 'approved')",
                (team_id, attendee_email, _fold(attendee_email), order_code),
            )
    except psycopg.IntegrityError as exc:
        if exc.diag.constraint_name == "idx_members_username_folded":
            raise TeamError("This email already belongs to a team.", 409) from exc
        if exc.diag.constraint_name == "teams_name_folded_key":
            raise TeamError("A team with this name already exists.", 409) from exc
        raise
    return {"id": team_id, "name": name, "ctf_experience": ctf_experience}


def join_team(name: str, attendee_email: str, order_code: str) -> dict:
    name = _normalize(name)
    attendee_email = _normalize(attendee_email)
    order_code = order_code.strip()
    if not attendee_email:
        raise TeamError("Attendee email is required.")
    if not order_code:
        raise TeamError("Order code is required.")

    conn = get_connection()
    try:
        with conn.transaction():
            team = conn.execute(
                "SELECT id, name FROM teams WHERE name_folded = %s FOR UPDATE",
                (_fold(name),),
            ).fetchone()
            if team is None:
                raise TeamError("No team found with this name.", 404)
            count_row = conn.execute(
                "SELECT COUNT(*) FROM members WHERE team_id = %s",
                (team[0],),
            ).fetchone()
            if count_row is None:
                raise RuntimeError("Member count query did not return a row.")
            count = count_row[0]
            if count >= settings.max_members_per_team:
                raise TeamError(
                    f"This team is full (max {settings.max_members_per_team} members).",
                    409,
                )
            member = conn.execute(
                "INSERT INTO members "
                "(team_id, username, username_folded, order_code, membership_status) "
                "VALUES (%s, %s, %s, %s, 'pending') RETURNING id",
                (team[0], attendee_email, _fold(attendee_email), order_code),
            ).fetchone()
            if member is None:
                raise RuntimeError("Membership request insert did not return an id.")
    except psycopg.IntegrityError as exc:
        if exc.diag.constraint_name in {
            "idx_members_username_folded",
            "members_team_id_username_folded_key",
        }:
            raise TeamError("This email already belongs to a team.", 409) from exc
        raise
    return {
        "id": team[0],
        "name": team[1],
        "member_id": member[0],
        "attendee_email": attendee_email,
        "status": "pending",
    }


def verify_team_members(name: str, order_code: str) -> dict:
    conn = get_connection()
    team = conn.execute(
        "SELECT id, name, ctf_experience, creator_order_code "
        "FROM teams WHERE name_folded = %s",
        (_fold(name),),
    ).fetchone()
    if team is None:
        raise TeamError("No team found with this name.", 404)
    members = conn.execute(
        "SELECT id, username AS attendee_email, order_code, joined_at, membership_status "
        "FROM members WHERE team_id = %s ORDER BY joined_at",
        (team[0],),
    ).fetchall()
    if not any(
        member[2].casefold() == order_code.strip().casefold()
        and member[4] == "approved"
        for member in members
    ):
        raise TeamError("Order code does not match an approved member of this team.", 403)
    approved_members = [member for member in members if member[4] == "approved"]
    pending_members = [member for member in members if member[4] == "pending"]
    return {
        "id": team[0],
        "name": team[1],
        "ctf_experience": team[2],
        "is_creator": team[3].casefold() == order_code.strip().casefold(),
        "members": [
            {
                "id": member[0],
                "attendee_email": member[1],
                "joined_at": member[3],
                "is_creator": member[2].casefold() == team[3].casefold(),
                "is_current_user": member[2].casefold() == order_code.strip().casefold(),
            }
            for member in approved_members
        ],
        "pending_members": [
            {
                "id": member[0],
                "attendee_email": member[1],
                "joined_at": member[3],
                "is_creator": False,
                "is_current_user": member[2].casefold() == order_code.strip().casefold(),
            }
            for member in pending_members
        ],
        "max_members": settings.max_members_per_team,
    }


def _require_approved_member(conn, team_id: int, order_code: str) -> None:
    member = conn.execute(
        "SELECT 1 FROM members "
        "WHERE team_id = %s AND membership_status = 'approved' "
        "AND lower(order_code) = lower(%s) LIMIT 1",
        (team_id, order_code.strip()),
    ).fetchone()
    if member is None:
        raise TeamError(
            "Order code does not match an approved member of this team.", 403
        )


def approve_member(team_id: int, member_id: int, order_code: str) -> None:
    conn = get_connection()
    with conn.transaction():
        team = conn.execute(
            "SELECT id FROM teams WHERE id = %s FOR UPDATE", (team_id,)
        ).fetchone()
        if team is None:
            raise TeamError("No team found with this name.", 404)
        _require_approved_member(conn, team_id, order_code)
        member = conn.execute(
            "SELECT membership_status FROM members "
            "WHERE id = %s AND team_id = %s FOR UPDATE",
            (member_id, team_id),
        ).fetchone()
        if member is None or member[0] != "pending":
            raise TeamError("No pending membership request found.", 404)
        conn.execute(
            "UPDATE members SET membership_status = 'approved' "
            "WHERE id = %s AND team_id = %s",
            (member_id, team_id),
        )


def reject_member(team_id: int, member_id: int, order_code: str) -> None:
    conn = get_connection()
    with conn.transaction():
        team = conn.execute(
            "SELECT id FROM teams WHERE id = %s FOR UPDATE", (team_id,)
        ).fetchone()
        if team is None:
            raise TeamError("No team found with this name.", 404)
        _require_approved_member(conn, team_id, order_code)
        member = conn.execute(
            "SELECT membership_status FROM members "
            "WHERE id = %s AND team_id = %s FOR UPDATE",
            (member_id, team_id),
        ).fetchone()
        if member is None or member[0] != "pending":
            raise TeamError("No pending membership request found.", 404)
        conn.execute("DELETE FROM members WHERE id = %s", (member_id,))


def remove_member(team_id: int, attendee_email: str, order_code: str) -> None:
    """Let the creator remove an approved member or a member leave their team."""
    conn = get_connection()
    with conn.transaction():
        team = conn.execute(
            "SELECT creator_order_code FROM teams WHERE id = %s FOR UPDATE",
            (team_id,),
        ).fetchone()
        if team is None:
            raise TeamError("No team found with this name.", 404)

        member = conn.execute(
            "SELECT id, username_folded, order_code, membership_status FROM members "
            "WHERE username_folded = %s AND team_id = %s FOR UPDATE",
            (_fold(attendee_email), team_id),
        ).fetchone()
        if member is None or member[3] != "approved":
            raise TeamError("No approved team member found.", 404)

        creator_is_target = member[2].casefold() == team[0].casefold()
        if creator_is_target:
            raise TeamError(
                "The team creator cannot leave or be removed. Delete the team instead.",
                403,
            )

        caller_is_creator = team[0].casefold() == order_code.strip().casefold()
        is_self_removal = member[2].casefold() == order_code.strip().casefold()
        if not caller_is_creator and not is_self_removal:
            raise TeamError("You can only leave your own team.", 403)

        conn.execute(
            "DELETE FROM members WHERE username_folded = %s AND team_id = %s",
            (member[1], team_id),
        )


def delete_team(team_id: int, order_code: str) -> None:
    conn = get_connection()
    with conn.transaction():
        team = conn.execute(
            "SELECT creator_order_code FROM teams WHERE id = %s FOR UPDATE",
            (team_id,),
        ).fetchone()
        if team is None:
            raise TeamError("No team found with this name.", 404)
        if team[0].casefold() != order_code.strip().casefold():
            raise TeamError("Only the team creator can delete this team.", 403)
        conn.execute("DELETE FROM teams WHERE id = %s", (team_id,))


def update_team_experience(
    team_id: int, order_code: str, ctf_experience: str
) -> None:
    conn = get_connection()
    with conn.transaction():
        team = conn.execute(
            "SELECT creator_order_code FROM teams WHERE id = %s FOR UPDATE",
            (team_id,),
        ).fetchone()
        if team is None:
            raise TeamError("No team found with this name.", 404)
        if team[0].casefold() != order_code.strip().casefold():
            raise TeamError("Only the team creator can change this setting.", 403)
        conn.execute(
            "UPDATE teams SET ctf_experience = %s WHERE id = %s",
            (ctf_experience, team_id),
        )


def list_teams() -> list[dict]:
    conn = get_connection()
    rows = conn.execute(
        "SELECT id, name, ctf_experience FROM teams ORDER BY name"
    ).fetchall()
    return [
        {"id": row[0], "name": row[1], "ctf_experience": row[2]}
        for row in rows
    ]
