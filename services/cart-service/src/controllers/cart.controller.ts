import { Request, Response } from 'express';
import { z } from 'zod';
import { cartService } from '../services/cart.service';

const addItemSchema = z.object({
  productId: z.string().uuid(),
  sku: z.string().min(1),
  name: z.string().min(1),
  price: z.number().positive(),
  quantity: z.number().int().positive(),
  imageUrl: z.string().url().optional(),
});

const updateQuantitySchema = z.object({
  quantity: z.number().int().min(0),
});

export class CartController {
  async getCart(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.params.userId || req.headers['x-user-id'] as string;
      if (!userId) {
        res.status(400).json({ error: 'User ID is required' });
        return;
      }

      const cart = await cartService.getCart(userId);
      res.json(cart);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get cart' });
    }
  }

  async addItem(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.params.userId || req.headers['x-user-id'] as string;
      if (!userId) {
        res.status(400).json({ error: 'User ID is required' });
        return;
      }

      const data = addItemSchema.parse(req.body);
      const cart = await cartService.addItem(userId, data);
      res.json(cart);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: error.errors });
        return;
      }
      const message = (error as Error).message;
      if (message.includes('cannot exceed')) {
        res.status(400).json({ error: message });
        return;
      }
      res.status(500).json({ error: 'Failed to add item to cart' });
    }
  }

  async updateItemQuantity(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.params.userId || req.headers['x-user-id'] as string;
      const { productId, sku } = req.params;

      if (!userId) {
        res.status(400).json({ error: 'User ID is required' });
        return;
      }

      const data = updateQuantitySchema.parse(req.body);
      const cart = await cartService.updateItemQuantity(userId, productId, sku, data.quantity);
      res.json(cart);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: error.errors });
        return;
      }
      const message = (error as Error).message;
      if (message === 'Item not found in cart') {
        res.status(404).json({ error: message });
        return;
      }
      res.status(500).json({ error: 'Failed to update cart item' });
    }
  }

  async removeItem(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.params.userId || req.headers['x-user-id'] as string;
      const { productId, sku } = req.params;

      if (!userId) {
        res.status(400).json({ error: 'User ID is required' });
        return;
      }

      const cart = await cartService.removeItem(userId, productId, sku);
      res.json(cart);
    } catch (error) {
      const message = (error as Error).message;
      if (message === 'Item not found in cart') {
        res.status(404).json({ error: message });
        return;
      }
      res.status(500).json({ error: 'Failed to remove item from cart' });
    }
  }

  async clearCart(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.params.userId || req.headers['x-user-id'] as string;
      if (!userId) {
        res.status(400).json({ error: 'User ID is required' });
        return;
      }

      await cartService.clearCart(userId);
      res.json({ message: 'Cart cleared successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to clear cart' });
    }
  }

  async mergeCarts(req: Request, res: Response): Promise<void> {
    try {
      const { guestId, userId } = req.body;

      if (!guestId || !userId) {
        res.status(400).json({ error: 'Both guestId and userId are required' });
        return;
      }

      const cart = await cartService.mergeCarts(guestId, userId);
      res.json(cart);
    } catch (error) {
      res.status(500).json({ error: 'Failed to merge carts' });
    }
  }
}

export const cartController = new CartController();
