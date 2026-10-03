"""API tests using FastAPI's TestClient (httpx)."""

import os
import sys
import tempfile

# Use a temp DB before importing the app.
_tmp = tempfile.mkdtemp()
os.environ["TEAM_MANAGER_DB"] = os.path.join(_tmp, "test.db")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient  # noqa: E402

from app.db import reset_db  # noqa: E402
from app.main import app  # noqa: E402

client = TestClient(app)


def setup_function():
    reset_db()


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_create_team():
    r = client.post("/api/teams", json={"name": "Kernel Panic"})
    assert r.status_code == 201
    assert r.json()["name"] == "Kernel Panic"


def test_create_duplicate_team():
    client.post("/api/teams", json={"name": "Dup"})
    r = client.post("/api/teams", json={"name": "dup"})  # case-insensitive
    assert r.status_code == 409


def test_create_duplicate_team_unicode_casefold():
    """casefold-based uniqueness: accented and sharp-s variants collide."""
    client.post("/api/teams", json={"name": "Équipe Alpha"})
    r = client.post("/api/teams", json={"name": "équipe alpha"})
    assert r.status_code == 409
    client.post("/api/teams", json={"name": "Straße"})
    r = client.post("/api/teams", json={"name": "STRASSE"})
    assert r.status_code == 409


def test_create_duplicate_team_accent_insensitive():
    """Accent-insensitive uniqueness: é == e, à == a, etc."""
    client.post("/api/teams", json={"name": "Équipe Test"})
    for variant in ("équipe test", "EQUIPE TEST", "Equipe Test", "equipe test"):
        r = client.post("/api/teams", json={"name": variant})
        assert r.status_code == 409, variant
    client.post("/api/teams", json={"name": "À propos"})
    r = client.post("/api/teams", json={"name": "a propos"})
    assert r.status_code == 409


def test_join_team_unicode_username_casefold():
    """Same username with different case is treated as the same member."""
    client.post("/api/teams", json={"name": "Fold"})
    client.post("/api/teams/join", json={"name": "Fold", "username": "Émilie"})
    r = client.post("/api/teams/join", json={"name": "Fold", "username": "émilie"})
    assert r.status_code == 409


def test_create_team_too_short():
    r = client.post("/api/teams", json={"name": "ab"})
    assert r.status_code == 400


def test_join_team():
    client.post("/api/teams", json={"name": "Joinable"})
    r = client.post("/api/teams/join", json={"name": "joinable", "username": "alice"})
    assert r.status_code == 200
    team = client.get("/api/teams/Joinable").json()
    assert [m["username"] for m in team["members"]] == ["alice"]


def test_join_nonexistent_team():
    r = client.post("/api/teams/join", json={"name": "Ghost", "username": "bob"})
    assert r.status_code == 404


def test_join_twice_rejected():
    client.post("/api/teams", json={"name": "Once"})
    client.post("/api/teams/join", json={"name": "Once", "username": "alice"})
    r = client.post("/api/teams/join", json={"name": "Once", "username": "alice"})
    assert r.status_code == 409


def test_team_full():
    client.post("/api/teams", json={"name": "Full"})
    for i in range(5):  # max_members_per_team default = 5
        r = client.post("/api/teams/join", json={"name": "Full", "username": f"u{i}"})
        assert r.status_code == 200, i
    r = client.post("/api/teams/join", json={"name": "Full", "username": "extra"})
    assert r.status_code == 409


def test_config_endpoint():
    r = client.get("/api/config")
    assert r.status_code == 200
    assert r.json()["maxMembersPerTeam"] == 5
