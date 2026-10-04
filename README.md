# NSEC Team Manager

Simple CTF team management: FastAPI backend (uv) + SQLite, vanilla JS frontend.

## Structure

```
backend/          FastAPI app (uv-managed)
  app/
    main.py       Routes + static frontend serving
    service.py    Team business logic
    db.py         SQLite (sqlite3, WAL, autocommit)
    config.py     Env-driven settings
    models.py     Pydantic payloads
  tests/          pytest suite (TestClient)
frontend/         Vanilla HTML/CSS/JS (no framework)
  js/api.js       fetch() client for the API
  js/config.js    Frontend config (limits overridden by GET /api/config)
  tests/          XSS regression tests (node tests/xss.test.js)
```

## Run

```bash
cd backend
uv sync
uv run uvicorn app.main:app --port 8000
```

Open http://localhost:8000 — the backend serves the frontend at `/` and the
API under `/api/*` (same origin, no CORS needed).

## API

| Method | Path                | Description                                  |
| ------ | ------------------- | -------------------------------------------- |
| GET    | `/api/health`       | Health check                                 |
| GET    | `/api/config`       | Server limits (max members, name lengths)    |
| GET    | `/api/orders/{order_code}/attendees` | Attendee emails for a Pretix order |
| GET    | `/api/teams`        | List teams                                   |
| POST   | `/api/teams/verify` | Request `{name, order_code}`; returns members only when the order code matches |
| POST   | `/api/teams`        | Create team `{name, order_code, attendee_email}` |
| POST   | `/api/teams/join`   | Join team `{name, order_code, attendee_email}` |

Errors return `{"detail": "..."}` with 400/404/409.

## Configuration

Backend (env vars): `TEAM_MANAGER_DB` (default `team_manager.db`),
`TEAM_MANAGER_LOG_FILE` (default `team_manager.log`; rotates at 5 MB and keeps
three backups),
`TEAM_MANAGER_MAX_MEMBERS` (5), `TEAM_MANAGER_MIN_NAME` (3),
`TEAM_MANAGER_MAX_NAME` (32), `TEAM_MANAGER_CORS_ORIGINS`.
Copy `backend/.env.example` to `backend/.env` to configure these values. The
backend loads that file on startup regardless of the current working directory;
variables already set in the process environment take precedence.
Team creation and joining require a valid Pretix order code and attendee email.
Configure `PRETIX_API_KEY`, `PRETIX_URL`, and `PRETIX_CTF_NAME` in the backend
environment. Set `PRETIX_CTF_NAME` to the event title to discover it by name,
or to `organizer-slug/event-slug` to address one event directly (for example,
`northsec/2027`).

Frontend: `frontend/js/config.js` (`apiBase` for cross-origin setups).
