package com.ecommerce.product.event;

import com.ecommerce.product.entity.Product;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Component
@RequiredArgsConstructor
@Slf4j
public class ProductEventPublisher {

    private final KafkaTemplate<String, Object> kafkaTemplate;

    private static final String TOPIC = "product-events";

    public void publishProductCreated(Product product) {
        Map<String, Object> event = new HashMap<>();
        event.put("type", "ProductCreated");
        event.put("productId", product.getId().toString());
        event.put("name", product.getName());
        event.put("categoryId", product.getCategory() != null ? product.getCategory().getId().toString() : null);
        event.put("price", product.getPrice());
        event.put("createdAt", LocalDateTime.now().toString());
        event.put("source", "product-service");

        kafkaTemplate.send(TOPIC, product.getId().toString(), event)
                .whenComplete((result, ex) -> {
                    if (ex != null) {
                        log.error("Failed to publish ProductCreated event", ex);
                    } else {
                        log.info("ProductCreated event published for product: {}", product.getId());
                    }
                });
    }

    public void publishProductUpdated(Product product) {
        Map<String, Object> event = new HashMap<>();
        event.put("type", "ProductUpdated");
        event.put("productId", product.getId().toString());
        event.put("name", product.getName());
        event.put("price", product.getPrice());
        event.put("updatedAt", LocalDateTime.now().toString());
        event.put("source", "product-service");

        kafkaTemplate.send(TOPIC, product.getId().toString(), event)
                .whenComplete((result, ex) -> {
                    if (ex != null) {
                        log.error("Failed to publish ProductUpdated event", ex);
                    } else {
                        log.info("ProductUpdated event published for product: {}", product.getId());
                    }
                });
    }

    public void publishProductDeleted(UUID productId) {
        Map<String, Object> event = new HashMap<>();
        event.put("type", "ProductDeleted");
        event.put("productId", productId.toString());
        event.put("deletedAt", LocalDateTime.now().toString());
        event.put("source", "product-service");

        kafkaTemplate.send(TOPIC, productId.toString(), event)
                .whenComplete((result, ex) -> {
                    if (ex != null) {
                        log.error("Failed to publish ProductDeleted event", ex);
                    } else {
                        log.info("ProductDeleted event published for product: {}", productId);
                    }
                });
    }

    public void publishPriceChanged(UUID productId, java.math.BigDecimal oldPrice, java.math.BigDecimal newPrice) {
        Map<String, Object> event = new HashMap<>();
        event.put("type", "PriceChanged");
        event.put("productId", productId.toString());
        event.put("oldPrice", oldPrice);
        event.put("newPrice", newPrice);
        event.put("changedAt", LocalDateTime.now().toString());
        event.put("source", "product-service");

        kafkaTemplate.send(TOPIC, productId.toString(), event)
                .whenComplete((result, ex) -> {
                    if (ex != null) {
                        log.error("Failed to publish PriceChanged event", ex);
                    } else {
                        log.info("PriceChanged event published for product: {}", productId);
                    }
                });
    }
}
