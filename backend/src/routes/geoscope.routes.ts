import { Router } from 'express';
import { pythonAgentService } from '../services/python-agent.service.js';

const geoscopeRouter = Router();

// Health check
geoscopeRouter.get('/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'SatQueryAI GeoScope Geospatial Engine',
    capabilities: ['AOI Demarcation', 'Sentinel-2 Multispectral', 'Sentinel-1 SAR', 'Bi-Temporal Change', 'Multimodal VLM Analysis'],
    timestamp: new Date().toISOString()
  });
});

// Metadata
geoscopeRouter.get('/metadata', (req, res) => {
  res.json({
    providers: ['Sentinel Hub L2A', 'Sentinel-1 GRD', 'Landsat-8/9', 'Earth Engine'],
    default_crs: 'EPSG:4326',
    sensors: [
      { name: 'Sentinel-2', type: 'Optical Multispectral', resolution: '10m', bands: ['B02', 'B03', 'B04', 'B08'] },
      { name: 'Sentinel-1', type: 'SAR C-band', resolution: '20m', polarizations: ['VV', 'VH'] }
    ]
  });
});

// Process AOI geometry & calculate geodesic metrics
geoscopeRouter.post('/aoi', async (req, res) => {
  try {
    const result = await pythonAgentService.executeBridge('geoscope_aoi', req.body);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: `AOI processing failed: ${err.message}` });
  }
});

// Acquire / clip satellite imagery for AOI
geoscopeRouter.post('/imagery', async (req, res) => {
  try {
    const result = await pythonAgentService.executeBridge('geoscope_imagery', req.body);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: `Imagery acquisition failed: ${err.message}` });
  }
});

// Analyze AOI with VLM
geoscopeRouter.post('/analyze', async (req, res) => {
  try {
    const result = await pythonAgentService.executeBridge('geoscope_analyze', req.body);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: `GeoScope analysis failed: ${err.message}` });
  }
});

// Bi-temporal comparison
geoscopeRouter.post('/compare', async (req, res) => {
  try {
    const result = await pythonAgentService.executeBridge('geoscope_compare', req.body);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: `GeoScope temporal comparison failed: ${err.message}` });
  }
});

export default geoscopeRouter;
