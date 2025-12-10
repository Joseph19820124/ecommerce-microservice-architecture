package repository

import (
	"context"

	"github.com/ecommerce/payment-service/internal/model"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type PaymentRepository struct {
	db *gorm.DB
}

func NewPaymentRepository(db *gorm.DB) *PaymentRepository {
	return &PaymentRepository{db: db}
}

func (r *PaymentRepository) Create(ctx context.Context, payment *model.Payment) error {
	return r.db.WithContext(ctx).Create(payment).Error
}

func (r *PaymentRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.Payment, error) {
	var payment model.Payment
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&payment).Error
	if err != nil {
		return nil, err
	}
	return &payment, nil
}

func (r *PaymentRepository) GetByOrderID(ctx context.Context, orderID uuid.UUID) (*model.Payment, error) {
	var payment model.Payment
	err := r.db.WithContext(ctx).Where("order_id = ?", orderID).First(&payment).Error
	if err != nil {
		return nil, err
	}
	return &payment, nil
}

func (r *PaymentRepository) GetByUserID(ctx context.Context, userID uuid.UUID, limit, offset int) ([]model.Payment, error) {
	var payments []model.Payment
	err := r.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&payments).Error
	return payments, err
}

func (r *PaymentRepository) Update(ctx context.Context, payment *model.Payment) error {
	return r.db.WithContext(ctx).Save(payment).Error
}

func (r *PaymentRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status model.PaymentStatus) error {
	return r.db.WithContext(ctx).
		Model(&model.Payment{}).
		Where("id = ?", id).
		Update("status", status).Error
}

func (r *PaymentRepository) GetByTransactionID(ctx context.Context, transactionID string) (*model.Payment, error) {
	var payment model.Payment
	err := r.db.WithContext(ctx).Where("transaction_id = ?", transactionID).First(&payment).Error
	if err != nil {
		return nil, err
	}
	return &payment, nil
}

// Refund operations
func (r *PaymentRepository) CreateRefund(ctx context.Context, refund *model.Refund) error {
	return r.db.WithContext(ctx).Create(refund).Error
}

func (r *PaymentRepository) GetRefundByID(ctx context.Context, id uuid.UUID) (*model.Refund, error) {
	var refund model.Refund
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&refund).Error
	if err != nil {
		return nil, err
	}
	return &refund, nil
}

func (r *PaymentRepository) GetRefundsByPaymentID(ctx context.Context, paymentID uuid.UUID) ([]model.Refund, error) {
	var refunds []model.Refund
	err := r.db.WithContext(ctx).Where("payment_id = ?", paymentID).Find(&refunds).Error
	return refunds, err
}

func (r *PaymentRepository) UpdateRefund(ctx context.Context, refund *model.Refund) error {
	return r.db.WithContext(ctx).Save(refund).Error
}
