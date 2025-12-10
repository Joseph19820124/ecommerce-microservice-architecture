package model

import (
	"time"

	"github.com/google/uuid"
)

type PaymentStatus string

const (
	PaymentStatusPending   PaymentStatus = "PENDING"
	PaymentStatusProcessing PaymentStatus = "PROCESSING"
	PaymentStatusCompleted PaymentStatus = "COMPLETED"
	PaymentStatusFailed    PaymentStatus = "FAILED"
	PaymentStatusCancelled PaymentStatus = "CANCELLED"
	PaymentStatusRefunded  PaymentStatus = "REFUNDED"
)

type PaymentMethod string

const (
	PaymentMethodCard   PaymentMethod = "CARD"
	PaymentMethodPayPal PaymentMethod = "PAYPAL"
	PaymentMethodAlipay PaymentMethod = "ALIPAY"
	PaymentMethodWechat PaymentMethod = "WECHAT"
)

type Payment struct {
	ID              uuid.UUID     `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	OrderID         uuid.UUID     `gorm:"type:uuid;not null;index" json:"orderId"`
	UserID          uuid.UUID     `gorm:"type:uuid;not null;index" json:"userId"`
	Amount          int64         `gorm:"not null" json:"amount"`
	Currency        string        `gorm:"size:3;not null;default:'CNY'" json:"currency"`
	Status          PaymentStatus `gorm:"size:20;not null;default:'PENDING'" json:"status"`
	Method          PaymentMethod `gorm:"size:20;not null" json:"method"`
	TransactionID   string        `gorm:"size:100;index" json:"transactionId,omitempty"`
	StripePaymentID string        `gorm:"size:100" json:"stripePaymentId,omitempty"`
	ErrorCode       string        `gorm:"size:50" json:"errorCode,omitempty"`
	ErrorMessage    string        `gorm:"size:500" json:"errorMessage,omitempty"`
	Metadata        string        `gorm:"type:jsonb" json:"metadata,omitempty"`
	PaidAt          *time.Time    `json:"paidAt,omitempty"`
	CreatedAt       time.Time     `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt       time.Time     `gorm:"autoUpdateTime" json:"updatedAt"`
}

type Refund struct {
	ID          uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	PaymentID   uuid.UUID `gorm:"type:uuid;not null;index" json:"paymentId"`
	Amount      int64     `gorm:"not null" json:"amount"`
	Reason      string    `gorm:"size:500" json:"reason"`
	Status      string    `gorm:"size:20;not null;default:'PENDING'" json:"status"`
	RefundedAt  *time.Time `json:"refundedAt,omitempty"`
	CreatedAt   time.Time  `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt   time.Time  `gorm:"autoUpdateTime" json:"updatedAt"`
}

func (Payment) TableName() string {
	return "payments"
}

func (Refund) TableName() string {
	return "refunds"
}
