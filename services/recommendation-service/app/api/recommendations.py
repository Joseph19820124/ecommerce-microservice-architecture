from fastapi import APIRouter, Depends, Query, HTTPException
from typing import List, Optional

from app.schemas.recommendation import (
    RecommendationResponse,
    RecommendedProduct,
    TrackInteractionRequest,
    SimilarProductsRequest,
    PersonalizedRequest
)
from app.models.interaction import UserInteraction
from app.services.recommendation_service import RecommendationService
from app.api.dependencies import get_recommendation_service

router = APIRouter(prefix="/api/v1/recommendations", tags=["recommendations"])


@router.get("/personalized/{user_id}", response_model=RecommendationResponse)
async def get_personalized_recommendations(
    user_id: str,
    limit: int = Query(10, ge=1, le=50),
    exclude_purchased: bool = Query(True),
    service: RecommendationService = Depends(get_recommendation_service)
):
    """Get personalized recommendations for a user"""
    recommendations = await service.get_personalized_recommendations(
        user_id=user_id,
        limit=limit,
        exclude_purchased=exclude_purchased
    )
    return RecommendationResponse(
        user_id=user_id,
        recommendations=recommendations,
        strategy="personalized",
        total=len(recommendations)
    )


@router.get("/similar/{product_id}", response_model=RecommendationResponse)
async def get_similar_products(
    product_id: str,
    limit: int = Query(10, ge=1, le=50),
    service: RecommendationService = Depends(get_recommendation_service)
):
    """Get products similar to the given product"""
    recommendations = await service.get_similar_products(
        product_id=product_id,
        limit=limit
    )
    return RecommendationResponse(
        recommendations=recommendations,
        strategy="similar",
        total=len(recommendations)
    )


@router.get("/trending", response_model=RecommendationResponse)
async def get_trending_products(
    limit: int = Query(10, ge=1, le=50),
    service: RecommendationService = Depends(get_recommendation_service)
):
    """Get trending/popular products"""
    recommendations = await service.get_trending_products(limit=limit)
    return RecommendationResponse(
        recommendations=recommendations,
        strategy="trending",
        total=len(recommendations)
    )


@router.get("/recently-viewed/{user_id}", response_model=RecommendationResponse)
async def get_recently_viewed(
    user_id: str,
    limit: int = Query(10, ge=1, le=50),
    service: RecommendationService = Depends(get_recommendation_service)
):
    """Get user's recently viewed products"""
    recommendations = await service.get_recently_viewed(
        user_id=user_id,
        limit=limit
    )
    return RecommendationResponse(
        user_id=user_id,
        recommendations=recommendations,
        strategy="recently_viewed",
        total=len(recommendations)
    )


@router.post("/frequently-bought-together", response_model=RecommendationResponse)
async def get_frequently_bought_together(
    product_ids: List[str],
    limit: int = Query(5, ge=1, le=20),
    service: RecommendationService = Depends(get_recommendation_service)
):
    """Get products frequently bought together with given products"""
    recommendations = await service.get_frequently_bought_together(
        product_ids=product_ids,
        limit=limit
    )
    return RecommendationResponse(
        recommendations=recommendations,
        strategy="frequently_bought_together",
        total=len(recommendations)
    )


@router.post("/track", status_code=201)
async def track_interaction(
    request: TrackInteractionRequest,
    service: RecommendationService = Depends(get_recommendation_service)
):
    """Track a user interaction with a product"""
    interaction = UserInteraction(
        user_id=request.user_id,
        product_id=request.product_id,
        interaction_type=request.interaction_type,
        metadata=request.metadata
    )
    success = await service.track_interaction(interaction)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to track interaction")
    return {"message": "Interaction tracked successfully"}
