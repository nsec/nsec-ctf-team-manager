FROM python:3.14-slim-bookworm

COPY --from=ghcr.io/astral-sh/uv:0.8.22 /uv /uvx /bin/

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    TEAM_MANAGER_DB_HOST=postgres \
    TEAM_MANAGER_DB_PORT=5432 \
    TEAM_MANAGER_DB_NAME=team_manager \
    TEAM_MANAGER_DB_USER=team_manager \
    TEAM_MANAGER_LOG_FILE=/data/team_manager.log \
    TEAM_MANAGER_MAX_MEMBERS=8 \
    TEAM_MANAGER_MIN_NAME=1 \
    TEAM_MANAGER_MAX_NAME=128 \
    TEAM_MANAGER_CORS_ORIGINS=http://localhost:8080,http://127.0.0.1:8080,http://[::1]:8080,https://nsec-team-manager.nsec.io \
    PRETIX_URL=https://registrations.nsec.io/api/v1 \
    PRETIX_CTF_NAME=northsec/2027

WORKDIR /app/backend

COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY backend/app ./app
COPY frontend /app/frontend

RUN useradd --create-home --uid 10001 app \
    && mkdir -p /data \
    && chown -R app:app /app /data

VOLUME ["/data"]
EXPOSE 8000
USER app

CMD ["/app/backend/.venv/bin/python", "-m", "app.server"]
