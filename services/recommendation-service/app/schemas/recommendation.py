from typing import Optional, List
from pydantic import BaseModel
from app.models.interaction import InteractionType


class RecommendedProduct(BaseModel):
    product_id: str
    score: float
    reason: str
    name: Optional[str] = None
    image_url: Optional[str] = None
    price: Optional[float] = None


class RecommendationResponse(BaseModel):
    user_id: Optional[str] = None
    recommendations: List[RecommendedProduct]
    strategy: str
    total: int


class TrackInteractionRequest(BaseModel):
    user_id: str
    product_id: str
    interaction_type: InteractionType
    metadata: Optional[dict] = None


class SimilarProductsRequest(BaseModel):
    product_id: str
    limit: int = 10


class PersonalizedRequest(BaseModel):
    user_id: str
    limit: int = 10
    exclude_purchased: bool = True
