from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    app_name: str = "Recommendation Service"
    app_version: str = "1.0.0"
    debug: bool = False

    # Redis
    redis_url: str = "redis://:redis123@redis:6379"

    # Kafka
    kafka_bootstrap_servers: str = "kafka:9092"
    kafka_consumer_group: str = "recommendation-service-group"

    # Service URLs
    product_service_url: str = "http://product-service:3002"
    order_service_url: str = "http://order-service:3005"
    user_service_url: str = "http://user-service:3001"

    # Recommendation settings
    max_recommendations: int = 20
    cache_ttl: int = 3600  # 1 hour
    min_interactions_for_cf: int = 5  # Minimum interactions for collaborative filtering

    # Server
    host: str = "0.0.0.0"
    port: int = 3009

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    return Settings()
