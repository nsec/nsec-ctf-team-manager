"""Database layer: SQLite via sqlite3, no ORM needed for this scope."""

import sqlite3
import threading
from pathlib import Path

from .config import settings

_local = threading.local()


def get_connection() -> sqlite3.Connection:
    """Return a per-thread connection with foreign keys and row access by name."""
    conn = getattr(_local, "conn", None)
    if conn is None:
        Path(settings.db_path).parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(
            settings.db_path,
            check_same_thread=False,
            # Autocommit: statements commit immediately, so a failed INSERT
            # (e.g. UNIQUE violation) never leaves a write lock behind.
            isolation_level=None,
        )
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute("PRAGMA journal_mode = WAL")
        _local.conn = conn
    return conn


def init_db() -> None:
    conn = get_connection()
    # Schema v2: name_folded/username_folded store str.casefold() values so
    # uniqueness is Unicode-aware (SQLite NOCASE only folds ASCII, so
    # "Équipe" vs "équipe" would otherwise both be allowed).
    # Tiny migration: rebuild tables if the old schema is detected.
    cols = [r[1] for r in conn.execute("PRAGMA table_info(teams)").fetchall()]
    if cols and "name_folded" not in cols:
        conn.executescript("DROP TABLE IF EXISTS members; DROP TABLE IF EXISTS teams;")
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS teams (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            name_folded TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
            username TEXT NOT NULL,
            username_folded TEXT NOT NULL,
            order_code TEXT NOT NULL DEFAULT '',
            joined_at TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE (team_id, username_folded)
        );

        CREATE INDEX IF NOT EXISTS idx_members_team ON members(team_id);
        CREATE INDEX IF NOT EXISTS idx_teams_name_folded ON teams(name_folded);
        """
    )
    member_cols = [
        row[1] for row in conn.execute("PRAGMA table_info(members)").fetchall()
    ]
    if "order_code" not in member_cols:
        conn.execute(
            "ALTER TABLE members ADD COLUMN order_code TEXT NOT NULL DEFAULT ''"
        )


def reset_db() -> None:
    """Drop and recreate all tables (used by tests)."""
    conn = get_connection()
    conn.executescript("DROP TABLE IF EXISTS members; DROP TABLE IF EXISTS teams;")
    init_db()
