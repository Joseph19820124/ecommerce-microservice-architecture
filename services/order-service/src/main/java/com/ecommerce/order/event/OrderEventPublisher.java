package com.ecommerce.order.event;

import com.ecommerce.order.entity.Order;
import com.ecommerce.order.entity.OrderItem;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
@Slf4j
public class OrderEventPublisher {

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    private static final String ORDER_EVENTS_TOPIC = "order-events";
    private static final String INVENTORY_EVENTS_TOPIC = "inventory-events";
    private static final String NOTIFICATION_EVENTS_TOPIC = "notification-events";

    public void publishOrderCreated(Order order) {
        try {
            Map<String, Object> event = buildBaseEvent("OrderCreated", order);
            event.put("items", buildItemsList(order.getItems()));
            event.put("shippingAddress", buildShippingAddress(order));

            String message = objectMapper.writeValueAsString(event);
            kafkaTemplate.send(ORDER_EVENTS_TOPIC, order.getId().toString(), message);

            // Also publish inventory reservation request
            publishInventoryReservationRequest(order);

            log.info("Published OrderCreated event for order: {}", order.getOrderNumber());
        } catch (Exception e) {
            log.error("Failed to publish OrderCreated event for order: {}", order.getOrderNumber(), e);
        }
    }

    public void publishOrderConfirmed(Order order) {
        try {
            Map<String, Object> event = buildBaseEvent("OrderConfirmed", order);

            String message = objectMapper.writeValueAsString(event);
            kafkaTemplate.send(ORDER_EVENTS_TOPIC, order.getId().toString(), message);

            // Send notification
            publishNotification(order, "ORDER_CONFIRMED",
                    "Your order " + order.getOrderNumber() + " has been confirmed");

            log.info("Published OrderConfirmed event for order: {}", order.getOrderNumber());
        } catch (Exception e) {
            log.error("Failed to publish OrderConfirmed event for order: {}", order.getOrderNumber(), e);
        }
    }

    public void publishOrderShipped(Order order, String trackingNumber) {
        try {
            Map<String, Object> event = buildBaseEvent("OrderShipped", order);
            event.put("trackingNumber", trackingNumber);
            event.put("shippedAt", order.getShippedAt().toString());

            String message = objectMapper.writeValueAsString(event);
            kafkaTemplate.send(ORDER_EVENTS_TOPIC, order.getId().toString(), message);

            // Send notification
            publishNotification(order, "ORDER_SHIPPED",
                    "Your order " + order.getOrderNumber() + " has been shipped. Tracking: " + trackingNumber);

            log.info("Published OrderShipped event for order: {}", order.getOrderNumber());
        } catch (Exception e) {
            log.error("Failed to publish OrderShipped event for order: {}", order.getOrderNumber(), e);
        }
    }

    public void publishOrderDelivered(Order order) {
        try {
            Map<String, Object> event = buildBaseEvent("OrderDelivered", order);
            event.put("deliveredAt", order.getDeliveredAt().toString());

            String message = objectMapper.writeValueAsString(event);
            kafkaTemplate.send(ORDER_EVENTS_TOPIC, order.getId().toString(), message);

            // Send notification
            publishNotification(order, "ORDER_DELIVERED",
                    "Your order " + order.getOrderNumber() + " has been delivered");

            log.info("Published OrderDelivered event for order: {}", order.getOrderNumber());
        } catch (Exception e) {
            log.error("Failed to publish OrderDelivered event for order: {}", order.getOrderNumber(), e);
        }
    }

    public void publishOrderCancelled(Order order) {
        try {
            Map<String, Object> event = buildBaseEvent("OrderCancelled", order);
            event.put("cancelledAt", order.getCancelledAt().toString());
            event.put("cancelReason", order.getCancelReason());
            event.put("items", buildItemsList(order.getItems()));

            String message = objectMapper.writeValueAsString(event);
            kafkaTemplate.send(ORDER_EVENTS_TOPIC, order.getId().toString(), message);

            // Release inventory reservation
            publishInventoryReleaseRequest(order);

            // Send notification
            publishNotification(order, "ORDER_CANCELLED",
                    "Your order " + order.getOrderNumber() + " has been cancelled");

            log.info("Published OrderCancelled event for order: {}", order.getOrderNumber());
        } catch (Exception e) {
            log.error("Failed to publish OrderCancelled event for order: {}", order.getOrderNumber(), e);
        }
    }

