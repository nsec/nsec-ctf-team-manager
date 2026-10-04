"""Configuration loading tests."""

def test_dotenv_loads_values_without_overriding_environment(tmp_path, monkeypatch):
    from app.config import Settings, _load_environment

    env_file = tmp_path / ".env"
    env_file.write_text("TEAM_MANAGER_MAX_MEMBERS=11\n", encoding="utf-8")
    monkeypatch.delenv("TEAM_MANAGER_MAX_MEMBERS", raising=False)

    _load_environment(env_file)

    assert Settings().max_members_per_team == 11

    monkeypatch.setenv("TEAM_MANAGER_MAX_MEMBERS", "13")
    _load_environment(env_file)

    assert Settings().max_members_per_team == 13
