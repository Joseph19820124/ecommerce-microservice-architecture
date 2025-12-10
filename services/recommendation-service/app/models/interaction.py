from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from enum import Enum


class InteractionType(str, Enum):
    VIEW = "view"
    ADD_TO_CART = "add_to_cart"
    PURCHASE = "purchase"
    REVIEW = "review"
    WISHLIST = "wishlist"


class UserInteraction(BaseModel):
    user_id: str
    product_id: str
    interaction_type: InteractionType
    score: float = 1.0
    timestamp: datetime = datetime.utcnow()
    metadata: Optional[dict] = None


class ProductSimilarity(BaseModel):
    product_id: str
    similar_product_id: str
    score: float
    reason: str  # e.g., "category", "brand", "co-purchase", "content"


class UserProfile(BaseModel):
    user_id: str
    preferred_categories: list[str] = []
    preferred_brands: list[str] = []
    price_range_min: float = 0
    price_range_max: float = 10000
    interaction_count: int = 0
    last_active: Optional[datetime] = None
