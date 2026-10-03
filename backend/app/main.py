"""FastAPI application: team creation and joining."""

from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from . import service
from .config import settings
from .db import init_db
from .models import TeamCreateRequest, TeamJoinRequest, TeamOut

# Frontend directory (../../frontend relative to this file).
FRONTEND_DIR = Path(__file__).resolve().parent.parent.parent / "frontend"

app = FastAPI(
    title="NSEC Team Manager API",
    version="0.1.0",
    description="Create and join CTF teams.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.exception_handler(service.TeamError)
async def team_error_handler(_: Request, exc: service.TeamError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/config")
def get_config() -> dict:
    """Expose server-side limits so the frontend can mirror them."""
    return {
        "maxMembersPerTeam": settings.max_members_per_team,
        "minTeamNameLength": settings.min_team_name_length,
        "maxTeamNameLength": settings.max_team_name_length,
    }


@app.get("/api/teams")
def list_teams() -> list[dict]:
    return service.list_teams()


@app.get("/api/teams/{name}", response_model=TeamOut)
def get_team(name: str) -> TeamOut:
    team = service.get_team(name)
    if team is None:
        return JSONResponse(status_code=404, content={"detail": "Team not found."})
    return TeamOut(**team)


@app.post("/api/teams", status_code=201)
def create_team(body: TeamCreateRequest) -> dict:
    return service.create_team(body.name)


@app.post("/api/teams/join", status_code=200)
def join_team(body: TeamJoinRequest) -> dict:
    return service.join_team(body.name, body.username)


# Serve the frontend last so /api/* routes take precedence.
if FRONTEND_DIR.is_dir():
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
