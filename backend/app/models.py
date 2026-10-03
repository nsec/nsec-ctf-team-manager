"""Pydantic models for request/response payloads."""

from pydantic import BaseModel, Field


class TeamCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=128, examples=["Kernel Panic"])


class TeamJoinRequest(BaseModel):
    name: str = Field(min_length=1, max_length=128, examples=["Kernel Panic"])
    username: str = Field(min_length=1, max_length=64, examples=["alice"])


class MemberOut(BaseModel):
    username: str
    joined_at: str


class TeamOut(BaseModel):
    id: int
    name: str
    members: list[MemberOut]
    max_members: int


class ErrorResponse(BaseModel):
    detail: str
