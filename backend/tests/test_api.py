"""API tests using FastAPI's TestClient (httpx)."""

import os
import sys
import tempfile

import pytest

# Use a dedicated PostgreSQL database before importing the app.
_tmp = tempfile.mkdtemp()
os.environ["TEAM_MANAGER_DB_HOST"] = os.environ.get(
    "TEAM_MANAGER_DB_HOST", "localhost"
)
os.environ["TEAM_MANAGER_DB_PORT"] = os.environ.get("TEAM_MANAGER_DB_PORT", "5432")
os.environ["TEAM_MANAGER_DB_NAME"] = os.environ.get(
    "TEAM_MANAGER_DB_NAME", "team_manager"
)
os.environ["TEAM_MANAGER_DB_USER"] = os.environ.get(
    "TEAM_MANAGER_DB_USER", "team_manager"
)
os.environ["TEAM_MANAGER_DB_PASSWORD"] = os.environ.get(
    "TEAM_MANAGER_DB_PASSWORD", "team_manager"
)
os.environ["TEAM_MANAGER_LOG_FILE"] = os.path.join(_tmp, "test.log")
os.environ["TEAM_MANAGER_MAX_MEMBERS"] = "5"
os.environ["TEAM_MANAGER_MIN_NAME"] = "3"

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient  # noqa: E402

from app import service  # noqa: E402
from app.db import reset_db  # noqa: E402
from app.main import app  # noqa: E402

client = TestClient(app)
TEST_ORDER_CODE = "QHA9N"
TEST_ATTENDEE_EMAIL = "attendee@example.com"


@pytest.fixture(autouse=True)
def valid_test_ticket(monkeypatch):
    monkeypatch.setattr(service, "is_valid_order_attendee", lambda *_: True)


def create_team(name, ctf_experience="regular"):
    return client.post(
        "/api/teams",
        json={
            "name": name,
            "ctf_experience": ctf_experience,
            "order_code": TEST_ORDER_CODE,
            "attendee_email": TEST_ATTENDEE_EMAIL,
        },
    )


def verify_team(name, order_code=TEST_ORDER_CODE):
    return client.post(
        "/api/teams/verify",
        json={"name": name, "order_code": order_code},
    )


def join_team(
    name, attendee_email=TEST_ATTENDEE_EMAIL, order_code=TEST_ORDER_CODE
):
    return client.post(
        "/api/teams/join",
        json={
            "name": name,
            "order_code": order_code,
            "attendee_email": attendee_email,
        },
    )


def approve_member(team_id, member_id, order_code=TEST_ORDER_CODE):
    return client.post(
        f"/api/teams/{team_id}/members/{member_id}/approve",
        json={"order_code": order_code},
    )


def reject_member(team_id, member_id, order_code=TEST_ORDER_CODE):
    return client.post(
        f"/api/teams/{team_id}/members/{member_id}/reject",
        json={"order_code": order_code},
    )


def setup_function():
    reset_db()


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_create_team():
    r = create_team("Kernel Panic")
    assert r.status_code == 201
    assert r.json()["name"] == "Kernel Panic"
    assert r.json()["ctf_experience"] == "regular"
    team = verify_team("Kernel Panic").json()
    assert team["ctf_experience"] == "regular"
    assert team["members"][0]["is_creator"] is True
    assert client.get("/api/teams").json() == [
        {"id": r.json()["id"], "name": "Kernel Panic", "ctf_experience": "regular"}
    ]


def test_create_team_with_ai_ctf_experience():
    response = create_team("AI players", "ai")

    assert response.status_code == 201
    assert response.json()["ctf_experience"] == "ai"
    assert verify_team("AI players").json()["ctf_experience"] == "ai"

def test_create_team_rejects_unknown_ctf_experience():
    response = create_team("Invalid choice", "unrestricted")

    assert response.status_code == 422


def test_create_duplicate_team():
    create_team("Dup")
    r = create_team("dup")  # case-insensitive
    assert r.status_code == 409


def test_email_can_only_belong_to_one_team_when_creating():
    create_team("First team")
    response = client.post(
        "/api/teams",
        json={
            "name": "Second team",
            "ctf_experience": "regular",
            "order_code": "OTHER",
            "attendee_email": TEST_ATTENDEE_EMAIL.upper(),
        },
    )
    assert response.status_code == 409
    assert response.json()["detail"] == "This email already belongs to a team."
    assert [team["name"] for team in client.get("/api/teams").json()] == [
        "First team"
    ]


def test_email_cannot_join_a_second_team():
    create_team("First team")
    client.post(
        "/api/teams",
        json={
            "name": "Second team",
            "order_code": "OTHER",
            "attendee_email": "second@example.com",
        },
    )
    response = join_team("Second team", TEST_ATTENDEE_EMAIL)

    assert response.status_code == 409
    assert response.json()["detail"] == "This email already belongs to a team."


