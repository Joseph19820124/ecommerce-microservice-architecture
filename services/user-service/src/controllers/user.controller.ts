import { Request, Response } from 'express';
import { z } from 'zod';
import { userService } from '../services/user.service';
import { logger } from '../utils/logger';

const updateUserSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
  avatar: z.string().url().optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

const createAddressSchema = z.object({
  label: z.string().optional(),
  fullName: z.string().min(1, 'Full name is required'),
  phone: z.string().min(1, 'Phone is required'),
  street: z.string().min(1, 'Street is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  postalCode: z.string().min(1, 'Postal code is required'),
  country: z.string().optional(),
  isDefault: z.boolean().optional(),
});

export class UserController {
  async getProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const user = await userService.getUserById(userId);
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json(user);
    } catch (error) {
      logger.error('Get profile error', { error: (error as Error).message });
      res.status(500).json({ error: 'Failed to get profile' });
    }
  }

  async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const data = updateUserSchema.parse(req.body);
      const user = await userService.updateUser(userId, data);

      res.json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation failed',
          details: error.errors,
        });
        return;
      }

      logger.error('Update profile error', { error: (error as Error).message });
      res.status(500).json({ error: 'Failed to update profile' });
    }
  }

  async changePassword(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const data = changePasswordSchema.parse(req.body);
      await userService.changePassword(userId, data.currentPassword, data.newPassword);

      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation failed',
          details: error.errors,
        });
        return;
      }

      const message = (error as Error).message;
      if (message === 'Current password is incorrect') {
        res.status(400).json({ error: message });
        return;
      }

      logger.error('Change password error', { error: message });
      res.status(500).json({ error: 'Failed to change password' });
    }
  }

  async deleteAccount(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      await userService.deleteUser(userId);
      res.json({ message: 'Account deleted successfully' });
    } catch (error) {
      logger.error('Delete account error', { error: (error as Error).message });
      res.status(500).json({ error: 'Failed to delete account' });
    }
  }

  // Address management
  async getAddresses(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const addresses = await userService.getAddresses(userId);
      res.json(addresses);
    } catch (error) {
      logger.error('Get addresses error', { error: (error as Error).message });
      res.status(500).json({ error: 'Failed to get addresses' });
    }
  }

  async createAddress(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const data = createAddressSchema.parse(req.body);
      const address = await userService.createAddress(userId, data);

      res.status(201).json(address);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation failed',
          details: error.errors,
        });
        return;
      }

      logger.error('Create address error', { error: (error as Error).message });
      res.status(500).json({ error: 'Failed to create address' });
    }
  }

  async updateAddress(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { addressId } = req.params;
      const data = createAddressSchema.partial().parse(req.body);
      const address = await userService.updateAddress(userId, addressId, data);

      res.json(address);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation failed',
          details: error.errors,
        });
        return;
      }

      const message = (error as Error).message;
      if (message === 'Address not found') {
        res.status(404).json({ error: message });
        return;
      }

      logger.error('Update address error', { error: message });
      res.status(500).json({ error: 'Failed to update address' });
    }
  }

  async deleteAddress(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { addressId } = req.params;
      await userService.deleteAddress(userId, addressId);

      res.json({ message: 'Address deleted successfully' });
    } catch (error) {
      const message = (error as Error).message;
      if (message === 'Address not found') {
        res.status(404).json({ error: message });
        return;
      }

      logger.error('Delete address error', { error: message });
      res.status(500).json({ error: 'Failed to delete address' });
    }
  }

  async setDefaultAddress(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { addressId } = req.params;
      const address = await userService.setDefaultAddress(userId, addressId);

      res.json(address);
    } catch (error) {
      const message = (error as Error).message;
      if (message === 'Address not found') {
        res.status(404).json({ error: message });
        return;
      }

      logger.error('Set default address error', { error: message });
      res.status(500).json({ error: 'Failed to set default address' });
    }
  }
}

export const userController = new UserController();
