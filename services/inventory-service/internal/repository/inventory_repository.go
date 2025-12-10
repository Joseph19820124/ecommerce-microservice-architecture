package repository

import (
	"context"

	"github.com/ecommerce/inventory-service/internal/model"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type InventoryRepository struct {
	db *gorm.DB
}

func NewInventoryRepository(db *gorm.DB) *InventoryRepository {
	return &InventoryRepository{db: db}
}

func (r *InventoryRepository) Create(ctx context.Context, inv *model.Inventory) error {
	return r.db.WithContext(ctx).Create(inv).Error
}

func (r *InventoryRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.Inventory, error) {
	var inv model.Inventory
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&inv).Error
	if err != nil {
		return nil, err
	}
	return &inv, nil
}

func (r *InventoryRepository) GetByProductID(ctx context.Context, productID uuid.UUID) (*model.Inventory, error) {
	var inv model.Inventory
	err := r.db.WithContext(ctx).Where("product_id = ?", productID).First(&inv).Error
	if err != nil {
		return nil, err
	}
	return &inv, nil
}

func (r *InventoryRepository) GetBySKU(ctx context.Context, sku string) (*model.Inventory, error) {
	var inv model.Inventory
	err := r.db.WithContext(ctx).Where("sku = ?", sku).First(&inv).Error
	if err != nil {
		return nil, err
	}
	return &inv, nil
}

func (r *InventoryRepository) Update(ctx context.Context, inv *model.Inventory) error {
	return r.db.WithContext(ctx).Save(inv).Error
}

func (r *InventoryRepository) UpdateWithLock(ctx context.Context, id uuid.UUID, updateFn func(*model.Inventory) error) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var inv model.Inventory
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ?", id).First(&inv).Error; err != nil {
			return err
		}

		if err := updateFn(&inv); err != nil {
			return err
		}

		return tx.Save(&inv).Error
	})
}

func (r *InventoryRepository) GetLowStockItems(ctx context.Context) ([]model.Inventory, error) {
	var items []model.Inventory
	err := r.db.WithContext(ctx).
		Where("available_qty <= low_stock_alert").
		Find(&items).Error
	return items, err
}

func (r *InventoryRepository) GetAll(ctx context.Context, limit, offset int) ([]model.Inventory, error) {
	var items []model.Inventory
	err := r.db.WithContext(ctx).
		Limit(limit).
		Offset(offset).
		Order("created_at DESC").
		Find(&items).Error
	return items, err
}

// Reservation methods
func (r *InventoryRepository) CreateReservation(ctx context.Context, res *model.Reservation) error {
	return r.db.WithContext(ctx).Create(res).Error
}

func (r *InventoryRepository) GetReservationByID(ctx context.Context, id uuid.UUID) (*model.Reservation, error) {
	var res model.Reservation
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&res).Error
	if err != nil {
		return nil, err
	}
	return &res, nil
}

func (r *InventoryRepository) GetReservationsByOrderID(ctx context.Context, orderID uuid.UUID) ([]model.Reservation, error) {
	var reservations []model.Reservation
	err := r.db.WithContext(ctx).Where("order_id = ?", orderID).Find(&reservations).Error
	return reservations, err
}

func (r *InventoryRepository) UpdateReservation(ctx context.Context, res *model.Reservation) error {
	return r.db.WithContext(ctx).Save(res).Error
}

func (r *InventoryRepository) GetExpiredReservations(ctx context.Context) ([]model.Reservation, error) {
	var reservations []model.Reservation
	err := r.db.WithContext(ctx).
		Where("status = ? AND expires_at < NOW()", model.ReservationStatusReserved).
		Find(&reservations).Error
	return reservations, err
}

// Stock movement methods
func (r *InventoryRepository) CreateMovement(ctx context.Context, movement *model.StockMovement) error {
	return r.db.WithContext(ctx).Create(movement).Error
}

func (r *InventoryRepository) GetMovementsByProductID(ctx context.Context, productID uuid.UUID, limit int) ([]model.StockMovement, error) {
	var movements []model.StockMovement
	err := r.db.WithContext(ctx).
		Where("product_id = ?", productID).
		Order("created_at DESC").
		Limit(limit).
		Find(&movements).Error
	return movements, err
}
