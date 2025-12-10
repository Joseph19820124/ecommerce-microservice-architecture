module github.com/ecommerce/payment-service

go 1.22

require (
	github.com/gin-gonic/gin v1.9.1
	github.com/google/uuid v1.5.0
	github.com/lib/pq v1.10.9
	github.com/prometheus/client_golang v1.18.0
	github.com/segmentio/kafka-go v0.4.47
	github.com/stripe/stripe-go/v76 v76.10.0
	go.uber.org/zap v1.26.0
	gorm.io/driver/postgres v1.5.4
	gorm.io/gorm v1.25.5
)
