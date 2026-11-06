"""Application configuration, overridable via environment variables."""

import os
from pathlib import Path

from dotenv import load_dotenv


ENV_FILE = Path(__file__).resolve().parents[1] / ".env"


def _load_environment(env_file: Path = ENV_FILE) -> None:
    load_dotenv(env_file)


_load_environment()


class Settings:
    """Simple settings object; swap for pydantic-settings later if needed."""

    def __init__(self) -> None:
        self.db_host: str = os.environ.get("TEAM_MANAGER_DB_HOST", "localhost")
        self.db_port: int = int(os.environ.get("TEAM_MANAGER_DB_PORT", "5432"))
        self.db_name: str = os.environ.get("TEAM_MANAGER_DB_NAME", "team_manager")
        self.db_user: str = os.environ.get("TEAM_MANAGER_DB_USER", "team_manager")
        self.db_password: str = os.environ.get("TEAM_MANAGER_DB_PASSWORD", "")
        self.log_file: str = os.environ.get("TEAM_MANAGER_LOG_FILE", "team_manager.log")
        # Max members per team — mirrors frontend/js/config.js
        self.max_members_per_team: int = int(os.environ.get("TEAM_MANAGER_MAX_MEMBERS", "8"))
        self.min_team_name_length: int = int(os.environ.get("TEAM_MANAGER_MIN_NAME", "1"))
        self.max_team_name_length: int = int(os.environ.get("TEAM_MANAGER_MAX_NAME", "128"))
        self.pretix_api_key: str = os.environ.get("PRETIX_API_KEY", "[NOKEY]")
        self.pretix_url: str = os.environ.get(
            "PRETIX_URL", "https://https://registrations.nsec.io/api/v1"
        ).rstrip("/")
        self.pretix_ctf_name: str = os.environ.get("PRETIX_CTF_NAME", "northsec/2027")
        # CORS origins allowed to call the API (frontend dev server).
        origins = os.environ.get(
            "TEAM_MANAGER_CORS_ORIGINS",
            "http://localhost:8080,http://127.0.0.1:8080,http://[::1]:8080,https://nsec-team-manager.nsec.io",
        )
        self.cors_origins: list[str] = [o.strip() for o in origins.split(",") if o.strip()]


settings = Settings()
