package model

import (
	"time"

	"github.com/google/uuid"
)

type Inventory struct {
	ID            uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	ProductID     uuid.UUID `gorm:"type:uuid;not null;uniqueIndex" json:"productId"`
	SKU           string    `gorm:"size:50;not null;uniqueIndex" json:"sku"`
	Quantity      int       `gorm:"not null;default:0" json:"quantity"`
	ReservedQty   int       `gorm:"not null;default:0" json:"reservedQty"`
	AvailableQty  int       `gorm:"not null;default:0" json:"availableQty"`
	LowStockAlert int       `gorm:"not null;default:10" json:"lowStockAlert"`
	WarehouseID   string    `gorm:"size:50;default:'DEFAULT'" json:"warehouseId"`
	Location      string    `gorm:"size:100" json:"location,omitempty"`
	CreatedAt     time.Time `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt     time.Time `gorm:"autoUpdateTime" json:"updatedAt"`
}

type Reservation struct {
	ID          uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	OrderID     uuid.UUID `gorm:"type:uuid;not null;index" json:"orderId"`
	ProductID   uuid.UUID `gorm:"type:uuid;not null;index" json:"productId"`
	SKU         string    `gorm:"size:50;not null" json:"sku"`
	Quantity    int       `gorm:"not null" json:"quantity"`
	Status      string    `gorm:"size:20;not null;default:'RESERVED'" json:"status"`
	ExpiresAt   time.Time `gorm:"not null" json:"expiresAt"`
	ConfirmedAt *time.Time `json:"confirmedAt,omitempty"`
	ReleasedAt  *time.Time `json:"releasedAt,omitempty"`
	CreatedAt   time.Time  `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt   time.Time  `gorm:"autoUpdateTime" json:"updatedAt"`
}

type StockMovement struct {
	ID          uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	ProductID   uuid.UUID `gorm:"type:uuid;not null;index" json:"productId"`
	SKU         string    `gorm:"size:50;not null" json:"sku"`
	Type        string    `gorm:"size:20;not null" json:"type"`
	Quantity    int       `gorm:"not null" json:"quantity"`
	Reference   string    `gorm:"size:100" json:"reference,omitempty"`
	Reason      string    `gorm:"size:500" json:"reason,omitempty"`
	CreatedAt   time.Time `gorm:"autoCreateTime" json:"createdAt"`
}

func (Inventory) TableName() string {
	return "inventories"
}

func (Reservation) TableName() string {
	return "reservations"
}

func (StockMovement) TableName() string {
	return "stock_movements"
}

const (
	ReservationStatusReserved  = "RESERVED"
	ReservationStatusConfirmed = "CONFIRMED"
	ReservationStatusReleased  = "RELEASED"
	ReservationStatusExpired   = "EXPIRED"

	MovementTypeIn       = "IN"
	MovementTypeOut      = "OUT"
	MovementTypeReserve  = "RESERVE"
	MovementTypeRelease  = "RELEASE"
	MovementTypeAdjust   = "ADJUST"
)
