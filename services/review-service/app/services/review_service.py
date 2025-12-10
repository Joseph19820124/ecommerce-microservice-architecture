from datetime import datetime
from typing import Optional, List, Tuple
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
import logging

from app.models.review import Review, ReviewStatus, ProductRatingSummary
from app.schemas.review import CreateReviewRequest, UpdateReviewRequest

logger = logging.getLogger(__name__)


class ReviewService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.reviews_collection = db.reviews
        self.summaries_collection = db.product_rating_summaries

    async def create_review(
        self,
        user_id: str,
        request: CreateReviewRequest,
        verified_purchase: bool = False
    ) -> Review:
        review_dict = {
            "product_id": request.product_id,
            "user_id": user_id,
            "order_id": request.order_id,
            "rating": request.rating,
            "title": request.title,
            "content": request.content,
            "images": [img.model_dump() for img in request.images],
            "verified_purchase": verified_purchase,
            "status": ReviewStatus.PENDING.value,
            "helpfulness": {"helpful_count": 0, "not_helpful_count": 0},
            "seller_response": None,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }

        result = await self.reviews_collection.insert_one(review_dict)
        review_dict["_id"] = str(result.inserted_id)

        # Update product rating summary
        await self._update_product_summary(request.product_id)

        logger.info(f"Review created: {result.inserted_id} for product {request.product_id}")
        return Review(**review_dict)

    async def get_review_by_id(self, review_id: str) -> Optional[Review]:
        if not ObjectId.is_valid(review_id):
            return None

        review = await self.reviews_collection.find_one({"_id": ObjectId(review_id)})
        if review:
            review["_id"] = str(review["_id"])
            return Review(**review)
        return None

    async def get_product_reviews(
        self,
        product_id: str,
        page: int = 1,
        page_size: int = 10,
        rating_filter: Optional[int] = None,
        verified_only: bool = False,
        sort_by: str = "created_at"
    ) -> Tuple[List[Review], int]:
        query = {
            "product_id": product_id,
            "status": ReviewStatus.APPROVED.value
        }

        if rating_filter:
            query["rating"] = rating_filter

        if verified_only:
            query["verified_purchase"] = True

        sort_field = sort_by if sort_by in ["created_at", "rating", "helpfulness.helpful_count"] else "created_at"
        sort_direction = -1

        total = await self.reviews_collection.count_documents(query)

        cursor = self.reviews_collection.find(query)
        cursor = cursor.sort(sort_field, sort_direction)
        cursor = cursor.skip((page - 1) * page_size).limit(page_size)

        reviews = []
        async for review in cursor:
            review["_id"] = str(review["_id"])
            reviews.append(Review(**review))

        return reviews, total

    async def get_user_reviews(
        self,
        user_id: str,
        page: int = 1,
        page_size: int = 10
    ) -> Tuple[List[Review], int]:
        query = {"user_id": user_id}

        total = await self.reviews_collection.count_documents(query)

        cursor = self.reviews_collection.find(query)
        cursor = cursor.sort("created_at", -1)
        cursor = cursor.skip((page - 1) * page_size).limit(page_size)

        reviews = []
        async for review in cursor:
            review["_id"] = str(review["_id"])
            reviews.append(Review(**review))

        return reviews, total

    async def update_review(
        self,
        review_id: str,
        user_id: str,
        request: UpdateReviewRequest
    ) -> Optional[Review]:
        if not ObjectId.is_valid(review_id):
            return None

        existing = await self.reviews_collection.find_one({
            "_id": ObjectId(review_id),
            "user_id": user_id
        })

        if not existing:
            return None

        update_data = {"updated_at": datetime.utcnow()}

        if request.rating is not None:
            update_data["rating"] = request.rating
        if request.title is not None:
            update_data["title"] = request.title
        if request.content is not None:
            update_data["content"] = request.content
        if request.images is not None:
            update_data["images"] = [img.model_dump() for img in request.images]

        # Reset status to pending after edit
        update_data["status"] = ReviewStatus.PENDING.value

        await self.reviews_collection.update_one(
            {"_id": ObjectId(review_id)},
            {"$set": update_data}
        )

        # Update product rating summary
        await self._update_product_summary(existing["product_id"])

        return await self.get_review_by_id(review_id)

    async def delete_review(self, review_id: str, user_id: str) -> bool:
        if not ObjectId.is_valid(review_id):
            return False

        existing = await self.reviews_collection.find_one({
            "_id": ObjectId(review_id),
            "user_id": user_id
        })

        if not existing:
            return False

        product_id = existing["product_id"]

        result = await self.reviews_collection.delete_one({
            "_id": ObjectId(review_id),
            "user_id": user_id
        })

        if result.deleted_count > 0:
            await self._update_product_summary(product_id)
            logger.info(f"Review deleted: {review_id}")
            return True

        return False

    async def approve_review(self, review_id: str) -> Optional[Review]:
        if not ObjectId.is_valid(review_id):
            return None

        result = await self.reviews_collection.update_one(
            {"_id": ObjectId(review_id)},
            {"$set": {
                "status": ReviewStatus.APPROVED.value,
                "updated_at": datetime.utcnow()
            }}
        )

        if result.modified_count > 0:
            review = await self.get_review_by_id(review_id)
            if review:
                await self._update_product_summary(review.product_id)
            return review
        return None

    async def reject_review(self, review_id: str) -> Optional[Review]:
        if not ObjectId.is_valid(review_id):
            return None

        result = await self.reviews_collection.update_one(
            {"_id": ObjectId(review_id)},
            {"$set": {
                "status": ReviewStatus.REJECTED.value,
                "updated_at": datetime.utcnow()
            }}
        )

        if result.modified_count > 0:
            review = await self.get_review_by_id(review_id)
            if review:
                await self._update_product_summary(review.product_id)
            return review
        return None

    async def mark_helpful(self, review_id: str, helpful: bool) -> Optional[Review]:
        if not ObjectId.is_valid(review_id):
            return None

        field = "helpfulness.helpful_count" if helpful else "helpfulness.not_helpful_count"

        await self.reviews_collection.update_one(
            {"_id": ObjectId(review_id)},
            {"$inc": {field: 1}}
        )

        return await self.get_review_by_id(review_id)

    async def add_seller_response(
        self,
        review_id: str,
        content: str
    ) -> Optional[Review]:
        if not ObjectId.is_valid(review_id):
            return None

        seller_response = {
            "content": content,
            "responded_at": datetime.utcnow()
        }

        await self.reviews_collection.update_one(
            {"_id": ObjectId(review_id)},
            {"$set": {
                "seller_response": seller_response,
                "updated_at": datetime.utcnow()
            }}
        )

        return await self.get_review_by_id(review_id)

    async def get_product_rating_summary(self, product_id: str) -> Optional[ProductRatingSummary]:
        summary = await self.summaries_collection.find_one({"product_id": product_id})

        if summary:
            return ProductRatingSummary(**summary)

        # Calculate on-the-fly if not cached
        return await self._calculate_product_summary(product_id)

    async def _update_product_summary(self, product_id: str):
        summary = await self._calculate_product_summary(product_id)

        if summary:
            await self.summaries_collection.update_one(
                {"product_id": product_id},
                {"$set": summary.model_dump()},
                upsert=True
            )

    async def _calculate_product_summary(self, product_id: str) -> ProductRatingSummary:
        pipeline = [
            {"$match": {
                "product_id": product_id,
                "status": ReviewStatus.APPROVED.value
            }},
            {"$group": {
                "_id": "$product_id",
                "average_rating": {"$avg": "$rating"},
                "total_reviews": {"$sum": 1},
                "verified_purchase_count": {
                    "$sum": {"$cond": ["$verified_purchase", 1, 0]}
                },
                "with_images_count": {
                    "$sum": {"$cond": [{"$gt": [{"$size": "$images"}, 0]}, 1, 0]}
                }
            }}
        ]

        result = await self.reviews_collection.aggregate(pipeline).to_list(1)

        # Get rating distribution
        distribution_pipeline = [
            {"$match": {
                "product_id": product_id,
                "status": ReviewStatus.APPROVED.value
            }},
            {"$group": {
                "_id": "$rating",
                "count": {"$sum": 1}
            }}
        ]

        dist_result = await self.reviews_collection.aggregate(distribution_pipeline).to_list(5)
        rating_distribution = {"5": 0, "4": 0, "3": 0, "2": 0, "1": 0}
        for item in dist_result:
            rating_distribution[str(item["_id"])] = item["count"]

        if result:
            return ProductRatingSummary(
                product_id=product_id,
                average_rating=round(result[0]["average_rating"], 2) if result[0]["average_rating"] else 0.0,
                total_reviews=result[0]["total_reviews"],
                rating_distribution=rating_distribution,
                verified_purchase_count=result[0]["verified_purchase_count"],
                with_images_count=result[0]["with_images_count"],
                updated_at=datetime.utcnow()
            )

        return ProductRatingSummary(
            product_id=product_id,
            average_rating=0.0,
            total_reviews=0,
            rating_distribution=rating_distribution,
            verified_purchase_count=0,
            with_images_count=0,
            updated_at=datetime.utcnow()
        )
