import express, { Express } from 'express';
import apiRouter from './routes/index.js';
import satelliteRoutes from './routes/satellite.routes.js';
import imageRoutes from './routes/image.routes.js';
import { errorHandler } from './middleware/error.middleware.js';

export function createApp(): Express {
  const app = express();

  // Middleware
  app.use(express.json({ limit: '70mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // CORS handling
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // Request logger in dev
  app.use((req, res, next) => {
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[SatQuery API] ${req.method} ${req.path}`);
    }
    next();
  });

  // Health check endpoints (accessible via both /api/health and /health)
  app.get('/health', (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json({
      success: true,
      service: 'SatQuery AI Remote-Sensing Intelligence Platform',
      status: 'operational',
      timestamp: new Date().toISOString(),
      backend: 'express-fullstack',
    });
  });

  // API Router mounted at /api
  app.use('/api', apiRouter);

  // Top-level route aliases for resilient access without /api prefix
  app.use('/satellite', satelliteRoutes);
  app.use('/images', imageRoutes);

  // Catch-all 404 handler for any unhandled /api or satellite/images route so HTML is NEVER returned
  app.all(['/api', '/api/*', '/satellite', '/satellite/*', '/images', '/images/*', '/health/*'], (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(404).json({
      success: false,
      error: `API endpoint ${req.method} ${req.path} not found.`,
      code: 'API_ENDPOINT_NOT_FOUND',
    });
  });

  // Centralized Error Handling
  app.use(errorHandler);

  return app;
}

export const app = createApp();
