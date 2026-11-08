"""Pydantic models for request/response payloads."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class TeamCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=128, examples=["Kernel Panic"])
    ctf_experience: Literal["regular", "ai"] = "regular"
    order_code: str = Field(min_length=1, max_length=64)
    attendee_email: str = Field(min_length=1, max_length=320)


class TeamJoinRequest(BaseModel):
    name: str = Field(min_length=1, max_length=128, examples=["Kernel Panic"])
    order_code: str = Field(min_length=1, max_length=64)
    attendee_email: str = Field(min_length=1, max_length=320)


class TeamVerifyRequest(BaseModel):
    name: str = Field(min_length=1, max_length=128, examples=["Kernel Panic"])
    order_code: str = Field(min_length=1, max_length=64)


class TeamDeleteRequest(BaseModel):
    order_code: str = Field(min_length=1, max_length=64)


class TeamExperienceUpdateRequest(BaseModel):
    order_code: str = Field(min_length=1, max_length=64)
    ctf_experience: Literal["regular", "ai"]


class MemberDecisionRequest(BaseModel):
    order_code: str = Field(min_length=1, max_length=64)


class MemberOut(BaseModel):
    id: int
    attendee_email: str
    joined_at: datetime
    is_creator: bool
    is_current_user: bool


class TeamOut(BaseModel):
    id: int
    name: str
    ctf_experience: Literal["regular", "ai"]
    members: list[MemberOut]
    pending_members: list[MemberOut]
    max_members: int
    is_creator: bool


class ErrorResponse(BaseModel):
    detail: str
