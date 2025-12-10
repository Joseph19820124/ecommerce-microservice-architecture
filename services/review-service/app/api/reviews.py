from fastapi import APIRouter, Depends, HTTPException, Query, Header
from typing import Optional
import math

from app.schemas.review import (
    CreateReviewRequest,
    UpdateReviewRequest,
    SellerResponseRequest,
    ReviewResponse,
    ProductRatingSummaryResponse,
    PaginatedReviewsResponse
)
from app.services.review_service import ReviewService
from app.services.kafka_service import kafka_service
from app.api.dependencies import get_review_service

router = APIRouter(prefix="/api/v1/reviews", tags=["reviews"])


def get_user_id(x_user_id: Optional[str] = Header(None)) -> str:
    if not x_user_id:
        raise HTTPException(status_code=401, detail="User ID required")
    return x_user_id


@router.post("", response_model=ReviewResponse, status_code=201)
async def create_review(
    request: CreateReviewRequest,
    user_id: str = Depends(get_user_id),
    review_service: ReviewService = Depends(get_review_service)
):
    # TODO: Verify purchase from order service
    verified_purchase = request.order_id is not None

    review = await review_service.create_review(user_id, request, verified_purchase)

    await kafka_service.publish_review_created({
        "id": review.id,
        "product_id": review.product_id,
        "user_id": review.user_id,
        "rating": review.rating
    })

    return ReviewResponse(
        id=review.id,
        product_id=review.product_id,
        user_id=review.user_id,
        order_id=review.order_id,
        rating=review.rating,
        title=review.title,
        content=review.content,
        images=review.images,
        verified_purchase=review.verified_purchase,
        status=review.status,
        helpfulness=review.helpfulness,
        seller_response=review.seller_response,
        created_at=review.created_at,
        updated_at=review.updated_at
    )


