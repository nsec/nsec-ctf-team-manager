"""FastAPI application: team creation and joining."""

import logging
from pathlib import Path
from logging.handlers import RotatingFileHandler

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from . import service
from .config import settings
from .db import init_db
from .models import (
    TeamCreateRequest,
    TeamDeleteRequest,
    TeamExperienceUpdateRequest,
    TeamJoinRequest,
    MemberDecisionRequest,
    TeamOut,
    TeamVerifyRequest,
)

# Frontend directory (../../frontend relative to this file).
FRONTEND_DIR = Path(__file__).resolve().parent.parent.parent / "frontend"

app_logger = logging.getLogger("app")
app_logger.setLevel(logging.INFO)
log_path = Path(settings.log_file)
log_path.parent.mkdir(parents=True, exist_ok=True)
file_handler = RotatingFileHandler(
    log_path, maxBytes=5_000_000, backupCount=3, encoding="utf-8"
)
file_handler.setFormatter(
    logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s")
)
app_logger.addHandler(file_handler)

app = FastAPI(
    title="NSEC Team Manager API",
    version="0.1.0",
    description="Create and join CTF teams.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
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


@app.get("/api/orders/{order_code}/attendees")
def get_order_attendees(order_code: str) -> list[str]:
    return service.get_order_attendees(order_code)


@app.post("/api/teams/verify", response_model=TeamOut)
def verify_team_members(body: TeamVerifyRequest) -> TeamOut:
    return TeamOut(**service.verify_team_members(body.name, body.order_code))


@app.delete("/api/teams/{team_id}", status_code=204)
def delete_team(team_id: int, body: TeamDeleteRequest) -> None:
    service.delete_team(team_id, body.order_code)


@app.patch("/api/teams/{team_id}/experience", status_code=204)
def update_team_experience(
    team_id: int, body: TeamExperienceUpdateRequest
) -> None:
    service.update_team_experience(
        team_id, body.order_code, body.ctf_experience
    )


@app.post("/api/teams/{team_id}/members/{member_id}/approve", status_code=204)
def approve_member(
    team_id: int, member_id: int, body: MemberDecisionRequest
) -> None:
    service.approve_member(team_id, member_id, body.order_code)


@app.post("/api/teams/{team_id}/members/{member_id}/reject", status_code=204)
def reject_member(
    team_id: int, member_id: int, body: MemberDecisionRequest
) -> None:
    service.reject_member(team_id, member_id, body.order_code)


@app.post("/api/teams", status_code=201)
def create_team(body: TeamCreateRequest) -> dict:
    service.require_valid_order_attendee(body.order_code, body.attendee_email)
    return service.create_team(
        body.name,
        body.attendee_email,
        body.order_code,
        body.ctf_experience,
    )


@app.post("/api/teams/join", status_code=200)
def join_team(body: TeamJoinRequest) -> dict:
    service.require_valid_order_attendee(body.order_code, body.attendee_email)
    return service.join_team(body.name, body.attendee_email, body.order_code)


# Serve the frontend last so /api/* routes take precedence.
if FRONTEND_DIR.is_dir():
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
