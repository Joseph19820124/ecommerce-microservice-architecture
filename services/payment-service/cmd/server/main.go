package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/ecommerce/payment-service/internal/config"
	"github.com/ecommerce/payment-service/internal/handler"
	"github.com/ecommerce/payment-service/internal/kafka"
	"github.com/ecommerce/payment-service/internal/model"
	"github.com/ecommerce/payment-service/internal/repository"
	"github.com/ecommerce/payment-service/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.uber.org/zap"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	// Initialize logger
	logger, _ := zap.NewProduction()
	if os.Getenv("ENV") == "development" {
		logger, _ = zap.NewDevelopment()
	}
	defer logger.Sync()

	// Load config
	cfg := config.Load()

	// Initialize database
	db, err := gorm.Open(postgres.Open(cfg.DatabaseURL), &gorm.Config{})
	if err != nil {
		logger.Fatal("Failed to connect to database", zap.Error(err))
	}

	// Auto migrate
	if err := db.AutoMigrate(&model.Payment{}, &model.Refund{}); err != nil {
		logger.Fatal("Failed to migrate database", zap.Error(err))
	}

	// Initialize Kafka producer
	producer := kafka.NewProducer(cfg.KafkaBrokers, logger)
	defer producer.Close()

	// Initialize repository and service
	repo := repository.NewPaymentRepository(db)
	svc := service.NewPaymentService(repo, producer, logger)
	h := handler.NewPaymentHandler(svc)

	// Setup Gin
	if cfg.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(ginLogger(logger))

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "healthy",
			"service": "payment-service",
		})
	})

	// Metrics endpoint
	router.GET("/metrics", gin.WrapH(promhttp.Handler()))

	// API routes
	api := router.Group("/api/v1")
	{
		payments := api.Group("/payments")
		{
			payments.POST("", h.CreatePayment)
			payments.POST("/process", h.ProcessPayment)
			payments.GET("/:id", h.GetPayment)
			payments.GET("/:id/status", h.GetPaymentStatus)
			payments.GET("/order/:orderId", h.GetPaymentByOrderID)
			payments.GET("/user/:userId", h.GetUserPayments)
		}

		refunds := api.Group("/refunds")
		{
			refunds.POST("", h.CreateRefund)
			refunds.POST("/:id/process", h.ProcessRefund)
		}
	}

	// Start server
	srv := &http.Server{
		Addr:    fmt.Sprintf(":%s", cfg.Port),
		Handler: router,
	}

	go func() {
		logger.Info("Starting payment service", zap.String("port", cfg.Port))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("Failed to start server", zap.Error(err))
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		logger.Fatal("Server forced to shutdown", zap.Error(err))
	}

	logger.Info("Server exited")
}

func ginLogger(logger *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path

		c.Next()

		latency := time.Since(start)
		status := c.Writer.Status()

		logger.Info("HTTP Request",
			zap.String("method", c.Request.Method),
			zap.String("path", path),
			zap.Int("status", status),
			zap.Duration("latency", latency),
			zap.String("ip", c.ClientIP()),
		)
	}
}
