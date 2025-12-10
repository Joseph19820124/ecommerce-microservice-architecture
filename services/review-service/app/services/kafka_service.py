import json
import logging
from typing import Optional
from aiokafka import AIOKafkaProducer, AIOKafkaConsumer
from datetime import datetime
import uuid

from app.config.settings import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class KafkaService:
    def __init__(self):
        self.producer: Optional[AIOKafkaProducer] = None
        self.consumer: Optional[AIOKafkaConsumer] = None

    async def start_producer(self):
        self.producer = AIOKafkaProducer(
            bootstrap_servers=settings.kafka_bootstrap_servers,
            value_serializer=lambda v: json.dumps(v).encode('utf-8'),
            key_serializer=lambda k: k.encode('utf-8') if k else None
        )
        await self.producer.start()
        logger.info("Kafka producer started")

    async def stop_producer(self):
        if self.producer:
            await self.producer.stop()
            logger.info("Kafka producer stopped")

    async def start_consumer(self, topics: list):
        self.consumer = AIOKafkaConsumer(
            *topics,
            bootstrap_servers=settings.kafka_bootstrap_servers,
            group_id=settings.kafka_consumer_group,
            value_deserializer=lambda v: json.loads(v.decode('utf-8')),
            auto_offset_reset='earliest'
        )
        await self.consumer.start()
        logger.info(f"Kafka consumer started for topics: {topics}")

    async def stop_consumer(self):
        if self.consumer:
            await self.consumer.stop()
            logger.info("Kafka consumer stopped")

    async def publish_review_event(self, event_type: str, review_data: dict):
        if not self.producer:
            logger.warning("Kafka producer not initialized")
            return

        event = {
            "eventType": event_type,
            "eventId": str(uuid.uuid4()),
            "timestamp": datetime.utcnow().isoformat(),
            "data": review_data
        }

        try:
            await self.producer.send_and_wait(
                "review-events",
                key=review_data.get("product_id"),
                value=event
            )
            logger.info(f"Published {event_type} event for review {review_data.get('id')}")
        except Exception as e:
            logger.error(f"Failed to publish event: {e}")

    async def publish_review_created(self, review_data: dict):
        await self.publish_review_event("ReviewCreated", review_data)

    async def publish_review_approved(self, review_data: dict):
        await self.publish_review_event("ReviewApproved", review_data)

    async def publish_review_deleted(self, review_data: dict):
        await self.publish_review_event("ReviewDeleted", review_data)


kafka_service = KafkaService()
