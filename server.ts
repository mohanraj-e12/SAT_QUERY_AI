import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { app as apiApp } from './backend/src/app.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Mount API backend routes first so all /api requests are resolved directly
  app.use(apiApp);

  // In development, mount Vite middleware for live HMR & asset serving
  if (process.env.NODE_ENV !== 'production') {
    // Development Guard: Never let API, satellite, or images routes fall through to Vite SPA index.html
    app.use((req, res, next) => {
      const p = req.path.toLowerCase();
      if (p.startsWith('/api') || p.startsWith('/satellite') || p.startsWith('/images') || p.startsWith('/health')) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.status(404).json({
          success: false,
          error: `API route ${req.method} ${req.originalUrl} not found.`,
          code: 'API_ENDPOINT_NOT_FOUND',
        });
      }
      next();
    });

    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: PORT },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In production / preview deployment, serve compiled static assets from dist
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      // Guard: Never return index.html for API, satellite, or images routes
      const p = req.path.toLowerCase();
      if (p.startsWith('/api') || p.startsWith('/satellite') || p.startsWith('/images') || p.startsWith('/health')) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.status(404).json({
          success: false,
          error: `API route ${req.method} ${req.originalUrl} not found.`,
          code: 'API_ENDPOINT_NOT_FOUND',
        });
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SatQuery] Unified Full-Stack Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
