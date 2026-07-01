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

    # S3-compatible image storage
    S3_ENDPOINT: str = "http://localhost:9000"
    S3_ACCESS_KEY: str = "minioadmin"
    S3_SECRET_KEY: str = "minioadmin"
    S3_BUCKET: str = "purrsona-images"

    # Image validation
    MAX_IMAGE_SIZE_MB: int = 10

    # Coordinate blurring
    BLUR_RADIUS_METERS: int = 200


settings = Settings()
