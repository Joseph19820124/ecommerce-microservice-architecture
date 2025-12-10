from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from app.models.review import ReviewStatus, ReviewImage, ReviewHelpfulness, SellerResponse


class CreateReviewRequest(BaseModel):
    product_id: str
    order_id: Optional[str] = None
    rating: int = Field(..., ge=1, le=5)
    title: Optional[str] = Field(None, max_length=200)
    content: str = Field(..., min_length=10, max_length=5000)
    images: List[ReviewImage] = []


class UpdateReviewRequest(BaseModel):
    rating: Optional[int] = Field(None, ge=1, le=5)
    title: Optional[str] = Field(None, max_length=200)
    content: Optional[str] = Field(None, min_length=10, max_length=5000)
    images: Optional[List[ReviewImage]] = None


class SellerResponseRequest(BaseModel):
    content: str = Field(..., min_length=10, max_length=2000)


class ReviewResponse(BaseModel):
    id: str
    product_id: str
    user_id: str
    order_id: Optional[str] = None
    rating: int
    title: Optional[str] = None
    content: str
    images: List[ReviewImage] = []
    verified_purchase: bool = False
    status: ReviewStatus
    helpfulness: ReviewHelpfulness
    seller_response: Optional[SellerResponse] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProductRatingSummaryResponse(BaseModel):
    product_id: str
    average_rating: float
    total_reviews: int
    rating_distribution: dict
    verified_purchase_count: int
    with_images_count: int


class PaginatedReviewsResponse(BaseModel):
    items: List[ReviewResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
