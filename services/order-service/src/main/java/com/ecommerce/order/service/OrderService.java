package com.ecommerce.order.service;

import com.ecommerce.order.dto.CreateOrderRequest;
import com.ecommerce.order.dto.OrderDTO;
import com.ecommerce.order.entity.*;
import com.ecommerce.order.event.OrderEventPublisher;
import com.ecommerce.order.exception.OrderNotFoundException;
import com.ecommerce.order.exception.InvalidOrderStateException;
import com.ecommerce.order.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Random;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class OrderService {

    private final OrderRepository orderRepository;
    private final OrderEventPublisher eventPublisher;

    @Transactional
    public OrderDTO createOrder(CreateOrderRequest request) {
        Order order = Order.builder()
                .orderNumber(generateOrderNumber())
                .userId(request.getUserId())
                .status(OrderStatus.PENDING)
                .shippingFee(request.getShippingFee() != null ? request.getShippingFee() : BigDecimal.ZERO)
                .couponCode(request.getCouponCode())
                .notes(request.getNotes())
                .shippingAddress(ShippingAddress.builder()
                        .recipientName(request.getShippingAddress().getRecipientName())
                        .recipientPhone(request.getShippingAddress().getRecipientPhone())
                        .streetAddress(request.getShippingAddress().getStreetAddress())
                        .city(request.getShippingAddress().getCity())
                        .state(request.getShippingAddress().getState())
                        .postalCode(request.getShippingAddress().getPostalCode())
                        .country(request.getShippingAddress().getCountry() != null ?
                                request.getShippingAddress().getCountry() : "CN")
                        .build())
                .build();

        for (CreateOrderRequest.OrderItemRequest itemRequest : request.getItems()) {
            OrderItem item = OrderItem.builder()
                    .productId(itemRequest.getProductId())
                    .sku(itemRequest.getSku())
                    .productName(itemRequest.getProductName())
                    .productImage(itemRequest.getProductImage())
                    .unitPrice(itemRequest.getUnitPrice())
                    .quantity(itemRequest.getQuantity())
                    .build();
            item.calculateTotalPrice();
            order.addItem(item);
        }

        order.calculateTotals();
        Order saved = orderRepository.save(order);

        log.info("Order created: {}", saved.getOrderNumber());
        eventPublisher.publishOrderCreated(saved);

        return mapToDTO(saved);
    }

    @Transactional(readOnly = true)
    public OrderDTO getOrderById(UUID id) {
        Order order = orderRepository.findById(id)
                .orElseThrow(() -> new OrderNotFoundException("Order not found"));
        return mapToDTO(order);
    }

    @Transactional(readOnly = true)
    public OrderDTO getOrderByOrderNumber(String orderNumber) {
        Order order = orderRepository.findByOrderNumber(orderNumber)
                .orElseThrow(() -> new OrderNotFoundException("Order not found"));
        return mapToDTO(order);
    }

    @Transactional(readOnly = true)
    public Page<OrderDTO> getUserOrders(UUID userId, Pageable pageable) {
        return orderRepository.findByUserId(userId, pageable).map(this::mapToDTO);
    }

    @Transactional(readOnly = true)
    public Page<OrderDTO> getUserOrdersByStatus(UUID userId, OrderStatus status, Pageable pageable) {
        return orderRepository.findByUserIdAndStatus(userId, status, pageable).map(this::mapToDTO);
    }

    @Transactional
    public OrderDTO confirmOrder(UUID orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new OrderNotFoundException("Order not found"));

        if (order.getStatus() != OrderStatus.PENDING) {
            throw new InvalidOrderStateException("Order cannot be confirmed in current state");
        }

        order.setStatus(OrderStatus.CONFIRMED);
        Order saved = orderRepository.save(order);

        log.info("Order confirmed: {}", order.getOrderNumber());
        eventPublisher.publishOrderConfirmed(saved);

        return mapToDTO(saved);
    }

    @Transactional
    public OrderDTO markAsPaid(UUID orderId, UUID paymentId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new OrderNotFoundException("Order not found"));

        order.setPaymentId(paymentId);
        order.setPaidAt(LocalDateTime.now());
        order.setStatus(OrderStatus.PROCESSING);
        Order saved = orderRepository.save(order);

        log.info("Order marked as paid: {}", order.getOrderNumber());

        return mapToDTO(saved);
    }

    @Transactional
    public OrderDTO shipOrder(UUID orderId, String trackingNumber) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new OrderNotFoundException("Order not found"));

        if (order.getStatus() != OrderStatus.PROCESSING && order.getStatus() != OrderStatus.CONFIRMED) {
            throw new InvalidOrderStateException("Order cannot be shipped in current state");
        }

        order.setStatus(OrderStatus.SHIPPED);
        order.setShippedAt(LocalDateTime.now());
        Order saved = orderRepository.save(order);

        log.info("Order shipped: {}", order.getOrderNumber());
        eventPublisher.publishOrderShipped(saved, trackingNumber);

        return mapToDTO(saved);
    }

    @Transactional
    public OrderDTO deliverOrder(UUID orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new OrderNotFoundException("Order not found"));

        if (order.getStatus() != OrderStatus.SHIPPED) {
            throw new InvalidOrderStateException("Order cannot be marked as delivered in current state");
        }

        order.setStatus(OrderStatus.DELIVERED);
        order.setDeliveredAt(LocalDateTime.now());
        Order saved = orderRepository.save(order);

        log.info("Order delivered: {}", order.getOrderNumber());
        eventPublisher.publishOrderDelivered(saved);

        return mapToDTO(saved);
    }

    @Transactional
    public OrderDTO cancelOrder(UUID orderId, String reason) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new OrderNotFoundException("Order not found"));

        if (order.getStatus() == OrderStatus.SHIPPED ||
            order.getStatus() == OrderStatus.DELIVERED ||
            order.getStatus() == OrderStatus.CANCELLED) {
            throw new InvalidOrderStateException("Order cannot be cancelled in current state");
        }

        order.setStatus(OrderStatus.CANCELLED);
        order.setCancelledAt(LocalDateTime.now());
        order.setCancelReason(reason);
        Order saved = orderRepository.save(order);

        log.info("Order cancelled: {}", order.getOrderNumber());
        eventPublisher.publishOrderCancelled(saved);

        return mapToDTO(saved);
    }

    private String generateOrderNumber() {
        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));
        String random = String.format("%04d", new Random().nextInt(10000));
        return "ORD" + timestamp + random;
    }

    private OrderDTO mapToDTO(Order order) {
        return OrderDTO.builder()
                .id(order.getId())
                .orderNumber(order.getOrderNumber())
                .userId(order.getUserId())
                .status(order.getStatus())
                .subtotal(order.getSubtotal())
                .shippingFee(order.getShippingFee())
                .taxAmount(order.getTaxAmount())
                .discountAmount(order.getDiscountAmount())
                .totalAmount(order.getTotalAmount())
                .currency(order.getCurrency())
                .couponCode(order.getCouponCode())
                .shippingAddress(order.getShippingAddress() != null ?
                        OrderDTO.ShippingAddressDTO.builder()
                                .recipientName(order.getShippingAddress().getRecipientName())
                                .recipientPhone(order.getShippingAddress().getRecipientPhone())
                                .streetAddress(order.getShippingAddress().getStreetAddress())
                                .city(order.getShippingAddress().getCity())
                                .state(order.getShippingAddress().getState())
                                .postalCode(order.getShippingAddress().getPostalCode())
                                .country(order.getShippingAddress().getCountry())
                                .build() : null)
                .notes(order.getNotes())
                .items(order.getItems().stream().map(item ->
                        OrderDTO.OrderItemDTO.builder()
                                .id(item.getId())
                                .productId(item.getProductId())
                                .sku(item.getSku())
                                .productName(item.getProductName())
                                .productImage(item.getProductImage())
                                .unitPrice(item.getUnitPrice())
                                .quantity(item.getQuantity())
                                .totalPrice(item.getTotalPrice())
                                .build()
                ).collect(Collectors.toList()))
                .paymentId(order.getPaymentId())
                .paidAt(order.getPaidAt())
                .shippedAt(order.getShippedAt())
                .deliveredAt(order.getDeliveredAt())
                .cancelledAt(order.getCancelledAt())
                .cancelReason(order.getCancelReason())
                .createdAt(order.getCreatedAt())
                .updatedAt(order.getUpdatedAt())
                .build();
    }
}
