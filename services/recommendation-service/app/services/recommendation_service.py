import json
import logging
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Set
from collections import defaultdict
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

from app.config.settings import get_settings
from app.models.interaction import UserInteraction, InteractionType, UserProfile
from app.schemas.recommendation import RecommendedProduct

logger = logging.getLogger(__name__)
settings = get_settings()


class RecommendationService:
    def __init__(self, redis_client):
        self.redis = redis_client
        self.interaction_weights = {
            InteractionType.VIEW: 1.0,
            InteractionType.ADD_TO_CART: 3.0,
            InteractionType.WISHLIST: 2.0,
            InteractionType.PURCHASE: 5.0,
            InteractionType.REVIEW: 4.0,
        }

    async def track_interaction(self, interaction: UserInteraction) -> bool:
        """Track user interaction with a product"""
        try:
            # Store interaction in Redis
            interaction_key = f"interactions:{interaction.user_id}"
            interaction_data = {
                "product_id": interaction.product_id,
                "type": interaction.interaction_type.value,
                "score": self.interaction_weights.get(interaction.interaction_type, 1.0),
                "timestamp": interaction.timestamp.isoformat(),
            }

            # Add to user's interaction list (keep last 1000)
            await self.redis.lpush(interaction_key, json.dumps(interaction_data))
            await self.redis.ltrim(interaction_key, 0, 999)
            await self.redis.expire(interaction_key, 86400 * 30)  # 30 days

            # Update product popularity
            popularity_key = "product:popularity"
            await self.redis.zincrby(popularity_key, interaction_data["score"], interaction.product_id)

            # Update co-occurrence for collaborative filtering
            await self._update_co_occurrence(interaction.user_id, interaction.product_id)

            # Update user profile
            await self._update_user_profile(interaction)

            logger.info(f"Tracked interaction: user={interaction.user_id}, product={interaction.product_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to track interaction: {e}")
            return False

    async def get_personalized_recommendations(
        self,
        user_id: str,
        limit: int = 10,
        exclude_purchased: bool = True
    ) -> List[RecommendedProduct]:
        """Get personalized recommendations for a user"""
        try:
            # Check cache first
            cache_key = f"recommendations:personalized:{user_id}"
            cached = await self.redis.get(cache_key)
            if cached:
                recommendations = json.loads(cached)
                return [RecommendedProduct(**r) for r in recommendations[:limit]]

            # Get user's interaction history
            interactions = await self._get_user_interactions(user_id)

            if not interactions:
                # Cold start: return popular products
                return await self.get_trending_products(limit)

            # Get products to exclude (already purchased)
            excluded_products: Set[str] = set()
            if exclude_purchased:
                excluded_products = await self._get_purchased_products(user_id)

            # Combine multiple recommendation strategies
            recommendations: Dict[str, RecommendedProduct] = {}

            # 1. Content-based: similar to recently viewed/purchased
            recent_products = [i["product_id"] for i in interactions[:10]]
            for product_id in recent_products:
                similar = await self.get_similar_products(product_id, limit=5)
                for rec in similar:
                    if rec.product_id not in excluded_products:
                        if rec.product_id in recommendations:
                            recommendations[rec.product_id].score += rec.score * 0.5
                        else:
                            rec.reason = "Similar to items you viewed"
                            recommendations[rec.product_id] = rec

            # 2. Collaborative filtering: users who bought X also bought Y
            cf_recommendations = await self._collaborative_filtering(user_id, limit=10)
            for rec in cf_recommendations:
                if rec.product_id not in excluded_products:
                    if rec.product_id in recommendations:
                        recommendations[rec.product_id].score += rec.score
                    else:
                        recommendations[rec.product_id] = rec

            # 3. Category-based: popular in user's preferred categories
            user_profile = await self._get_user_profile(user_id)
            if user_profile and user_profile.preferred_categories:
                category_recs = await self._get_category_recommendations(
                    user_profile.preferred_categories[:3],
                    limit=5
                )
                for rec in category_recs:
                    if rec.product_id not in excluded_products:
                        if rec.product_id in recommendations:
                            recommendations[rec.product_id].score += rec.score * 0.3
                        else:
                            rec.reason = "Popular in your favorite categories"
                            recommendations[rec.product_id] = rec

            # Sort by score and limit
            sorted_recs = sorted(
                recommendations.values(),
                key=lambda x: x.score,
                reverse=True
            )[:limit]

            # Cache results
            cache_data = [r.model_dump() for r in sorted_recs]
            await self.redis.setex(cache_key, settings.cache_ttl, json.dumps(cache_data))

            return sorted_recs

        except Exception as e:
            logger.error(f"Failed to get personalized recommendations: {e}")
            return await self.get_trending_products(limit)

    async def get_similar_products(
        self,
        product_id: str,
        limit: int = 10
    ) -> List[RecommendedProduct]:
        """Get products similar to the given product"""
        try:
            # Check cache
            cache_key = f"recommendations:similar:{product_id}"
            cached = await self.redis.get(cache_key)
            if cached:
                recommendations = json.loads(cached)
                return [RecommendedProduct(**r) for r in recommendations[:limit]]

            recommendations: Dict[str, RecommendedProduct] = {}

            # 1. Co-purchase similarity
            co_purchase_key = f"co_occurrence:{product_id}"
            co_purchases = await self.redis.zrevrange(co_purchase_key, 0, limit - 1, withscores=True)
            for similar_id, score in co_purchases:
                if isinstance(similar_id, bytes):
                    similar_id = similar_id.decode()
                recommendations[similar_id] = RecommendedProduct(
                    product_id=similar_id,
                    score=float(score),
                    reason="Frequently bought together"
                )

            # 2. Category-based similarity (from product metadata cache)
            product_data = await self.redis.hgetall(f"product:{product_id}")
            if product_data:
                category_id = product_data.get(b"category_id", b"").decode()
                if category_id:
                    category_products = await self.redis.smembers(f"category:{category_id}:products")
                    for pid in list(category_products)[:limit]:
                        if isinstance(pid, bytes):
                            pid = pid.decode()
                        if pid != product_id and pid not in recommendations:
                            recommendations[pid] = RecommendedProduct(
                                product_id=pid,
                                score=0.5,
                                reason="Same category"
                            )

            sorted_recs = sorted(
                recommendations.values(),
                key=lambda x: x.score,
                reverse=True
            )[:limit]

            # Cache results
            cache_data = [r.model_dump() for r in sorted_recs]
            await self.redis.setex(cache_key, settings.cache_ttl, json.dumps(cache_data))

            return sorted_recs

        except Exception as e:
            logger.error(f"Failed to get similar products: {e}")
            return []

    async def get_trending_products(self, limit: int = 10) -> List[RecommendedProduct]:
        """Get trending/popular products"""
        try:
            # Check cache
            cache_key = "recommendations:trending"
            cached = await self.redis.get(cache_key)
            if cached:
                recommendations = json.loads(cached)
                return [RecommendedProduct(**r) for r in recommendations[:limit]]

            # Get from popularity sorted set
            popularity_key = "product:popularity"
            trending = await self.redis.zrevrange(popularity_key, 0, limit - 1, withscores=True)

            recommendations = []
            for product_id, score in trending:
                if isinstance(product_id, bytes):
                    product_id = product_id.decode()
                recommendations.append(RecommendedProduct(
                    product_id=product_id,
                    score=float(score),
                    reason="Trending now"
                ))

            # Cache results
            cache_data = [r.model_dump() for r in recommendations]
            await self.redis.setex(cache_key, 300, json.dumps(cache_data))  # 5 min cache

            return recommendations

        except Exception as e:
            logger.error(f"Failed to get trending products: {e}")
            return []

    async def get_recently_viewed(
        self,
        user_id: str,
        limit: int = 10
    ) -> List[RecommendedProduct]:
        """Get user's recently viewed products"""
        try:
            interactions = await self._get_user_interactions(user_id)
            viewed = [
                i for i in interactions
                if i["type"] == InteractionType.VIEW.value
            ]

            seen = set()
            recommendations = []
            for interaction in viewed:
                product_id = interaction["product_id"]
                if product_id not in seen:
                    seen.add(product_id)
                    recommendations.append(RecommendedProduct(
                        product_id=product_id,
                        score=1.0,
                        reason="Recently viewed"
                    ))
                if len(recommendations) >= limit:
                    break

            return recommendations

        except Exception as e:
            logger.error(f"Failed to get recently viewed: {e}")
            return []

    async def get_frequently_bought_together(
        self,
        product_ids: List[str],
        limit: int = 5
    ) -> List[RecommendedProduct]:
        """Get products frequently bought together with given products"""
        try:
            recommendations: Dict[str, float] = defaultdict(float)
            exclude = set(product_ids)

            for product_id in product_ids:
                co_purchase_key = f"co_occurrence:{product_id}"
                co_purchases = await self.redis.zrevrange(
                    co_purchase_key, 0, limit * 2, withscores=True
                )
                for similar_id, score in co_purchases:
                    if isinstance(similar_id, bytes):
                        similar_id = similar_id.decode()
                    if similar_id not in exclude:
                        recommendations[similar_id] += float(score)

            sorted_recs = sorted(
                recommendations.items(),
                key=lambda x: x[1],
                reverse=True
            )[:limit]

            return [
                RecommendedProduct(
                    product_id=pid,
                    score=score,
                    reason="Frequently bought together"
                )
                for pid, score in sorted_recs
            ]

        except Exception as e:
            logger.error(f"Failed to get frequently bought together: {e}")
            return []

    async def _get_user_interactions(self, user_id: str) -> List[dict]:
        """Get user's interaction history"""
        interaction_key = f"interactions:{user_id}"
        interactions = await self.redis.lrange(interaction_key, 0, 99)
        return [json.loads(i) for i in interactions]

    async def _get_purchased_products(self, user_id: str) -> Set[str]:
        """Get set of products the user has purchased"""
        purchased_key = f"purchased:{user_id}"
        products = await self.redis.smembers(purchased_key)
        return {p.decode() if isinstance(p, bytes) else p for p in products}

    async def _update_co_occurrence(self, user_id: str, product_id: str):
        """Update co-occurrence matrix for collaborative filtering"""
        # Get user's recent interactions
        interactions = await self._get_user_interactions(user_id)
        recent_products = [i["product_id"] for i in interactions[:20] if i["product_id"] != product_id]

        # Update co-occurrence for this product with others
        for other_product in recent_products:
            co_key1 = f"co_occurrence:{product_id}"
            co_key2 = f"co_occurrence:{other_product}"
            await self.redis.zincrby(co_key1, 1, other_product)
            await self.redis.zincrby(co_key2, 1, product_id)
            await self.redis.expire(co_key1, 86400 * 7)  # 7 days
            await self.redis.expire(co_key2, 86400 * 7)

    async def _update_user_profile(self, interaction: UserInteraction):
        """Update user profile based on interaction"""
        profile_key = f"user_profile:{interaction.user_id}"

        # Increment interaction count
        await self.redis.hincrby(profile_key, "interaction_count", 1)
        await self.redis.hset(profile_key, "last_active", datetime.utcnow().isoformat())

        # Track purchased products
        if interaction.interaction_type == InteractionType.PURCHASE:
            purchased_key = f"purchased:{interaction.user_id}"
            await self.redis.sadd(purchased_key, interaction.product_id)
            await self.redis.expire(purchased_key, 86400 * 90)  # 90 days

        await self.redis.expire(profile_key, 86400 * 30)

    async def _get_user_profile(self, user_id: str) -> Optional[UserProfile]:
        """Get user profile"""
        profile_key = f"user_profile:{user_id}"
        profile_data = await self.redis.hgetall(profile_key)

        if not profile_data:
            return None

        return UserProfile(
            user_id=user_id,
            interaction_count=int(profile_data.get(b"interaction_count", 0)),
            last_active=profile_data.get(b"last_active", b"").decode() or None
        )

    async def _collaborative_filtering(
        self,
        user_id: str,
        limit: int = 10
    ) -> List[RecommendedProduct]:
        """Simple item-based collaborative filtering"""
        try:
            interactions = await self._get_user_interactions(user_id)
            if len(interactions) < settings.min_interactions_for_cf:
                return []

            # Get products the user has interacted with
            user_products = {i["product_id"]: i["score"] for i in interactions}

            # Find products frequently co-occurring with user's products
            recommendations: Dict[str, float] = defaultdict(float)
            for product_id, weight in list(user_products.items())[:10]:
                co_key = f"co_occurrence:{product_id}"
                co_products = await self.redis.zrevrange(co_key, 0, 20, withscores=True)
                for co_product, score in co_products:
                    if isinstance(co_product, bytes):
                        co_product = co_product.decode()
                    if co_product not in user_products:
                        recommendations[co_product] += float(score) * weight

            sorted_recs = sorted(
                recommendations.items(),
                key=lambda x: x[1],
                reverse=True
            )[:limit]

            return [
                RecommendedProduct(
                    product_id=pid,
                    score=score,
                    reason="Customers like you also bought"
                )
                for pid, score in sorted_recs
            ]

        except Exception as e:
            logger.error(f"Collaborative filtering failed: {e}")
            return []

    async def _get_category_recommendations(
        self,
        categories: List[str],
        limit: int = 5
    ) -> List[RecommendedProduct]:
        """Get popular products in given categories"""
        try:
            recommendations = []
            for category_id in categories:
                category_key = f"category:{category_id}:popular"
                products = await self.redis.zrevrange(category_key, 0, limit - 1, withscores=True)
                for product_id, score in products:
                    if isinstance(product_id, bytes):
                        product_id = product_id.decode()
                    recommendations.append(RecommendedProduct(
                        product_id=product_id,
                        score=float(score),
                        reason="Popular in category"
                    ))
            return recommendations[:limit]
        except Exception as e:
            logger.error(f"Category recommendations failed: {e}")
            return []
