import { Request, Response } from 'express';
import { z } from 'zod';
import { authService } from '../services/auth.service';
import { logger } from '../utils/logger';

const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export class AuthController {
  async register(req: Request, res: Response): Promise<void> {
    try {
      const data = registerSchema.parse(req.body);
      const tokens = await authService.register(data);

      res.status(201).json({
        message: 'Registration successful',
        ...tokens,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation failed',
          details: error.errors,
        });
        return;
      }

      const message = (error as Error).message;
      if (message === 'Email already registered') {
        res.status(409).json({ error: message });
        return;
      }

      logger.error('Registration error', { error: message });
      res.status(500).json({ error: 'Registration failed' });
    }
  }

  async login(req: Request, res: Response): Promise<void> {
    try {
      const data = loginSchema.parse(req.body);
      const tokens = await authService.login(data);

      res.json({
        message: 'Login successful',
        ...tokens,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation failed',
          details: error.errors,
        });
        return;
      }

      const message = (error as Error).message;
      if (message === 'Invalid credentials' || message === 'Account is disabled') {
        res.status(401).json({ error: message });
        return;
      }

      logger.error('Login error', { error: message });
      res.status(500).json({ error: 'Login failed' });
    }
  }

  async refresh(req: Request, res: Response): Promise<void> {
    try {
      const data = refreshSchema.parse(req.body);
      const tokens = await authService.refreshTokens(data.refreshToken);

      res.json({
        message: 'Tokens refreshed',
        ...tokens,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation failed',
          details: error.errors,
        });
        return;
      }

      const message = (error as Error).message;
      if (
        message === 'Invalid refresh token' ||
        message === 'Refresh token has been revoked' ||
        message === 'Refresh token has expired'
      ) {
        res.status(401).json({ error: message });
        return;
      }

      logger.error('Token refresh error', { error: message });
      res.status(500).json({ error: 'Token refresh failed' });
    }
  }

  async logout(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { refreshToken } = req.body;
      await authService.logout(userId, refreshToken);

      res.json({ message: 'Logout successful' });
    } catch (error) {
      logger.error('Logout error', { error: (error as Error).message });
      res.status(500).json({ error: 'Logout failed' });
    }
  }
}

export const authController = new AuthController();
