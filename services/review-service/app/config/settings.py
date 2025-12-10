from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    app_name: str = "Review Service"
    app_version: str = "1.0.0"
    debug: bool = False

    # MongoDB
    mongodb_url: str = "mongodb://mongo:27017"
    mongodb_database: str = "reviewdb"

    # Redis
    redis_url: str = "redis://redis:6379"

    # Kafka
    kafka_bootstrap_servers: str = "kafka:9092"
    kafka_consumer_group: str = "review-service-group"

    # Service URLs
    product_service_url: str = "http://product-service:3002"
    user_service_url: str = "http://user-service:3001"

    # Server
    host: str = "0.0.0.0"
    port: int = 3006

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    return Settings()
