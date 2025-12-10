import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import redis.asyncio as redis
from prometheus_client import make_asgi_app, Counter, Histogram
import logging
import time

from app.config.settings import get_settings
from app.api.recommendations import router as recommendations_router
from app.services.recommendation_service import RecommendationService
from app.services.kafka_consumer import KafkaEventConsumer

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

settings = get_settings()

# Prometheus metrics
REQUEST_COUNT = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status']
)
REQUEST_LATENCY = Histogram(
    'http_request_duration_seconds',
    'HTTP request latency',
    ['method', 'endpoint']
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting Recommendation Service...")

    # Connect to Redis
    app.state.redis = redis.from_url(
        settings.redis_url,
        encoding="utf-8",
        decode_responses=False
    )
    logger.info("Connected to Redis")

    # Initialize recommendation service
    app.state.recommendation_service = RecommendationService(app.state.redis)

    # Start Kafka consumer
    app.state.kafka_consumer = KafkaEventConsumer(app.state.recommendation_service)
    try:
        await app.state.kafka_consumer.start()
        # Run consumer in background
        app.state.consumer_task = asyncio.create_task(app.state.kafka_consumer.consume())
    except Exception as e:
        logger.warning(f"Failed to start Kafka consumer: {e}")
        app.state.consumer_task = None

    yield

    # Shutdown
    logger.info("Shutting down Recommendation Service...")

    if app.state.consumer_task:
        app.state.consumer_task.cancel()
        try:
            await app.state.consumer_task
        except asyncio.CancelledError:
            pass

    await app.state.kafka_consumer.stop()
    await app.state.redis.close()

    logger.info("Recommendation Service stopped")


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request timing middleware
@app.middleware("http")
async def add_metrics(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    duration = time.time() - start_time

    REQUEST_COUNT.labels(
        method=request.method,
        endpoint=request.url.path,
        status=response.status_code
    ).inc()

    REQUEST_LATENCY.labels(
        method=request.method,
        endpoint=request.url.path
    ).observe(duration)

    return response


# Mount Prometheus metrics
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)

# Include routers
app.include_router(recommendations_router)


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": settings.app_name}


@app.get("/health/ready")
async def readiness_check(request: Request):
    try:
        await request.app.state.redis.ping()
        return {"status": "ready", "redis": "connected"}
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={"status": "not ready", "error": str(e)}
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.host, port=settings.port)
