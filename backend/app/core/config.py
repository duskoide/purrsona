from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    DATABASE_URL: str = "postgresql://purrsona:purrsona@localhost:5432/purrsona"
    # "disable" for local dev (default), "require" for RDS/managed Postgres.
    DATABASE_SSL_MODE: str = "disable"
    RATE_LIMIT_PER_MINUTE: int = 60
    JWT_SECRET: str = "change-me-in-production"
    JWT_EXPIRY_HOURS: int = 24
    BOOTSTRAP_ADMIN_EMAIL: str | None = None

    # Environment
    ENVIRONMENT: str = "development"

    # CORS: comma-separated list of allowed origins (e.g. the deployed
    # frontend URL). Defaults to local dev only.
    CORS_ALLOWED_ORIGINS: str = "http://localhost:3000"

    # S3 / S3-compatible image storage.
    # S3_ENDPOINT: set for MinIO/local dev (e.g. http://minio:9000).
    #   Leave unset in production to use real AWS S3 in S3_REGION.
    # S3_ACCESS_KEY / S3_SECRET_KEY: set for MinIO/local dev.
    #   Leave unset in production so boto3 picks up credentials from the
    #   ECS task's IAM role instead of static keys.
    S3_ENDPOINT: str | None = "http://localhost:9000"
    S3_ACCESS_KEY: str | None = "minioadmin"
    S3_SECRET_KEY: str | None = "minioadmin"
    S3_REGION: str = "us-east-1"
    S3_BUCKET: str = "purrsona-images"
    # Public base URL for constructing photo URLs returned to clients.
    # Defaults to S3_ENDPOINT for local dev; set explicitly in production,
    # e.g. https://<bucket>.s3.<region>.amazonaws.com or a CloudFront domain.
    S3_PUBLIC_BASE_URL: str | None = None

    # Image validation
    MAX_IMAGE_SIZE_MB: int = 10

    # Coordinate blurring
    BLUR_RADIUS_METERS: int = 200

    # Cat matching
    SIMILARITY_THRESHOLD: float = 0.65
    EMBEDDING_DEVICE: str = "cpu"
    MAX_MATCH_CANDIDATES: int = 3

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ALLOWED_ORIGINS.split(",") if origin.strip()]

    @property
    def s3_public_base_url(self) -> str:
        if self.S3_PUBLIC_BASE_URL:
            return self.S3_PUBLIC_BASE_URL.rstrip("/")
        if self.S3_ENDPOINT:
            return f"{self.S3_ENDPOINT.rstrip('/')}/{self.S3_BUCKET}"
        return f"https://{self.S3_BUCKET}.s3.{self.S3_REGION}.amazonaws.com"


settings = Settings()
