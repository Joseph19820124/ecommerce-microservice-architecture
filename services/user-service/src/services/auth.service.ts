import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { logger } from '../utils/logger';
import { userService } from './user.service';
import { getRedisClient } from '../utils/redis';

const prisma = new PrismaClient();

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface RegisterDTO {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

const ACCESS_TOKEN_EXPIRY = 15 * 60; // 15 minutes in seconds
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days in seconds

export class AuthService {
  generateAccessToken(payload: TokenPayload): string {
    return jwt.sign(payload, config.jwt.accessSecret, {
      expiresIn: config.jwt.accessExpiresIn,
    });
  }

  generateRefreshToken(): string {
    return uuidv4();
  }

  verifyAccessToken(token: string): TokenPayload {
    return jwt.verify(token, config.jwt.accessSecret) as TokenPayload;
  }

  async register(data: RegisterDTO): Promise<AuthTokens> {
    const user = await userService.createUser(data);

    const tokenPayload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.generateAccessToken(tokenPayload);
    const refreshToken = this.generateRefreshToken();

    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setSeconds(refreshTokenExpiry.getSeconds() + REFRESH_TOKEN_EXPIRY);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: refreshTokenExpiry,
      },
    });

    logger.info('User registered', { userId: user.id });

    return {
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRY,
    };
  }

  async login(data: LoginDTO): Promise<AuthTokens> {
    const user = await userService.getUserByEmail(data.email);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    if (!user.isActive) {
      throw new Error('Account is disabled');
    }

    const isValidPassword = await userService.validatePassword(user, data.password);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    const tokenPayload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.generateAccessToken(tokenPayload);
    const refreshToken = this.generateRefreshToken();

    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setSeconds(refreshTokenExpiry.getSeconds() + REFRESH_TOKEN_EXPIRY);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: refreshTokenExpiry,
      },
    });

    await userService.updateLastLogin(user.id);

    logger.info('User logged in', { userId: user.id });

    return {
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRY,
    };
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!storedToken) {
      throw new Error('Invalid refresh token');
    }

    if (storedToken.revokedAt) {
      throw new Error('Refresh token has been revoked');
    }

    if (storedToken.expiresAt < new Date()) {
      throw new Error('Refresh token has expired');
    }

    // Revoke old token
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    const tokenPayload: TokenPayload = {
      userId: storedToken.user.id,
      email: storedToken.user.email,
      role: storedToken.user.role,
    };

    const newAccessToken = this.generateAccessToken(tokenPayload);
    const newRefreshToken = this.generateRefreshToken();

    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setSeconds(refreshTokenExpiry.getSeconds() + REFRESH_TOKEN_EXPIRY);

    await prisma.refreshToken.create({
      data: {
        userId: storedToken.user.id,
        token: newRefreshToken,
        expiresAt: refreshTokenExpiry,
      },
    });

    logger.info('Tokens refreshed', { userId: storedToken.user.id });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRY,
    };
  }

  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      await prisma.refreshToken.updateMany({
        where: { userId, token: refreshToken },
        data: { revokedAt: new Date() },
      });
    } else {
      // Revoke all refresh tokens for this user
      await prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    // Add access token to blacklist in Redis
    const redis = getRedisClient();
    await redis.setex(`blacklist:user:${userId}`, ACCESS_TOKEN_EXPIRY, '1');

    logger.info('User logged out', { userId });
  }

  async revokeAllTokens(userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    const redis = getRedisClient();
    await redis.setex(`blacklist:user:${userId}`, ACCESS_TOKEN_EXPIRY, '1');

    logger.info('All tokens revoked', { userId });
  }

  async isTokenBlacklisted(userId: string): Promise<boolean> {
    const redis = getRedisClient();
    const result = await redis.get(`blacklist:user:${userId}`);
    return result !== null;
  }
}

export const authService = new AuthService();
