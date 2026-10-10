# NSEC Team Manager

Simple CTF team management: FastAPI backend (uv) + PostgreSQL, vanilla JS frontend.

## Structure

```
backend/          FastAPI app (uv-managed)
  app/
    main.py       Routes + static frontend serving
    service.py    Team business logic
    db.py         PostgreSQL (psycopg)
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

## Run with Docker Compose

Create a `.env` file in the repository root. You can start from
`backend/.env.example`; replace the example database password before deploying:

```dotenv
PRETIX_API_KEY=your-pretix-api-key
# PostgreSQL credentials (the same user/database are initialized by Compose).
TEAM_MANAGER_DB_NAME=team_manager
TEAM_MANAGER_DB_USER=team_manager
TEAM_MANAGER_DB_PASSWORD=replace-with-a-strong-password
# Optional destination override; the default host is the Compose service "postgres".
# TEAM_MANAGER_DB_HOST=postgres
# TEAM_MANAGER_DB_PORT=5432
# Optional overrides:
# PRETIX_URL=https://registrations.nsec.io/api/v1
# PRETIX_CTF_NAME=nsec/2027
# TEAM_MANAGER_MAX_MEMBERS=8
# TEAM_MANAGER_MIN_NAME=1
# TEAM_MANAGER_MAX_NAME=128
# TEAM_MANAGER_CORS_ORIGINS=https://team-manager.nsec.io
```

`docker compose up`

## API

| Method | Path                | Description                                  |
| ------ | ------------------- | -------------------------------------------- |
| GET    | `/api/health`       | Health check                                 |
| GET    | `/api/config`       | Server limits (max members, name lengths)    |
| GET    | `/api/orders/{order_code}/attendees` | Attendee emails for a Pretix order |
| GET    | `/api/teams`        | List teams                                   |
| POST   | `/api/teams/verify` | Request `{name, order_code}`; returns members only when the order code matches and identifies the creator |
| DELETE | `/api/teams/{team_id}` | Request `{order_code}`; deletes the team only when the code belongs to its creator |
| POST   | `/api/teams`        | Create team `{name, order_code, attendee_email}` |
| POST   | `/api/teams/join`   | Join team `{name, order_code, attendee_email}` |

Errors return `{"detail": "..."}` with 400/404/409.

## Configuration

Backend (env vars): `TEAM_MANAGER_DB_HOST` (default `localhost`),
`TEAM_MANAGER_DB_PORT` (5432), `TEAM_MANAGER_DB_NAME` (`team_manager`),
`TEAM_MANAGER_DB_USER` (`team_manager`), and `TEAM_MANAGER_DB_PASSWORD`
(required for Compose; empty by default when running directly),
`TEAM_MANAGER_LOG_FILE` (default `team_manager.log`; rotates at 5 MB and keeps
three backups),
`TEAM_MANAGER_MAX_MEMBERS` (5), `TEAM_MANAGER_MIN_NAME` (3),
`TEAM_MANAGER_MAX_NAME` (32), `TEAM_MANAGER_CORS_ORIGINS`.
Copy `backend/.env.example` to `backend/.env` to configure local backend
settings, or to the repository root as `.env` for Docker Compose. Set
`TEAM_MANAGER_DB_HOST=localhost` when running the backend directly on your
machine; Compose defaults it to `postgres`. The backend loads `backend/.env`
on startup regardless of the current working directory; variables already set
in the process environment take precedence.
Team creation and joining require a valid Pretix order code and attendee email.
An attendee email can belong to only one team.
Configure `PRETIX_API_KEY`, `PRETIX_URL`, and `PRETIX_CTF_NAME` in the backend
environment. Set `PRETIX_CTF_NAME` to the event title to discover it by name,
or to `organizer-slug/event-slug` to address one event directly (for example,
`northsec/2027`).

Frontend: `frontend/js/config.js` (`apiBase` for cross-origin setups).
