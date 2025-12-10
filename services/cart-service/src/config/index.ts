import dotenv from 'dotenv';

dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3006', 10),

  redis: {
    url: process.env.REDIS_URL || 'redis://:redis123@localhost:6379',
  },

  productService: {
    url: process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002',
  },

  cart: {
    ttl: parseInt(process.env.CART_TTL || '604800', 10), // 7 days in seconds
    maxItems: parseInt(process.env.CART_MAX_ITEMS || '50', 10),
  },
};
