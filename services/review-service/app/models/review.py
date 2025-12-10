from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from bson import ObjectId
from enum import Enum


class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v, field=None):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return ObjectId(v)

    @classmethod
    def __get_pydantic_json_schema__(cls, schema, handler):
        return {"type": "string"}


class ReviewStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class ReviewImage(BaseModel):
    url: str
    thumbnail_url: Optional[str] = None


class ReviewHelpfulness(BaseModel):
    helpful_count: int = 0
    not_helpful_count: int = 0


class SellerResponse(BaseModel):
    content: str
    responded_at: datetime = Field(default_factory=datetime.utcnow)


class Review(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    product_id: str
    user_id: str
    order_id: Optional[str] = None
    rating: int = Field(..., ge=1, le=5)
    title: Optional[str] = None
    content: str
    images: List[ReviewImage] = []
    verified_purchase: bool = False
    status: ReviewStatus = ReviewStatus.PENDING
    helpfulness: ReviewHelpfulness = Field(default_factory=ReviewHelpfulness)
    seller_response: Optional[SellerResponse] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}


class ProductRatingSummary(BaseModel):
    product_id: str
    average_rating: float = 0.0
    total_reviews: int = 0
    rating_distribution: dict = Field(default_factory=lambda: {
        "5": 0, "4": 0, "3": 0, "2": 0, "1": 0
    })
    verified_purchase_count: int = 0
    with_images_count: int = 0
    updated_at: datetime = Field(default_factory=datetime.utcnow)
