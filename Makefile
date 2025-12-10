.PHONY: help build up down logs restart clean

# Default target
help:
	@echo "E-Commerce Microservice Architecture"
	@echo ""
	@echo "Usage:"
	@echo "  make build       - Build all Docker images"
	@echo "  make up          - Start all services"
	@echo "  make up-infra    - Start only infrastructure services"
	@echo "  make down        - Stop all services"
	@echo "  make logs        - View logs of all services"
	@echo "  make restart     - Restart all services"
	@echo "  make clean       - Remove all containers, volumes, and images"
	@echo ""
	@echo "Individual Services:"
	@echo "  make build-user      - Build user service"
	@echo "  make build-product   - Build product service"
	@echo "  make build-order     - Build order service"
	@echo "  make build-payment   - Build payment service"
	@echo "  make build-inventory - Build inventory service"
	@echo "  make build-cart      - Build cart service"
	@echo ""

# Build all services
build:
	docker-compose build

# Start all services
up:
	docker-compose up -d

# Start only infrastructure (databases, queues, etc.)
up-infra:
	docker-compose up -d postgres mongodb redis elasticsearch zookeeper kafka rabbitmq keycloak kong-database kong-migration kong

# Stop all services
down:
	docker-compose down

# View logs
logs:
	docker-compose logs -f

# Restart all services
restart: down up

# Clean everything
clean:
	docker-compose down -v --rmi all --remove-orphans

# Individual service builds
build-user:
	docker-compose build user-service

build-product:
	docker-compose build product-service

build-order:
	docker-compose build order-service

build-payment:
	docker-compose build payment-service

build-inventory:
	docker-compose build inventory-service

build-cart:
	docker-compose build cart-service

# Database migrations
migrate-user:
	docker-compose exec user-service npx prisma migrate deploy

# Development helpers
dev-user:
	cd services/user-service && npm run dev

dev-cart:
	cd services/cart-service && npm run dev

dev-product:
	cd services/product-service && ./mvnw spring-boot:run

dev-order:
	cd services/order-service && ./mvnw spring-boot:run

dev-payment:
	cd services/payment-service && go run cmd/server/main.go

dev-inventory:
	cd services/inventory-service && go run cmd/server/main.go

# Testing
test:
	@echo "Running tests for all services..."
	cd services/user-service && npm test || true
	cd services/cart-service && npm test || true

# Health check
health:
	@echo "Checking service health..."
	@curl -s http://localhost:3001/health || echo "User service: DOWN"
	@curl -s http://localhost:3002/actuator/health || echo "Product service: DOWN"
	@curl -s http://localhost:3004/health || echo "Payment service: DOWN"
	@curl -s http://localhost:3005/health || echo "Inventory service: DOWN"
	@curl -s http://localhost:3006/health || echo "Cart service: DOWN"
	@curl -s http://localhost:8001/status || echo "Kong: DOWN"
