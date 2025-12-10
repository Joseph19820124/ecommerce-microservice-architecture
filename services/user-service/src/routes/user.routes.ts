import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Profile routes
router.get('/me', (req, res) => userController.getProfile(req, res));
router.put('/me', (req, res) => userController.updateProfile(req, res));
router.delete('/me', (req, res) => userController.deleteAccount(req, res));
router.put('/me/password', (req, res) => userController.changePassword(req, res));

// Address routes
router.get('/me/addresses', (req, res) => userController.getAddresses(req, res));
router.post('/me/addresses', (req, res) => userController.createAddress(req, res));
router.put('/me/addresses/:addressId', (req, res) => userController.updateAddress(req, res));
router.delete('/me/addresses/:addressId', (req, res) => userController.deleteAddress(req, res));
router.put('/me/addresses/:addressId/default', (req, res) => userController.setDefaultAddress(req, res));

export default router;