def test_create_duplicate_team_unicode_casefold():
    """casefold-based uniqueness: accented and sharp-s variants collide."""
    create_team("Équipe Alpha")
    r = create_team("équipe alpha")
    assert r.status_code == 409
    create_team("Straße")
    r = create_team("STRASSE")
    assert r.status_code == 409


def test_create_duplicate_team_accent_insensitive():
    """Accent-insensitive uniqueness: é == e, à == a, etc."""
    create_team("Équipe Test")
    for variant in ("équipe test", "EQUIPE TEST", "Equipe Test", "equipe test"):
        r = create_team(variant)
        assert r.status_code == 409, variant
    create_team("À propos")
    r = create_team("a propos")
    assert r.status_code == 409


def test_join_team_duplicate_email_casefold():
    """The same email with different case is treated as the same member."""
    create_team("Fold")
    join_team("Fold", "Émilie@example.com")
    r = join_team("Fold", "émilie@example.com")
    assert r.status_code == 409


def test_create_team_too_short():
    r = create_team("ab")
    assert r.status_code == 400


def test_join_team():
    created = create_team("Joinable")
    r = join_team("joinable", "second@example.com", "JOIN2")
    assert r.status_code == 200
    assert r.json()["status"] == "pending"
    team = verify_team("Joinable").json()
    assert [member["attendee_email"] for member in team["members"]] == [
        TEST_ATTENDEE_EMAIL,
    ]
    assert [member["attendee_email"] for member in team["pending_members"]] == [
        "second@example.com",
    ]
    approved = approve_member(created.json()["id"], r.json()["member_id"])
    assert approved.status_code == 204
    team = verify_team("Joinable", "JOIN2").json()
    assert [member["attendee_email"] for member in team["members"]] == [
        TEST_ATTENDEE_EMAIL,
        "second@example.com",
    ]
    assert team["pending_members"] == []


def test_join_nonexistent_team():
    r = join_team("Ghost")
    assert r.status_code == 404


def test_join_twice_rejected():
    create_team("Once")
    join_team("Once")
    r = join_team("Once")
    assert r.status_code == 409


def test_team_full():
    create_team("Full")
    for i in range(4):  # Creator is the first member.
        r = join_team("Full", f"user{i}@example.com")
        assert r.status_code == 200, i
    r = join_team("Full", "extra@example.com")
    assert r.status_code == 409


def test_any_approved_member_can_approve_and_reject_requests():
    created = create_team("Team approval")
    team_id = created.json()["id"]
    first_request = join_team("Team approval", "first@example.com", "FIRST")
    assert approve_member(team_id, first_request.json()["member_id"]).status_code == 204

    second_request = join_team("Team approval", "second@example.com", "SECOND")
    approved_by_member = approve_member(
        team_id, second_request.json()["member_id"], "FIRST"
    )
    assert approved_by_member.status_code == 204
    assert len(verify_team("Team approval", "SECOND").json()["members"]) == 3

    rejected_request = join_team("Team approval", "third@example.com", "THIRD")
    rejected = reject_member(team_id, rejected_request.json()["member_id"], "FIRST")
    assert rejected.status_code == 204
    assert verify_team("Team approval").json()["pending_members"] == []
    assert verify_team("Team approval", "THIRD").status_code == 403


def test_pending_order_code_cannot_verify_or_approve():
    created = create_team("Pending proof")
    request = join_team("Pending proof", "pending@example.com", "PENDING")

    assert verify_team("Pending proof", "PENDING").status_code == 403
    denied = approve_member(created.json()["id"], request.json()["member_id"], "PENDING")
    assert denied.status_code == 403
    assert denied.json()["detail"] == (
        "Order code does not match an approved member of this team."
    )


def test_only_pending_requests_can_be_decided():
    created = create_team("One decision")
    request = join_team("One decision", "once@example.com", "ONCE")
    team_id = created.json()["id"]
    member_id = request.json()["member_id"]

    assert approve_member(team_id, member_id).status_code == 204
    repeated = approve_member(team_id, member_id)
    assert repeated.status_code == 404
    assert repeated.json()["detail"] == "No pending membership request found."


def test_team_members_require_matching_order_code():
    create_team("Verified")

    response = verify_team("Verified", "wrong-code")

    assert response.status_code == 403
    assert response.json() == {
        "detail": "Order code does not match an approved member of this team."
    }


def test_team_members_can_be_verified_case_insensitively():
    created = create_team("Verified")
    request = join_team("Verified", "second@example.com", "JOIN2")
    assert approve_member(
        created.json()["id"], request.json()["member_id"]
    ).status_code == 204

    response = verify_team("Verified", "join2")

    assert response.status_code == 200
    assert len(response.json()["members"]) == 2
    assert response.json()["is_creator"] is False
    assert response.json()["members"][0]["is_creator"] is True
    assert response.json()["members"][1]["is_creator"] is False


