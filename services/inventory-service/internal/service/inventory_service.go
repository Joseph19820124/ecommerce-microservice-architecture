package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/ecommerce/inventory-service/internal/model"
	"github.com/ecommerce/inventory-service/internal/repository"
	"github.com/go-redis/redis/v8"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

var (
	ErrInventoryNotFound   = errors.New("inventory not found")
	ErrInsufficientStock   = errors.New("insufficient stock")
	ErrReservationNotFound = errors.New("reservation not found")
	ErrReservationExpired  = errors.New("reservation expired")
	ErrAlreadyConfirmed    = errors.New("reservation already confirmed")
)

type CreateInventoryRequest struct {
	ProductID     uuid.UUID `json:"productId" binding:"required"`
	SKU           string    `json:"sku" binding:"required"`
	Quantity      int       `json:"quantity" binding:"required,min=0"`
	LowStockAlert int       `json:"lowStockAlert"`
	WarehouseID   string    `json:"warehouseId"`
	Location      string    `json:"location"`
}

type UpdateStockRequest struct {
	Quantity  int    `json:"quantity" binding:"required"`
	Reason    string `json:"reason"`
	Reference string `json:"reference"`
}

type ReserveStockRequest struct {
	OrderID   uuid.UUID             `json:"orderId" binding:"required"`
	Items     []ReserveItemRequest  `json:"items" binding:"required,min=1"`
}

type ReserveItemRequest struct {
	ProductID uuid.UUID `json:"productId" binding:"required"`
	SKU       string    `json:"sku" binding:"required"`
	Quantity  int       `json:"quantity" binding:"required,min=1"`
}

type InventoryService struct {
	repo     *repository.InventoryRepository
	redis    *redis.Client
	producer EventProducer
	logger   *zap.Logger
}

type EventProducer interface {
	Publish(topic string, message interface{}) error
}

func NewInventoryService(repo *repository.InventoryRepository, redis *redis.Client, producer EventProducer, logger *zap.Logger) *InventoryService {
	return &InventoryService{
		repo:     repo,
		redis:    redis,
		producer: producer,
		logger:   logger,
	}
}

func (s *InventoryService) CreateInventory(ctx context.Context, req *CreateInventoryRequest) (*model.Inventory, error) {
	lowStockAlert := req.LowStockAlert
	if lowStockAlert == 0 {
		lowStockAlert = 10
	}

	warehouseID := req.WarehouseID
	if warehouseID == "" {
		warehouseID = "DEFAULT"
	}

	inv := &model.Inventory{
		ProductID:     req.ProductID,
		SKU:           req.SKU,
		Quantity:      req.Quantity,
		ReservedQty:   0,
		AvailableQty:  req.Quantity,
		LowStockAlert: lowStockAlert,
		WarehouseID:   warehouseID,
		Location:      req.Location,
	}

	if err := s.repo.Create(ctx, inv); err != nil {
		s.logger.Error("Failed to create inventory", zap.Error(err))
		return nil, err
	}

	s.recordMovement(ctx, inv.ProductID, inv.SKU, model.MovementTypeIn, req.Quantity, "Initial stock", "")

	s.logger.Info("Inventory created",
		zap.String("inventoryId", inv.ID.String()),
		zap.String("productId", inv.ProductID.String()),
	)

	return inv, nil
}

func (s *InventoryService) GetInventory(ctx context.Context, id uuid.UUID) (*model.Inventory, error) {
	inv, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, ErrInventoryNotFound
	}
	return inv, nil
}

func (s *InventoryService) GetInventoryByProductID(ctx context.Context, productID uuid.UUID) (*model.Inventory, error) {
	inv, err := s.repo.GetByProductID(ctx, productID)
	if err != nil {
		return nil, ErrInventoryNotFound
	}
	return inv, nil
}

func (s *InventoryService) GetInventoryBySKU(ctx context.Context, sku string) (*model.Inventory, error) {
	inv, err := s.repo.GetBySKU(ctx, sku)
	if err != nil {
		return nil, ErrInventoryNotFound
	}
	return inv, nil
}