@router.get("/{review_id}", response_model=ReviewResponse)
async def get_review(
    review_id: str,
    review_service: ReviewService = Depends(get_review_service)
):
    review = await review_service.get_review_by_id(review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    return ReviewResponse(
        id=review.id,
        product_id=review.product_id,
        user_id=review.user_id,
        order_id=review.order_id,
        rating=review.rating,
        title=review.title,
        content=review.content,
        images=review.images,
        verified_purchase=review.verified_purchase,
        status=review.status,
        helpfulness=review.helpfulness,
        seller_response=review.seller_response,
        created_at=review.created_at,
        updated_at=review.updated_at
    )


@router.get("/product/{product_id}", response_model=PaginatedReviewsResponse)
async def get_product_reviews(
    product_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    rating: Optional[int] = Query(None, ge=1, le=5),
    verified_only: bool = Query(False),
    sort_by: str = Query("created_at"),
    review_service: ReviewService = Depends(get_review_service)
):
    reviews, total = await review_service.get_product_reviews(
        product_id=product_id,
        page=page,
        page_size=page_size,
        rating_filter=rating,
        verified_only=verified_only,
        sort_by=sort_by
    )

    total_pages = math.ceil(total / page_size) if total > 0 else 1

    return PaginatedReviewsResponse(
        items=[ReviewResponse(
            id=r.id,
            product_id=r.product_id,
            user_id=r.user_id,
            order_id=r.order_id,
            rating=r.rating,
            title=r.title,
            content=r.content,
            images=r.images,
            verified_purchase=r.verified_purchase,
            status=r.status,
            helpfulness=r.helpfulness,
            seller_response=r.seller_response,
            created_at=r.created_at,
            updated_at=r.updated_at
        ) for r in reviews],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


@router.get("/product/{product_id}/summary", response_model=ProductRatingSummaryResponse)
async def get_product_rating_summary(
    product_id: str,
    review_service: ReviewService = Depends(get_review_service)
):
    summary = await review_service.get_product_rating_summary(product_id)

    return ProductRatingSummaryResponse(
        product_id=summary.product_id,
        average_rating=summary.average_rating,
        total_reviews=summary.total_reviews,
        rating_distribution=summary.rating_distribution,
        verified_purchase_count=summary.verified_purchase_count,
        with_images_count=summary.with_images_count
    )


@router.get("/user/{user_id}", response_model=PaginatedReviewsResponse)
async def get_user_reviews(
    user_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    review_service: ReviewService = Depends(get_review_service)
):
    reviews, total = await review_service.get_user_reviews(
        user_id=user_id,
        page=page,
        page_size=page_size
    )

    total_pages = math.ceil(total / page_size) if total > 0 else 1

    return PaginatedReviewsResponse(
        items=[ReviewResponse(
            id=r.id,
            product_id=r.product_id,
            user_id=r.user_id,
            order_id=r.order_id,
            rating=r.rating,
            title=r.title,
            content=r.content,
            images=r.images,
            verified_purchase=r.verified_purchase,
            status=r.status,
            helpfulness=r.helpfulness,
            seller_response=r.seller_response,
            created_at=r.created_at,
            updated_at=r.updated_at
        ) for r in reviews],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


@router.put("/{review_id}", response_model=ReviewResponse)
async def update_review(
    review_id: str,
    request: UpdateReviewRequest,
    user_id: str = Depends(get_user_id),
    review_service: ReviewService = Depends(get_review_service)
):
    review = await review_service.update_review(review_id, user_id, request)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found or not authorized")

    return ReviewResponse(
        id=review.id,
        product_id=review.product_id,
        user_id=review.user_id,
        order_id=review.order_id,
        rating=review.rating,
        title=review.title,
        content=review.content,
        images=review.images,
        verified_purchase=review.verified_purchase,
        status=review.status,
        helpfulness=review.helpfulness,
        seller_response=review.seller_response,
        created_at=review.created_at,
        updated_at=review.updated_at
    )


@router.delete("/{review_id}", status_code=204)
async def delete_review(
    review_id: str,
    user_id: str = Depends(get_user_id),
    review_service: ReviewService = Depends(get_review_service)
):
    deleted = await review_service.delete_review(review_id, user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Review not found or not authorized")

    await kafka_service.publish_review_deleted({
        "id": review_id,
        "user_id": user_id
    })


@router.post("/{review_id}/helpful")
async def mark_review_helpful(
    review_id: str,
    helpful: bool = Query(...),
    review_service: ReviewService = Depends(get_review_service)
):
    review = await review_service.mark_helpful(review_id, helpful)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    return {"message": "Feedback recorded", "helpfulness": review.helpfulness}


@router.post("/{review_id}/approve", response_model=ReviewResponse)
async def approve_review(
    review_id: str,
    review_service: ReviewService = Depends(get_review_service)
):
    review = await review_service.approve_review(review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    await kafka_service.publish_review_approved({
        "id": review.id,
        "product_id": review.product_id,
        "rating": review.rating
    })

    return ReviewResponse(
        id=review.id,
        product_id=review.product_id,
        user_id=review.user_id,
        order_id=review.order_id,
        rating=review.rating,
        title=review.title,
        content=review.content,
        images=review.images,
        verified_purchase=review.verified_purchase,
        status=review.status,
        helpfulness=review.helpfulness,
        seller_response=review.seller_response,
        created_at=review.created_at,
        updated_at=review.updated_at
    )


@router.post("/{review_id}/reject", response_model=ReviewResponse)
async def reject_review(
    review_id: str,
    review_service: ReviewService = Depends(get_review_service)
):
    review = await review_service.reject_review(review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    return ReviewResponse(
        id=review.id,
        product_id=review.product_id,
        user_id=review.user_id,
        order_id=review.order_id,
        rating=review.rating,
        title=review.title,
        content=review.content,
        images=review.images,
        verified_purchase=review.verified_purchase,
        status=review.status,
        helpfulness=review.helpfulness,
        seller_response=review.seller_response,
        created_at=review.created_at,
        updated_at=review.updated_at
    )


@router.post("/{review_id}/seller-response", response_model=ReviewResponse)
async def add_seller_response(
    review_id: str,
    request: SellerResponseRequest,
    review_service: ReviewService = Depends(get_review_service)
):
    review = await review_service.add_seller_response(review_id, request.content)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    return ReviewResponse(
        id=review.id,
        product_id=review.product_id,
        user_id=review.user_id,
        order_id=review.order_id,
        rating=review.rating,
        title=review.title,
        content=review.content,
        images=review.images,
        verified_purchase=review.verified_purchase,
        status=review.status,
        helpfulness=review.helpfulness,
        seller_response=review.seller_response,
        created_at=review.created_at,
        updated_at=review.updated_at
    )
