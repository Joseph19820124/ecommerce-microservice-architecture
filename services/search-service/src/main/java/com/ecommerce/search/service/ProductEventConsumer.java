package com.ecommerce.search.service;

import com.ecommerce.search.document.ProductDocument;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class ProductEventConsumer {

    private final ProductSearchService productSearchService;
    private final ObjectMapper objectMapper;

    @KafkaListener(topics = "product-events", groupId = "search-service-group")
    public void handleProductEvent(String message) {
        try {
            JsonNode event = objectMapper.readTree(message);
            String eventType = event.get("eventType").asText();
            JsonNode data = event.get("data");

            log.info("Received product event: {}", eventType);

            switch (eventType) {
                case "ProductCreated", "ProductUpdated" -> handleProductUpsert(data);
                case "ProductDeleted" -> handleProductDeleted(data);
                case "ProductStockUpdated" -> handleStockUpdated(data);
                default -> log.warn("Unknown event type: {}", eventType);
            }
        } catch (Exception e) {
            log.error("Failed to process product event: {}", e.getMessage(), e);
        }
    }

    @KafkaListener(topics = "review-events", groupId = "search-service-group")
    public void handleReviewEvent(String message) {
        try {
            JsonNode event = objectMapper.readTree(message);
            String eventType = event.get("eventType").asText();
            JsonNode data = event.get("data");

            if ("ReviewApproved".equals(eventType)) {
                String productId = data.get("product_id").asText();
                // Fetch updated rating from product service or calculate
                // For now, just log
                log.info("Review approved for product: {}", productId);
            }
        } catch (Exception e) {
            log.error("Failed to process review event: {}", e.getMessage(), e);
        }
    }

    private void handleProductUpsert(JsonNode data) {
        try {
            ProductDocument product = ProductDocument.builder()
                    .id(data.get("id").asText())
                    .name(data.get("name").asText())
                    .description(data.has("description") ? data.get("description").asText() : null)
                    .slug(data.has("slug") ? data.get("slug").asText() : null)
                    .sku(data.has("sku") ? data.get("sku").asText() : null)
                    .price(data.has("price") ? new BigDecimal(data.get("price").asText()) : null)
                    .originalPrice(data.has("originalPrice") ? new BigDecimal(data.get("originalPrice").asText()) : null)
                    .currency(data.has("currency") ? data.get("currency").asText() : "USD")
                    .categoryId(data.has("categoryId") ? data.get("categoryId").asText() : null)
                    .categoryName(data.has("categoryName") ? data.get("categoryName").asText() : null)
                    .brandId(data.has("brandId") ? data.get("brandId").asText() : null)
                    .brandName(data.has("brandName") ? data.get("brandName").asText() : null)
                    .imageUrl(data.has("imageUrl") ? data.get("imageUrl").asText() : null)
                    .averageRating(data.has("averageRating") ? data.get("averageRating").floatValue() : 0f)
                    .reviewCount(data.has("reviewCount") ? data.get("reviewCount").intValue() : 0)
                    .salesCount(data.has("salesCount") ? data.get("salesCount").intValue() : 0)
                    .stockQuantity(data.has("stockQuantity") ? data.get("stockQuantity").intValue() : 0)
                    .inStock(data.has("inStock") ? data.get("inStock").booleanValue() : true)
                    .featured(data.has("featured") ? data.get("featured").booleanValue() : false)
                    .active(data.has("active") ? data.get("active").booleanValue() : true)
                    .createdAt(LocalDateTime.now())
                    .updatedAt(LocalDateTime.now())
                    .build();

            // Parse tags
            if (data.has("tags") && data.get("tags").isArray()) {
                List<String> tags = new ArrayList<>();
                data.get("tags").forEach(tag -> tags.add(tag.asText()));
                product.setTags(tags);
            }

            // Parse image URLs
            if (data.has("imageUrls") && data.get("imageUrls").isArray()) {
                List<String> imageUrls = new ArrayList<>();
                data.get("imageUrls").forEach(url -> imageUrls.add(url.asText()));
                product.setImageUrls(imageUrls);
            }

            productSearchService.indexProduct(product);
            log.info("Indexed product: {}", product.getId());
        } catch (Exception e) {
            log.error("Failed to index product: {}", e.getMessage(), e);
        }
    }

    private void handleProductDeleted(JsonNode data) {
        String productId = data.get("id").asText();
        productSearchService.deleteProduct(productId);
        log.info("Deleted product from index: {}", productId);
    }

    private void handleStockUpdated(JsonNode data) {
        String productId = data.get("productId").asText();
        int quantity = data.get("quantity").intValue();
        boolean inStock = quantity > 0;

        productSearchService.getProductById(productId).ifPresent(product -> {
            product.setStockQuantity(quantity);
            product.setInStock(inStock);
            product.setUpdatedAt(LocalDateTime.now());
            productSearchService.updateProduct(product);
            log.info("Updated stock for product: {}", productId);
        });
    }
}