    private void publishInventoryReservationRequest(Order order) {
        try {
            Map<String, Object> event = new HashMap<>();
            event.put("eventType", "InventoryReservationRequested");
            event.put("eventId", UUID.randomUUID().toString());
            event.put("timestamp", LocalDateTime.now().toString());
            event.put("orderId", order.getId().toString());
            event.put("orderNumber", order.getOrderNumber());
            event.put("items", order.getItems().stream().map(item -> {
                Map<String, Object> itemMap = new HashMap<>();
                itemMap.put("productId", item.getProductId().toString());
                itemMap.put("sku", item.getSku());
                itemMap.put("quantity", item.getQuantity());
                return itemMap;
            }).collect(Collectors.toList()));

            String message = objectMapper.writeValueAsString(event);
            kafkaTemplate.send(INVENTORY_EVENTS_TOPIC, order.getId().toString(), message);

            log.info("Published InventoryReservationRequested event for order: {}", order.getOrderNumber());
        } catch (Exception e) {
            log.error("Failed to publish InventoryReservationRequested event for order: {}", order.getOrderNumber(), e);
        }
    }

    private void publishInventoryReleaseRequest(Order order) {
        try {
            Map<String, Object> event = new HashMap<>();
            event.put("eventType", "InventoryReleaseRequested");
            event.put("eventId", UUID.randomUUID().toString());
            event.put("timestamp", LocalDateTime.now().toString());
            event.put("orderId", order.getId().toString());
            event.put("orderNumber", order.getOrderNumber());
            event.put("items", order.getItems().stream().map(item -> {
                Map<String, Object> itemMap = new HashMap<>();
                itemMap.put("productId", item.getProductId().toString());
                itemMap.put("sku", item.getSku());
                itemMap.put("quantity", item.getQuantity());
                return itemMap;
            }).collect(Collectors.toList()));

            String message = objectMapper.writeValueAsString(event);
            kafkaTemplate.send(INVENTORY_EVENTS_TOPIC, order.getId().toString(), message);

            log.info("Published InventoryReleaseRequested event for order: {}", order.getOrderNumber());
        } catch (Exception e) {
            log.error("Failed to publish InventoryReleaseRequested event for order: {}", order.getOrderNumber(), e);
        }
    }

    private void publishNotification(Order order, String type, String message) {
        try {
            Map<String, Object> event = new HashMap<>();
            event.put("eventType", "NotificationRequested");
            event.put("eventId", UUID.randomUUID().toString());
            event.put("timestamp", LocalDateTime.now().toString());
            event.put("userId", order.getUserId().toString());
            event.put("notificationType", type);
            event.put("channel", "EMAIL");
            event.put("subject", "Order Update - " + order.getOrderNumber());
            event.put("message", message);
            event.put("metadata", Map.of(
                    "orderId", order.getId().toString(),
                    "orderNumber", order.getOrderNumber()
            ));

            String jsonMessage = objectMapper.writeValueAsString(event);
            kafkaTemplate.send(NOTIFICATION_EVENTS_TOPIC, order.getUserId().toString(), jsonMessage);

            log.debug("Published notification for order: {}", order.getOrderNumber());
        } catch (Exception e) {
            log.error("Failed to publish notification for order: {}", order.getOrderNumber(), e);
        }
    }

    private Map<String, Object> buildBaseEvent(String eventType, Order order) {
        Map<String, Object> event = new HashMap<>();
        event.put("eventType", eventType);
        event.put("eventId", UUID.randomUUID().toString());
        event.put("timestamp", LocalDateTime.now().toString());
        event.put("orderId", order.getId().toString());
        event.put("orderNumber", order.getOrderNumber());
        event.put("userId", order.getUserId().toString());
        event.put("status", order.getStatus().name());
        event.put("totalAmount", order.getTotalAmount());
        event.put("currency", order.getCurrency());
        return event;
    }

    private List<Map<String, Object>> buildItemsList(List<OrderItem> items) {
        return items.stream().map(item -> {
            Map<String, Object> itemMap = new HashMap<>();
            itemMap.put("id", item.getId().toString());
            itemMap.put("productId", item.getProductId().toString());
            itemMap.put("sku", item.getSku());
            itemMap.put("productName", item.getProductName());
            itemMap.put("unitPrice", item.getUnitPrice());
            itemMap.put("quantity", item.getQuantity());
            itemMap.put("totalPrice", item.getTotalPrice());
            return itemMap;
        }).collect(Collectors.toList());
    }

    private Map<String, Object> buildShippingAddress(Order order) {
        if (order.getShippingAddress() == null) {
            return null;
        }
        Map<String, Object> address = new HashMap<>();
        address.put("recipientName", order.getShippingAddress().getRecipientName());
        address.put("recipientPhone", order.getShippingAddress().getRecipientPhone());
        address.put("streetAddress", order.getShippingAddress().getStreetAddress());
        address.put("city", order.getShippingAddress().getCity());
        address.put("state", order.getShippingAddress().getState());
        address.put("postalCode", order.getShippingAddress().getPostalCode());
        address.put("country", order.getShippingAddress().getCountry());
        return address;
    }
}
