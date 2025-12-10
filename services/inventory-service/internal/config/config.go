package config

import (
	"os"
)

type Config struct {
	Env          string
	Port         string
	DatabaseURL  string
	RedisURL     string
	KafkaBrokers string
}

func Load() *Config {
	return &Config{
		Env:          getEnv("ENV", "development"),
		Port:         getEnv("PORT", "3005"),
		DatabaseURL:  getEnv("DATABASE_URL", "postgres://postgres:postgres123@localhost:5432/inventorydb?sslmode=disable"),
		RedisURL:     getEnv("REDIS_URL", "redis://:redis123@localhost:6379"),
		KafkaBrokers: getEnv("KAFKA_BROKERS", "localhost:29092"),
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
