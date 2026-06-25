from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    DATABASE_URL: str = "postgresql://purrsona:purrsona@localhost:5432/purrsona"
    RATE_LIMIT_PER_MINUTE: int = 60
    JWT_SECRET: str = "change-me-in-production"
    JWT_EXPIRY_HOURS: int = 24
    BOOTSTRAP_ADMIN_EMAIL: str | None = None

    # Environment
    ENVIRONMENT: str = "development"


settings = Settings()