func (s *InventoryService) UpdateStock(ctx context.Context, productID uuid.UUID, req *UpdateStockRequest) (*model.Inventory, error) {
	inv, err := s.repo.GetByProductID(ctx, productID)
	if err != nil {
		return nil, ErrInventoryNotFound
	}

	oldQty := inv.Quantity
	inv.Quantity = req.Quantity
	inv.AvailableQty = req.Quantity - inv.ReservedQty

	if err := s.repo.Update(ctx, inv); err != nil {
		return nil, err
	}

	movementType := model.MovementTypeAdjust
	diff := req.Quantity - oldQty

	s.recordMovement(ctx, inv.ProductID, inv.SKU, movementType, diff, req.Reason, req.Reference)

	if inv.AvailableQty <= inv.LowStockAlert {
		s.publishLowStockAlert(inv)
	}

	s.logger.Info("Stock updated",
		zap.String("productId", productID.String()),
		zap.Int("oldQty", oldQty),
		zap.Int("newQty", req.Quantity),
	)

	return inv, nil
}

func (s *InventoryService) AddStock(ctx context.Context, productID uuid.UUID, quantity int, reason, reference string) (*model.Inventory, error) {
	inv, err := s.repo.GetByProductID(ctx, productID)
	if err != nil {
		return nil, ErrInventoryNotFound
	}

	inv.Quantity += quantity
	inv.AvailableQty += quantity

	if err := s.repo.Update(ctx, inv); err != nil {
		return nil, err
	}

	s.recordMovement(ctx, inv.ProductID, inv.SKU, model.MovementTypeIn, quantity, reason, reference)

	s.logger.Info("Stock added",
		zap.String("productId", productID.String()),
		zap.Int("quantity", quantity),
	)

	return inv, nil
}

func (s *InventoryService) ReserveStock(ctx context.Context, req *ReserveStockRequest) ([]model.Reservation, error) {
	reservations := make([]model.Reservation, 0, len(req.Items))
	expiresAt := time.Now().Add(15 * time.Minute)

	for _, item := range req.Items {
		inv, err := s.repo.GetByProductID(ctx, item.ProductID)
		if err != nil {
			s.releaseReservations(ctx, reservations)
			return nil, fmt.Errorf("product %s: %w", item.ProductID, ErrInventoryNotFound)
		}

		if inv.AvailableQty < item.Quantity {
			s.releaseReservations(ctx, reservations)
			return nil, fmt.Errorf("product %s: %w", item.ProductID, ErrInsufficientStock)
		}

		inv.ReservedQty += item.Quantity
		inv.AvailableQty -= item.Quantity

		if err := s.repo.Update(ctx, inv); err != nil {
			s.releaseReservations(ctx, reservations)
			return nil, err
		}

		reservation := model.Reservation{
			OrderID:   req.OrderID,
			ProductID: item.ProductID,
			SKU:       item.SKU,
			Quantity:  item.Quantity,
			Status:    model.ReservationStatusReserved,
			ExpiresAt: expiresAt,
		}

		if err := s.repo.CreateReservation(ctx, &reservation); err != nil {
			s.releaseReservations(ctx, reservations)
			return nil, err
		}

		reservations = append(reservations, reservation)

		s.recordMovement(ctx, item.ProductID, item.SKU, model.MovementTypeReserve, item.Quantity, "Order reservation", req.OrderID.String())
	}

	s.publishEvent("InventoryReserved", map[string]interface{}{
		"orderId":    req.OrderID.String(),
		"items":      req.Items,
		"reservedAt": time.Now().Format(time.RFC3339),
	})

	s.logger.Info("Stock reserved",
		zap.String("orderId", req.OrderID.String()),
		zap.Int("itemCount", len(reservations)),
	)

	return reservations, nil
}

