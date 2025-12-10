import { Router } from 'express';
import { cartController } from '../controllers/cart.controller';

const router = Router();

// Get cart
router.get('/', (req, res) => cartController.getCart(req, res));
router.get('/:userId', (req, res) => cartController.getCart(req, res));

// Add item to cart
router.post('/items', (req, res) => cartController.addItem(req, res));
router.post('/:userId/items', (req, res) => cartController.addItem(req, res));

// Update item quantity
router.put('/items/:productId/:sku', (req, res) => cartController.updateItemQuantity(req, res));
router.put('/:userId/items/:productId/:sku', (req, res) => cartController.updateItemQuantity(req, res));

// Remove item from cart
router.delete('/items/:productId/:sku', (req, res) => cartController.removeItem(req, res));
router.delete('/:userId/items/:productId/:sku', (req, res) => cartController.removeItem(req, res));

// Clear cart
router.delete('/', (req, res) => cartController.clearCart(req, res));
router.delete('/:userId', (req, res) => cartController.clearCart(req, res));

// Merge carts (guest to user)
router.post('/merge', (req, res) => cartController.mergeCarts(req, res));

export default router;
