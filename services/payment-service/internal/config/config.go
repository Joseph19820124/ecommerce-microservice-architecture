package config

import (
	"os"
	"strconv"
)

type Config struct {
	Env         string
	Port        string
	DatabaseURL string
	KafkaBrokers string
	StripeKey   string
}

func Load() *Config {
	return &Config{
		Env:          getEnv("ENV", "development"),
		Port:         getEnv("PORT", "3004"),
		DatabaseURL:  getEnv("DATABASE_URL", "postgres://postgres:postgres123@localhost:5432/paymentdb?sslmode=disable"),
		KafkaBrokers: getEnv("KAFKA_BROKERS", "localhost:29092"),
		StripeKey:    getEnv("STRIPE_SECRET_KEY", ""),
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}
