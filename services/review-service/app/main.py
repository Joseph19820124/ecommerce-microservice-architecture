from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from motor.motor_asyncio import AsyncIOMotorClient
from prometheus_client import make_asgi_app, Counter, Histogram
import logging
import time

from app.config.settings import get_settings
from app.api.reviews import router as reviews_router
from app.services.kafka_service import kafka_service

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
    logger.info("Starting Review Service...")

    # Connect to MongoDB
    app.state.mongo_client = AsyncIOMotorClient(settings.mongodb_url)
    app.state.db = app.state.mongo_client[settings.mongodb_database]

    # Create indexes
    await app.state.db.reviews.create_index("product_id")
    await app.state.db.reviews.create_index("user_id")
    await app.state.db.reviews.create_index("status")
    await app.state.db.reviews.create_index([("product_id", 1), ("status", 1)])
    await app.state.db.product_rating_summaries.create_index("product_id", unique=True)

    logger.info("Connected to MongoDB")

    # Start Kafka producer
    try:
        await kafka_service.start_producer()
    except Exception as e:
        logger.warning(f"Failed to connect to Kafka: {e}")

    yield

    # Shutdown
    logger.info("Shutting down Review Service...")

    await kafka_service.stop_producer()
    app.state.mongo_client.close()

    logger.info("Review Service stopped")


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
app.include_router(reviews_router)


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": settings.app_name}


@app.get("/health/ready")
async def readiness_check(request: Request):
    try:
        await request.app.state.db.command("ping")
        return {"status": "ready", "database": "connected"}
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={"status": "not ready", "error": str(e)}
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.host, port=settings.port)
