import dotenv from 'dotenv';

dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),

  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres123@localhost:5432/userdb',
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://:redis123@localhost:6379',
  },

  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'localhost:29092').split(','),
    clientId: 'user-service',
    groupId: 'user-service-group',
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'access-secret-key-change-in-production',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'refresh-secret-key-change-in-production',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  keycloak: {
    url: process.env.KEYCLOAK_URL || 'http://localhost:8080',
    realm: process.env.KEYCLOAK_REALM || 'ecommerce',
    clientId: process.env.KEYCLOAK_CLIENT_ID || 'user-service',
    clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || '',
  },

  bcrypt: {
    saltRounds: 12,
  },
};
