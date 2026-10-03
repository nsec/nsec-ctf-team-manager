"""Application configuration, overridable via environment variables."""

import os


class Settings:
    """Simple settings object; swap for pydantic-settings later if needed."""

    def __init__(self) -> None:
        self.db_path: str = os.environ.get("TEAM_MANAGER_DB", "team_manager.db")
        # Max members per team — mirrors frontend/js/config.js
        self.max_members_per_team: int = int(os.environ.get("TEAM_MANAGER_MAX_MEMBERS", "5"))
        self.min_team_name_length: int = int(os.environ.get("TEAM_MANAGER_MIN_NAME", "3"))
        self.max_team_name_length: int = int(os.environ.get("TEAM_MANAGER_MAX_NAME", "128"))
        # CORS origins allowed to call the API (frontend dev server).
        origins = os.environ.get(
            "TEAM_MANAGER_CORS_ORIGINS", "http://localhost:8080,http://127.0.0.1:8080"
        )
        self.cors_origins: list[str] = [o.strip() for o in origins.split(",") if o.strip()]


settings = Settings()