def test_creator_order_code_is_marked_as_team_creator():
    create_team("Creator")

    response = verify_team("Creator", TEST_ORDER_CODE.lower())

    assert response.status_code == 200
    assert response.json()["is_creator"] is True


def test_only_team_creator_can_delete_team():
    created = create_team("Delete me")
    team_id = created.json()["id"]
    request = join_team("Delete me", "second@example.com", "JOIN2")
    approve_member(team_id, request.json()["member_id"])

    not_creator = client.request(
        "DELETE", f"/api/teams/{team_id}", json={"order_code": "JOIN2"}
    )
    assert not_creator.status_code == 403
    assert not_creator.json() == {
        "detail": "Only the team creator can delete this team."
    }
    assert len(verify_team("Delete me").json()["members"]) == 2

    deleted = client.request(
        "DELETE", f"/api/teams/{team_id}", json={"order_code": TEST_ORDER_CODE}
    )
    assert deleted.status_code == 204
    assert client.get("/api/teams").json() == []
    assert verify_team("Delete me").status_code == 404


def test_only_team_creator_can_update_ctf_experience():
    created = create_team("Update experience")
    team_id = created.json()["id"]
    request = join_team("Update experience", "second@example.com", "JOIN2")
    approve_member(team_id, request.json()["member_id"])

    denied = client.patch(
        f"/api/teams/{team_id}/experience",
        json={"order_code": "JOIN2", "ctf_experience": "ai"},
    )
    assert denied.status_code == 403
    assert denied.json() == {
        "detail": "Only the team creator can change this setting."
    }

    updated = client.patch(
        f"/api/teams/{team_id}/experience",
        json={"order_code": TEST_ORDER_CODE, "ctf_experience": "ai"},
    )
    assert updated.status_code == 204
    assert verify_team("Update experience").json()["ctf_experience"] == "ai"


def test_experience_update_rejects_unknown_value():
    created = create_team("Bad experience")
    response = client.patch(
        f"/api/teams/{created.json()['id']}/experience",
        json={"order_code": TEST_ORDER_CODE, "ctf_experience": "unrestricted"},
    )
    assert response.status_code == 422


def test_verifying_nonexistent_team_returns_not_found():
    response = verify_team("Missing")

    assert response.status_code == 404


def test_config_endpoint():
    r = client.get("/api/config")
    assert r.status_code == 200
    assert r.json()["maxMembersPerTeam"] == 5


def test_order_and_attendee_are_required():
    response = client.post("/api/teams", json={"name": "Missing Order"})
    assert response.status_code == 422


def test_invalid_order_attendee_does_not_create_team(monkeypatch):
    monkeypatch.setattr(service, "is_valid_order_attendee", lambda *_: False)
    response = client.post(
        "/api/teams",
        json={
            "name": "No Ticket",
            "order_code": "INVALID",
            "attendee_email": TEST_ATTENDEE_EMAIL,
        },
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid order code or attendee email."
    assert client.get("/api/teams").json() == []


def test_invalid_order_attendee_does_not_join_team(monkeypatch):
    create_team("No Join")
    monkeypatch.setattr(service, "is_valid_order_attendee", lambda *_: False)
    response = client.post(
        "/api/teams/join",
        json={
            "name": "No Join",
            "order_code": "INVALID",
            "attendee_email": TEST_ATTENDEE_EMAIL,
        },
    )
    assert response.status_code == 400
    verified = verify_team("No Join", TEST_ORDER_CODE)
    assert verified.status_code == 200
    assert len(verified.json()["members"]) == 1


def test_order_attendees_endpoint(monkeypatch):
    monkeypatch.setattr(
        service, "get_order_attendees", lambda order_code: [TEST_ATTENDEE_EMAIL]
    )

    response = client.get(f"/api/orders/{TEST_ORDER_CODE}/attendees")

    assert response.status_code == 200
    assert response.json() == [TEST_ATTENDEE_EMAIL]


def test_pretix_unavailable_fails_closed_and_logs_traceback(monkeypatch, caplog):
    from app.pretix import PretixUnavailableError

    def unavailable(*_):
        raise PretixUnavailableError("Pretix request timed out.")

    monkeypatch.setattr(service, "is_valid_order_attendee", unavailable)
    response = client.post(
        "/api/teams",
        json={
            "name": "Unavailable",
            "order_code": TEST_ORDER_CODE,
            "attendee_email": TEST_ATTENDEE_EMAIL,
        },
    )
    assert response.status_code == 503
    assert response.json() == {
        "detail": "Order validation is temporarily unavailable. Please try again."
    }
    record = next(record for record in caplog.records if record.message == "Pretix attendee validation failed.")
    assert record.exc_info is not None
    assert "Pretix request timed out." in caplog.text
    with open(os.environ["TEAM_MANAGER_LOG_FILE"], encoding="utf-8") as log_file:
        file_log = log_file.read()
    assert "Pretix attendee validation failed." in file_log
    assert "Pretix request timed out." in file_log
    assert client.get("/api/teams").json() == []