func (s *InventoryService) ConfirmReservation(ctx context.Context, orderID uuid.UUID) error {
	reservations, err := s.repo.GetReservationsByOrderID(ctx, orderID)
	if err != nil || len(reservations) == 0 {
		return ErrReservationNotFound
	}

	now := time.Now()

	for _, res := range reservations {
		if res.Status == model.ReservationStatusConfirmed {
			continue
		}

		if res.Status == model.ReservationStatusReleased || res.Status == model.ReservationStatusExpired {
			return ErrReservationExpired
		}

		inv, err := s.repo.GetByProductID(ctx, res.ProductID)
		if err != nil {
			continue
		}

		inv.Quantity -= res.Quantity
		inv.ReservedQty -= res.Quantity

		if err := s.repo.Update(ctx, inv); err != nil {
			return err
		}

		res.Status = model.ReservationStatusConfirmed
		res.ConfirmedAt = &now

		if err := s.repo.UpdateReservation(ctx, &res); err != nil {
			return err
		}

		s.recordMovement(ctx, res.ProductID, res.SKU, model.MovementTypeOut, res.Quantity, "Order confirmed", orderID.String())

		if inv.AvailableQty <= inv.LowStockAlert {
			s.publishLowStockAlert(inv)
		}
	}

	s.publishEvent("InventoryConfirmed", map[string]interface{}{
		"orderId":     orderID.String(),
		"confirmedAt": now.Format(time.RFC3339),
	})

	s.logger.Info("Reservation confirmed", zap.String("orderId", orderID.String()))

	return nil
}

func (s *InventoryService) ReleaseReservation(ctx context.Context, orderID uuid.UUID) error {
	reservations, err := s.repo.GetReservationsByOrderID(ctx, orderID)
	if err != nil || len(reservations) == 0 {
		return ErrReservationNotFound
	}

	s.releaseReservations(ctx, reservations)

	s.publishEvent("InventoryReleased", map[string]interface{}{
		"orderId":    orderID.String(),
		"releasedAt": time.Now().Format(time.RFC3339),
	})

	s.logger.Info("Reservation released", zap.String("orderId", orderID.String()))

	return nil
}

func (s *InventoryService) releaseReservations(ctx context.Context, reservations []model.Reservation) {
	now := time.Now()

	for _, res := range reservations {
		if res.Status != model.ReservationStatusReserved {
			continue
		}

		inv, err := s.repo.GetByProductID(ctx, res.ProductID)
		if err != nil {
			continue
		}

		inv.ReservedQty -= res.Quantity
		inv.AvailableQty += res.Quantity
		s.repo.Update(ctx, inv)

		res.Status = model.ReservationStatusReleased
		res.ReleasedAt = &now
		s.repo.UpdateReservation(ctx, &res)

		s.recordMovement(ctx, res.ProductID, res.SKU, model.MovementTypeRelease, res.Quantity, "Reservation released", res.OrderID.String())
	}
}

func (s *InventoryService) GetLowStockItems(ctx context.Context) ([]model.Inventory, error) {
	return s.repo.GetLowStockItems(ctx)
}

func (s *InventoryService) GetAllInventory(ctx context.Context, limit, offset int) ([]model.Inventory, error) {
	return s.repo.GetAll(ctx, limit, offset)
}

func (s *InventoryService) recordMovement(ctx context.Context, productID uuid.UUID, sku, movementType string, quantity int, reason, reference string) {
	movement := &model.StockMovement{
		ProductID: productID,
		SKU:       sku,
		Type:      movementType,
		Quantity:  quantity,
		Reason:    reason,
		Reference: reference,
	}
	s.repo.CreateMovement(ctx, movement)
}

func (s *InventoryService) publishEvent(eventType string, payload map[string]interface{}) {
	if s.producer == nil {
		return
	}

	event := map[string]interface{}{
		"type":      eventType,
		"payload":   payload,
		"timestamp": time.Now().Format(time.RFC3339),
		"source":    "inventory-service",
	}

	if err := s.producer.Publish("inventory-events", event); err != nil {
		s.logger.Error("Failed to publish event",
			zap.String("type", eventType),
			zap.Error(err),
		)
	}
}

func (s *InventoryService) publishLowStockAlert(inv *model.Inventory) {
	s.publishEvent("StockLow", map[string]interface{}{
		"productId":    inv.ProductID.String(),
		"sku":          inv.SKU,
		"currentStock": inv.AvailableQty,
		"threshold":    inv.LowStockAlert,
		"detectedAt":   time.Now().Format(time.RFC3339),
	})
}
