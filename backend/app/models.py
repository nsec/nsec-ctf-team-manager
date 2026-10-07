"""Pydantic models for request/response payloads."""

from datetime import datetime

from pydantic import BaseModel, Field


class TeamCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=128, examples=["Kernel Panic"])
    order_code: str = Field(min_length=1, max_length=64)
    attendee_email: str = Field(min_length=1, max_length=320)


class TeamJoinRequest(BaseModel):
    name: str = Field(min_length=1, max_length=128, examples=["Kernel Panic"])
    order_code: str = Field(min_length=1, max_length=64)
    attendee_email: str = Field(min_length=1, max_length=320)


class TeamVerifyRequest(BaseModel):
    name: str = Field(min_length=1, max_length=128, examples=["Kernel Panic"])
    order_code: str = Field(min_length=1, max_length=64)


class MemberOut(BaseModel):
    attendee_email: str
    order_code: str
    joined_at: datetime


class TeamOut(BaseModel):
    id: int
    name: str
    members: list[MemberOut]
    max_members: int


class ErrorResponse(BaseModel):
    detail: str
