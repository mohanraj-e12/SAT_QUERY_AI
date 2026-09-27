import { Router } from 'express';
import { SatelliteController } from '../controllers/satellite.controller.js';

const router = Router();

// Status Check
router.get('/authenticity', SatelliteController.getStatus);
router.get('/validate', SatelliteController.getStatus);

// Authenticity validation endpoints (supports both /authenticity and /validate)
router.post('/authenticity', SatelliteController.validateAuthenticity);
router.post('/validate', SatelliteController.validateAuthenticity);

export default router;
