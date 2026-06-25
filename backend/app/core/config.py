from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    # Database
    DATABASE_URL: str = "postgresql://purrsona:purrsona@localhost:5432/purrsona"

    # S3-compatible image storage
    S3_ENDPOINT: str = "http://localhost:9000"
    S3_ACCESS_KEY: str = "minioadmin"
    S3_SECRET_KEY: str = "minioadmin"
    S3_BUCKET: str = "purrsona-images"

    # MegaDescriptor model
    MEGADESCRIPTOR_MODEL: str = "hf-hub:BVRA/MegaDescriptor-T-224"

    # JWT
    JWT_SECRET: str = "change-me-in-production"
    JWT_EXPIRY_HOURS: int = 24

    # Rate limiting
    RATE_LIMIT_PER_MINUTE: int = 60

    # Cat matching
    SIMILARITY_THRESHOLD: float = 0.65

    # Image validation
    MAX_IMAGE_SIZE_MB: int = 10

    # Coordinate blurring
    BLUR_RADIUS_METERS: int = 200

    # Bootstrap admin
    BOOTSTRAP_ADMIN_EMAIL: str | None = None


settings = Settings()
