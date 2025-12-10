package handler

import (
	"net/http"

	"github.com/ecommerce/inventory-service/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type InventoryHandler struct {
	svc *service.InventoryService
}

func NewInventoryHandler(svc *service.InventoryService) *InventoryHandler {
	return &InventoryHandler{svc: svc}
}

func (h *InventoryHandler) CreateInventory(c *gin.Context) {
	var req service.CreateInventoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	inv, err := h.svc.CreateInventory(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create inventory"})
		return
	}

	c.JSON(http.StatusCreated, inv)
}

func (h *InventoryHandler) GetInventory(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid inventory ID"})
		return
	}

	inv, err := h.svc.GetInventory(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Inventory not found"})
		return
	}

	c.JSON(http.StatusOK, inv)
}

func (h *InventoryHandler) GetInventoryByProduct(c *gin.Context) {
	productIDStr := c.Param("productId")
	productID, err := uuid.Parse(productIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid product ID"})
		return
	}

	inv, err := h.svc.GetInventoryByProductID(c.Request.Context(), productID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Inventory not found"})
		return
	}

	c.JSON(http.StatusOK, inv)
}

func (h *InventoryHandler) GetInventoryBySKU(c *gin.Context) {
	sku := c.Param("sku")

	inv, err := h.svc.GetInventoryBySKU(c.Request.Context(), sku)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Inventory not found"})
		return
	}

	c.JSON(http.StatusOK, inv)
}

func (h *InventoryHandler) UpdateStock(c *gin.Context) {
	productIDStr := c.Param("productId")
	productID, err := uuid.Parse(productIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid product ID"})
		return
	}

	var req service.UpdateStockRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	inv, err := h.svc.UpdateStock(c.Request.Context(), productID, &req)
	if err != nil {
		if err == service.ErrInventoryNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update stock"})
		return
	}

	c.JSON(http.StatusOK, inv)
}

func (h *InventoryHandler) AddStock(c *gin.Context) {
	productIDStr := c.Param("productId")
	productID, err := uuid.Parse(productIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid product ID"})
		return
	}

	var req struct {
		Quantity  int    `json:"quantity" binding:"required,min=1"`
		Reason    string `json:"reason"`
		Reference string `json:"reference"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	inv, err := h.svc.AddStock(c.Request.Context(), productID, req.Quantity, req.Reason, req.Reference)
	if err != nil {
		if err == service.ErrInventoryNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add stock"})
		return
	}

	c.JSON(http.StatusOK, inv)
}

func (h *InventoryHandler) ReserveStock(c *gin.Context) {
	var req service.ReserveStockRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	reservations, err := h.svc.ReserveStock(c.Request.Context(), &req)
	if err != nil {
		if err == service.ErrInventoryNotFound || err == service.ErrInsufficientStock {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reserve stock"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":      true,
		"reservations": reservations,
	})
}

func (h *InventoryHandler) ConfirmReservation(c *gin.Context) {
	orderIDStr := c.Param("orderId")
	orderID, err := uuid.Parse(orderIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid order ID"})
		return
	}

	if err := h.svc.ConfirmReservation(c.Request.Context(), orderID); err != nil {
		switch err {
		case service.ErrReservationNotFound:
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		case service.ErrReservationExpired:
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to confirm reservation"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Reservation confirmed"})
}

func (h *InventoryHandler) ReleaseReservation(c *gin.Context) {
	orderIDStr := c.Param("orderId")
	orderID, err := uuid.Parse(orderIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid order ID"})
		return
	}

	if err := h.svc.ReleaseReservation(c.Request.Context(), orderID); err != nil {
		if err == service.ErrReservationNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to release reservation"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Reservation released"})
}

func (h *InventoryHandler) GetLowStockItems(c *gin.Context) {
	items, err := h.svc.GetLowStockItems(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get low stock items"})
		return
	}

	c.JSON(http.StatusOK, items)
}

func (h *InventoryHandler) GetAllInventory(c *gin.Context) {
	limit := 50
	offset := 0

	items, err := h.svc.GetAllInventory(c.Request.Context(), limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get inventory"})
		return
	}

	c.JSON(http.StatusOK, items)
}
