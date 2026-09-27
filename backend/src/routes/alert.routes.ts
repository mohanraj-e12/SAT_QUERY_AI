import { Router } from 'express';
import { AlertController } from '../controllers/alert.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/', authMiddleware, AlertController.getAlerts);
router.put('/:id/read', authMiddleware, AlertController.markRead);
router.delete('/:id', authMiddleware, AlertController.deleteAlert);

export default router;
