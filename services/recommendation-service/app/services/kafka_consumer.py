import json
import logging
from datetime import datetime
from aiokafka import AIOKafkaConsumer

from app.config.settings import get_settings
from app.models.interaction import UserInteraction, InteractionType

logger = logging.getLogger(__name__)
settings = get_settings()


class KafkaEventConsumer:
    def __init__(self, recommendation_service):
        self.recommendation_service = recommendation_service
        self.consumer = None

    async def start(self):
        self.consumer = AIOKafkaConsumer(
            "order-events",
            "product-events",
            "user-events",
            bootstrap_servers=settings.kafka_bootstrap_servers,
            group_id=settings.kafka_consumer_group,
            value_deserializer=lambda v: json.loads(v.decode("utf-8")),
            auto_offset_reset="earliest"
        )
        await self.consumer.start()
        logger.info("Kafka consumer started")

    async def stop(self):
        if self.consumer:
            await self.consumer.stop()
            logger.info("Kafka consumer stopped")

    async def consume(self):
        try:
            async for message in self.consumer:
                await self._handle_message(message.topic, message.value)
        except Exception as e:
            logger.error(f"Error consuming Kafka messages: {e}")

    async def _handle_message(self, topic: str, event: dict):
        try:
            event_type = event.get("eventType")
            logger.debug(f"Received event: {topic} - {event_type}")

            if topic == "order-events":
                await self._handle_order_event(event)
            elif topic == "product-events":
                await self._handle_product_event(event)
            elif topic == "user-events":
                await self._handle_user_event(event)

        except Exception as e:
            logger.error(f"Error handling message from {topic}: {e}")

    async def _handle_order_event(self, event: dict):
        event_type = event.get("eventType")

        if event_type == "OrderCreated":
            user_id = event.get("userId")
            items = event.get("items", [])

            # Track purchase interactions for all items
            for item in items:
                product_id = item.get("productId") or item.get("product_id")
                if product_id:
                    interaction = UserInteraction(
                        user_id=user_id,
                        product_id=product_id,
                        interaction_type=InteractionType.PURCHASE,
                        timestamp=datetime.utcnow()
                    )
                    await self.recommendation_service.track_interaction(interaction)

            logger.info(f"Tracked {len(items)} purchase interactions for user {user_id}")

    async def _handle_product_event(self, event: dict):
        event_type = event.get("eventType")
        data = event.get("data", {})

        if event_type in ["ProductCreated", "ProductUpdated"]:
            # Cache product metadata for similarity calculations
            product_id = data.get("id")
            if product_id:
                redis = self.recommendation_service.redis
                product_key = f"product:{product_id}"
                await redis.hset(product_key, mapping={
                    "category_id": data.get("categoryId", ""),
                    "brand_id": data.get("brandId", ""),
                    "price": str(data.get("price", 0)),
                    "name": data.get("name", "")
                })
                await redis.expire(product_key, 86400 * 7)

                # Add to category set
                category_id = data.get("categoryId")
                if category_id:
                    category_key = f"category:{category_id}:products"
                    await redis.sadd(category_key, product_id)
                    await redis.expire(category_key, 86400 * 7)

                logger.info(f"Cached product metadata: {product_id}")

    async def _handle_user_event(self, event: dict):
        event_type = event.get("eventType")

        if event_type == "ProductViewed":
            user_id = event.get("userId")
            product_id = event.get("productId")

            if user_id and product_id:
                interaction = UserInteraction(
                    user_id=user_id,
                    product_id=product_id,
                    interaction_type=InteractionType.VIEW,
                    timestamp=datetime.utcnow()
                )
                await self.recommendation_service.track_interaction(interaction)

        elif event_type == "ProductAddedToCart":
            user_id = event.get("userId")
            product_id = event.get("productId")

            if user_id and product_id:
                interaction = UserInteraction(
                    user_id=user_id,
                    product_id=product_id,
                    interaction_type=InteractionType.ADD_TO_CART,
                    timestamp=datetime.utcnow()
                )
                await self.recommendation_service.track_interaction(interaction)

        elif event_type == "ProductAddedToWishlist":
            user_id = event.get("userId")
            product_id = event.get("productId")

            if user_id and product_id:
                interaction = UserInteraction(
                    user_id=user_id,
                    product_id=product_id,
                    interaction_type=InteractionType.WISHLIST,
                    timestamp=datetime.utcnow()
                )
                await self.recommendation_service.track_interaction(interaction)
