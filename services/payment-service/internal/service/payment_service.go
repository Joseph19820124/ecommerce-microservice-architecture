package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/ecommerce/payment-service/internal/kafka"
	"github.com/ecommerce/payment-service/internal/model"
	"github.com/ecommerce/payment-service/internal/repository"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

var (
	ErrPaymentNotFound    = errors.New("payment not found")
	ErrInvalidAmount      = errors.New("invalid payment amount")
	ErrPaymentAlreadyPaid = errors.New("payment already completed")
	ErrRefundExceedsAmount = errors.New("refund amount exceeds payment amount")
)

type CreatePaymentRequest struct {
	OrderID  uuid.UUID           `json:"orderId" binding:"required"`
	UserID   uuid.UUID           `json:"userId" binding:"required"`
	Amount   int64               `json:"amount" binding:"required,min=1"`
	Currency string              `json:"currency"`
	Method   model.PaymentMethod `json:"method" binding:"required"`
}

type ProcessPaymentRequest struct {
	PaymentID uuid.UUID `json:"paymentId" binding:"required"`
	Token     string    `json:"token"`
}

type RefundRequest struct {
	PaymentID uuid.UUID `json:"paymentId" binding:"required"`
	Amount    int64     `json:"amount" binding:"required,min=1"`
	Reason    string    `json:"reason"`
}

type PaymentService struct {
	repo     *repository.PaymentRepository
	producer *kafka.Producer
	logger   *zap.Logger
}

func NewPaymentService(repo *repository.PaymentRepository, producer *kafka.Producer, logger *zap.Logger) *PaymentService {
	return &PaymentService{
		repo:     repo,
		producer: producer,
		logger:   logger,
	}
}

func (s *PaymentService) CreatePayment(ctx context.Context, req *CreatePaymentRequest) (*model.Payment, error) {
	if req.Amount <= 0 {
		return nil, ErrInvalidAmount
	}

	currency := req.Currency
	if currency == "" {
		currency = "CNY"
	}

	payment := &model.Payment{
		OrderID:  req.OrderID,
		UserID:   req.UserID,
		Amount:   req.Amount,
		Currency: currency,
		Method:   req.Method,
		Status:   model.PaymentStatusPending,
	}

	if err := s.repo.Create(ctx, payment); err != nil {
		s.logger.Error("Failed to create payment", zap.Error(err))
		return nil, err
	}

	s.logger.Info("Payment created",
		zap.String("paymentId", payment.ID.String()),
		zap.String("orderId", payment.OrderID.String()),
	)

	s.publishEvent("PaymentInitiated", map[string]interface{}{
		"paymentId":   payment.ID.String(),
		"orderId":     payment.OrderID.String(),
		"amount":      payment.Amount,
		"currency":    payment.Currency,
		"method":      payment.Method,
		"initiatedAt": time.Now().Format(time.RFC3339),
	})

	return payment, nil
}

func (s *PaymentService) ProcessPayment(ctx context.Context, req *ProcessPaymentRequest) (*model.Payment, error) {
	payment, err := s.repo.GetByID(ctx, req.PaymentID)
	if err != nil {
		return nil, ErrPaymentNotFound
	}

	if payment.Status == model.PaymentStatusCompleted {
		return nil, ErrPaymentAlreadyPaid
	}

	payment.Status = model.PaymentStatusProcessing
	if err := s.repo.Update(ctx, payment); err != nil {
		return nil, err
	}

	// Simulate payment processing
	transactionID := fmt.Sprintf("txn_%s", uuid.New().String()[:8])
	now := time.Now()

	payment.Status = model.PaymentStatusCompleted
	payment.TransactionID = transactionID
	payment.PaidAt = &now

	if err := s.repo.Update(ctx, payment); err != nil {
		s.logger.Error("Failed to update payment", zap.Error(err))
		return nil, err
	}

	s.logger.Info("Payment completed",
		zap.String("paymentId", payment.ID.String()),
		zap.String("transactionId", transactionID),
	)

	s.publishEvent("PaymentCompleted", map[string]interface{}{
		"paymentId":     payment.ID.String(),
		"orderId":       payment.OrderID.String(),
		"transactionId": transactionID,
		"completedAt":   now.Format(time.RFC3339),
	})

	return payment, nil
}

