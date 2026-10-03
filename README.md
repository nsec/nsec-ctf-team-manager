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
| GET    | `/api/teams`        | List teams                                   |
| GET    | `/api/teams/{name}` | Team details with members                    |
| POST   | `/api/teams`        | Create team `{name}`                         |
| POST   | `/api/teams/join`   | Join team `{name, username}`                 |

Errors return `{"detail": "..."}` with 400/404/409.

## Configuration

Backend (env vars): `TEAM_MANAGER_DB` (default `team_manager.db`),
`TEAM_MANAGER_MAX_MEMBERS` (5), `TEAM_MANAGER_MIN_NAME` (3),
`TEAM_MANAGER_MAX_NAME` (32), `TEAM_MANAGER_CORS_ORIGINS`.

Frontend: `frontend/js/config.js` (`apiBase` for cross-origin setups).
