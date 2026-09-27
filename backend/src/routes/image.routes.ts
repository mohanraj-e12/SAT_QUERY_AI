import { Router } from 'express';
import { ImageController } from '../controllers/image.controller.js';
import { SatelliteController } from '../controllers/satellite.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/', authMiddleware, ImageController.getImages);
router.post('/upload', authMiddleware, ImageController.uploadImage);
router.post('/validate', SatelliteController.validateAuthenticity);
router.post('/authenticity', SatelliteController.validateAuthenticity);
router.get('/:id', authMiddleware, ImageController.getImageById);
router.delete('/:id', authMiddleware, ImageController.deleteImage);

export default router;