func (s *PaymentService) FailPayment(ctx context.Context, paymentID uuid.UUID, errorCode, errorMsg string) (*model.Payment, error) {
	payment, err := s.repo.GetByID(ctx, paymentID)
	if err != nil {
		return nil, ErrPaymentNotFound
	}

	payment.Status = model.PaymentStatusFailed
	payment.ErrorCode = errorCode
	payment.ErrorMessage = errorMsg

	if err := s.repo.Update(ctx, payment); err != nil {
		return nil, err
	}

	s.logger.Info("Payment failed",
		zap.String("paymentId", payment.ID.String()),
		zap.String("errorCode", errorCode),
	)

	s.publishEvent("PaymentFailed", map[string]interface{}{
		"paymentId":    payment.ID.String(),
		"orderId":      payment.OrderID.String(),
		"errorCode":    errorCode,
		"errorMessage": errorMsg,
		"failedAt":     time.Now().Format(time.RFC3339),
	})

	return payment, nil
}

func (s *PaymentService) GetPayment(ctx context.Context, id uuid.UUID) (*model.Payment, error) {
	payment, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, ErrPaymentNotFound
	}
	return payment, nil
}

func (s *PaymentService) GetPaymentByOrderID(ctx context.Context, orderID uuid.UUID) (*model.Payment, error) {
	payment, err := s.repo.GetByOrderID(ctx, orderID)
	if err != nil {
		return nil, ErrPaymentNotFound
	}
	return payment, nil
}

func (s *PaymentService) GetUserPayments(ctx context.Context, userID uuid.UUID, limit, offset int) ([]model.Payment, error) {
	return s.repo.GetByUserID(ctx, userID, limit, offset)
}

func (s *PaymentService) CreateRefund(ctx context.Context, req *RefundRequest) (*model.Refund, error) {
	payment, err := s.repo.GetByID(ctx, req.PaymentID)
	if err != nil {
		return nil, ErrPaymentNotFound
	}

	if req.Amount > payment.Amount {
		return nil, ErrRefundExceedsAmount
	}

	refund := &model.Refund{
		PaymentID: req.PaymentID,
		Amount:    req.Amount,
		Reason:    req.Reason,
		Status:    "PENDING",
	}

	if err := s.repo.CreateRefund(ctx, refund); err != nil {
		return nil, err
	}

	s.logger.Info("Refund created",
		zap.String("refundId", refund.ID.String()),
		zap.String("paymentId", req.PaymentID.String()),
	)

	s.publishEvent("RefundInitiated", map[string]interface{}{
		"refundId":    refund.ID.String(),
		"paymentId":   payment.ID.String(),
		"orderId":     payment.OrderID.String(),
		"amount":      refund.Amount,
		"reason":      refund.Reason,
		"initiatedAt": time.Now().Format(time.RFC3339),
	})

	return refund, nil
}

func (s *PaymentService) ProcessRefund(ctx context.Context, refundID uuid.UUID) (*model.Refund, error) {
	refund, err := s.repo.GetRefundByID(ctx, refundID)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	refund.Status = "COMPLETED"
	refund.RefundedAt = &now

	if err := s.repo.UpdateRefund(ctx, refund); err != nil {
		return nil, err
	}

	payment, _ := s.repo.GetByID(ctx, refund.PaymentID)

	s.publishEvent("RefundCompleted", map[string]interface{}{
		"refundId":    refund.ID.String(),
		"paymentId":   refund.PaymentID.String(),
		"orderId":     payment.OrderID.String(),
		"completedAt": now.Format(time.RFC3339),
	})

	return refund, nil
}

func (s *PaymentService) publishEvent(eventType string, payload map[string]interface{}) {
	if s.producer == nil {
		return
	}

	event := map[string]interface{}{
		"type":      eventType,
		"payload":   payload,
		"timestamp": time.Now().Format(time.RFC3339),
		"source":    "payment-service",
	}

	if err := s.producer.Publish("payment-events", event); err != nil {
		s.logger.Error("Failed to publish event",
			zap.String("type", eventType),
			zap.Error(err),
		)
	}
}
