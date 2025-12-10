package com.ecommerce.order.controller;

import com.ecommerce.order.dto.CreateOrderRequest;
import com.ecommerce.order.dto.OrderDTO;
import com.ecommerce.order.entity.OrderStatus;
import com.ecommerce.order.service.OrderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/orders")
@RequiredArgsConstructor
@Slf4j
public class OrderController {

    private final OrderService orderService;

    @PostMapping
    public ResponseEntity<OrderDTO> createOrder(@Valid @RequestBody CreateOrderRequest request) {
        log.info("Creating order for user: {}", request.getUserId());
        OrderDTO order = orderService.createOrder(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(order);
    }

    @GetMapping("/{id}")
    public ResponseEntity<OrderDTO> getOrderById(@PathVariable UUID id) {
        log.debug("Getting order by ID: {}", id);
        OrderDTO order = orderService.getOrderById(id);
        return ResponseEntity.ok(order);
    }

    @GetMapping("/number/{orderNumber}")
    public ResponseEntity<OrderDTO> getOrderByNumber(@PathVariable String orderNumber) {
        log.debug("Getting order by number: {}", orderNumber);
        OrderDTO order = orderService.getOrderByOrderNumber(orderNumber);
        return ResponseEntity.ok(order);
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<Page<OrderDTO>> getUserOrders(
            @PathVariable UUID userId,
            @PageableDefault(size = 10, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        log.debug("Getting orders for user: {}", userId);
        Page<OrderDTO> orders = orderService.getUserOrders(userId, pageable);
        return ResponseEntity.ok(orders);
    }

    @GetMapping("/user/{userId}/status/{status}")
    public ResponseEntity<Page<OrderDTO>> getUserOrdersByStatus(
            @PathVariable UUID userId,
            @PathVariable OrderStatus status,
            @PageableDefault(size = 10, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        log.debug("Getting orders for user: {} with status: {}", userId, status);
        Page<OrderDTO> orders = orderService.getUserOrdersByStatus(userId, status, pageable);
        return ResponseEntity.ok(orders);
    }

    @PostMapping("/{id}/confirm")
    public ResponseEntity<OrderDTO> confirmOrder(@PathVariable UUID id) {
        log.info("Confirming order: {}", id);
        OrderDTO order = orderService.confirmOrder(id);
        return ResponseEntity.ok(order);
    }

    @PostMapping("/{id}/pay")
    public ResponseEntity<OrderDTO> markAsPaid(
            @PathVariable UUID id,
            @RequestBody Map<String, UUID> payload) {
        UUID paymentId = payload.get("paymentId");
        if (paymentId == null) {
            throw new IllegalArgumentException("paymentId is required");
        }
        log.info("Marking order {} as paid with payment: {}", id, paymentId);
        OrderDTO order = orderService.markAsPaid(id, paymentId);
        return ResponseEntity.ok(order);
    }

    @PostMapping("/{id}/ship")
    public ResponseEntity<OrderDTO> shipOrder(
            @PathVariable UUID id,
            @RequestBody Map<String, String> payload) {
        String trackingNumber = payload.get("trackingNumber");
        if (trackingNumber == null || trackingNumber.isBlank()) {
            throw new IllegalArgumentException("trackingNumber is required");
        }
        log.info("Shipping order: {} with tracking: {}", id, trackingNumber);
        OrderDTO order = orderService.shipOrder(id, trackingNumber);
        return ResponseEntity.ok(order);
    }

    @PostMapping("/{id}/deliver")
    public ResponseEntity<OrderDTO> deliverOrder(@PathVariable UUID id) {
        log.info("Marking order as delivered: {}", id);
        OrderDTO order = orderService.deliverOrder(id);
        return ResponseEntity.ok(order);
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<OrderDTO> cancelOrder(
            @PathVariable UUID id,
            @RequestBody Map<String, String> payload) {
        String reason = payload.get("reason");
        log.info("Cancelling order: {} with reason: {}", id, reason);
        OrderDTO order = orderService.cancelOrder(id, reason);
        return ResponseEntity.ok(order);
    }
}
