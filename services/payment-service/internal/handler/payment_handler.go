package handler

import (
	"github.com/ecommerce/payment-service/internal/service"
	"github.com/ecommerce/payment-service/pkg/response"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type PaymentHandler struct {
	svc *service.PaymentService
}

func NewPaymentHandler(svc *service.PaymentService) *PaymentHandler {
	return &PaymentHandler{svc: svc}
}

func (h *PaymentHandler) CreatePayment(c *gin.Context) {
	var req service.CreatePaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	payment, err := h.svc.CreatePayment(c.Request.Context(), &req)
	if err != nil {
		if err == service.ErrInvalidAmount {
			response.BadRequest(c, err.Error())
			return
		}
		response.InternalError(c, "Failed to create payment")
		return
	}

	response.Created(c, payment)
}

func (h *PaymentHandler) ProcessPayment(c *gin.Context) {
	var req service.ProcessPaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	payment, err := h.svc.ProcessPayment(c.Request.Context(), &req)
	if err != nil {
		switch err {
		case service.ErrPaymentNotFound:
			response.NotFound(c, err.Error())
		case service.ErrPaymentAlreadyPaid:
			response.Conflict(c, err.Error())
		default:
			response.InternalError(c, "Failed to process payment")
		}
		return
	}

	response.Success(c, payment)
}

func (h *PaymentHandler) GetPayment(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		response.BadRequest(c, "Invalid payment ID")
		return
	}

	payment, err := h.svc.GetPayment(c.Request.Context(), id)
	if err != nil {
		response.NotFound(c, "Payment not found")
		return
	}

	response.Success(c, payment)
}

func (h *PaymentHandler) GetPaymentByOrderID(c *gin.Context) {
	orderIDStr := c.Param("orderId")
	orderID, err := uuid.Parse(orderIDStr)
	if err != nil {
		response.BadRequest(c, "Invalid order ID")
		return
	}

	payment, err := h.svc.GetPaymentByOrderID(c.Request.Context(), orderID)
	if err != nil {
		response.NotFound(c, "Payment not found")
		return
	}

	response.Success(c, payment)
}

func (h *PaymentHandler) GetUserPayments(c *gin.Context) {
	userIDStr := c.Param("userId")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		response.BadRequest(c, "Invalid user ID")
		return
	}

	limit := 20
	offset := 0

	payments, err := h.svc.GetUserPayments(c.Request.Context(), userID, limit, offset)
	if err != nil {
		response.InternalError(c, "Failed to get payments")
		return
	}

	response.Success(c, payments)
}

func (h *PaymentHandler) GetPaymentStatus(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		response.BadRequest(c, "Invalid payment ID")
		return
	}

	payment, err := h.svc.GetPayment(c.Request.Context(), id)
	if err != nil {
		response.NotFound(c, "Payment not found")
		return
	}

	response.Success(c, gin.H{
		"paymentId": payment.ID,
		"status":    payment.Status,
		"paidAt":    payment.PaidAt,
	})
}

func (h *PaymentHandler) CreateRefund(c *gin.Context) {
	var req service.RefundRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	refund, err := h.svc.CreateRefund(c.Request.Context(), &req)
	if err != nil {
		switch err {
		case service.ErrPaymentNotFound:
			response.NotFound(c, err.Error())
		case service.ErrRefundExceedsAmount:
			response.BadRequest(c, err.Error())
		default:
			response.InternalError(c, "Failed to create refund")
		}
		return
	}

	response.Created(c, refund)
}

func (h *PaymentHandler) ProcessRefund(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		response.BadRequest(c, "Invalid refund ID")
		return
	}

	refund, err := h.svc.ProcessRefund(c.Request.Context(), id)
	if err != nil {
		response.InternalError(c, "Failed to process refund")
		return
	}

	response.Success(c, refund)
}
