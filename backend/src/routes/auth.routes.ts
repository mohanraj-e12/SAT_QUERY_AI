import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/profile', authMiddleware, AuthController.getProfile);
router.post('/profile', authMiddleware, AuthController.updateProfile);
router.put('/profile', authMiddleware, AuthController.updateProfile);

export default router;
