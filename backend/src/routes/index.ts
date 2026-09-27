import { Router } from 'express';
import authRoutes from './auth.routes.js';
import projectRoutes from './project.routes.js';
import imageRoutes from './image.routes.js';
import analysisRoutes from './analysis.routes.js';
import alertRoutes from './alert.routes.js';
import aiRoutes from './ai.routes.js';
import satelliteRoutes from './satellite.routes.js';
import geoscopeRoutes from './geoscope.routes.js';
import { AnalysisController } from '../controllers/analysis.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { isSupabaseConnected } from '../database/supabase.client.js';
import { config } from '../config/env.config.js';
import { openRouterService } from '../services/openrouter.service.js';
import { pythonAgentService } from '../services/python-agent.service.js';
import { imageService } from '../services/image.service.js';

const apiRouter = Router();

// FEATURE 9: Health Check Endpoint
apiRouter.get('/health', (req, res) => {
  res.json({
    status: 'online',
    backend: 'SatQueryAI',
    version: '1.0',
    capabilities: {
      pythonAgent: true,
      vrsbenchDataset: true,
      openRouterLLM: openRouterService.getHealthStatus().configured,
      geminiMultimodal: !!config.geminiApiKey,
      supabaseConnected: isSupabaseConnected(),
      spectralAlgorithms: ['NDVI', 'NDWI', 'NDBI'],
      models: ['CLIP', 'ViT', 'U-Net', 'SAM', 'RSVQA', 'XGBoost', 'VRSBench-VLM'],
    },
  });
});

// VRSBENCH DATASET ENDPOINTS
apiRouter.get('/dataset/vrsbench/info', async (req, res) => {
  try {
    const info = await pythonAgentService.getVrsBenchInfo();
    res.json(info);
  } catch (err: any) {
    res.status(500).json({
      dataset: 'xiang709/VRSBench',
      configuration: 'VRSBench',
      split: 'train',
      streaming: true,
      status: 'error',
      error: err.message,
      features: {},
    });
  }
});

apiRouter.get('/dataset/vrsbench/sample', async (req, res) => {
  try {
    const idx = parseInt(req.query.index as string) || 0;
    const sample = await pythonAgentService.getVrsBenchSample(idx);
    res.json(sample);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.get('/dataset/vrsbench/status', async (req, res) => {
  try {
    const status = await pythonAgentService.getVrsBenchStatus();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// TRAINING PIPELINE ENDPOINTS
apiRouter.post('/training/start', async (req, res) => {
  try {
    const maxSamples = parseInt(req.body.max_samples || req.body.maxSamples) || 100;
    const epochs = parseInt(req.body.epochs) || 1;
    const lr = parseFloat(req.body.learning_rate || req.body.learningRate) || 0.001;
    const result = await pythonAgentService.startVrsBenchTraining(maxSamples, epochs, lr);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/training/stop', async (req, res) => {
  try {
    const result = await pythonAgentService.stopVrsBenchTraining();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/training/evaluate', async (req, res) => {
  try {
    const numSamples = parseInt(req.body.num_samples || req.body.numSamples) || 10;
    const result = await pythonAgentService.evaluateVrsBenchModel(numSamples);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.get('/training/status', async (req, res) => {
  try {
    const status = await pythonAgentService.getVrsBenchTrainingStatus();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.get('/training/logs', async (req, res) => {
  try {
    const status = await pythonAgentService.getVrsBenchTrainingStatus();
    res.json({ success: true, logs: status.logs || [] });
  } catch (err: any) {
    res.status(500).json({ success: false, logs: [], error: err.message });
  }
});

// REAL INFERENCE ENDPOINT
apiRouter.post('/inference/analyze', async (req, res) => {
  try {
    const { image, image_data, imageBase64, question, query, checkpoint } = req.body;
    const activeQuestion = question || query || 'Identify land cover features';
    const activeImage = image || image_data || imageBase64;
    const result = await pythonAgentService.analyzeInference(activeImage, activeQuestion, checkpoint);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// HARDWARE DETECTION ENDPOINT
apiRouter.get('/hardware/info', async (req, res) => {
  try {
    const hw = await pythonAgentService.getHardwareInfo();
    res.json(hw);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// FEATURE 1: Image Upload Endpoint
apiRouter.post('/upload', async (req, res) => {
  try {
    const { fileName, fileData, mimetype, projectId, source } = req.body;
    if (!fileData) {
      res.status(400).json({ error: 'fileData (base64 or binary) is required.' });
      return;
    }
    const cleanFileName = fileName || 'satellite_scene.png';
    const pyResult = await pythonAgentService.uploadFastApi({ fileData, fileName: cleanFileName }).catch(() => null);
    
    if (pyResult) {
      res.json(pyResult);
      return;
    }

    // Fallback through Node image service
    const rawB64 = fileData.includes(',') ? fileData.split(',')[1] : fileData;
    const buffer = Buffer.from(rawB64, 'base64');
    const uploaded = await imageService.uploadImage({
      userId: '00000000-0000-0000-0000-000000000001',
      fileName: cleanFileName,
      buffer,
      mimetype: mimetype || 'image/jpeg',
      projectId: projectId || null,
      source: source || 'Sentinel-2 L2A',
    });

    res.json({
      image_id: uploaded.id,
      filename: uploaded.file_name,
      width: (uploaded.metadata as any)?.width || 1024,
      height: (uploaded.metadata as any)?.height || 1024,
      bands: uploaded.bands?.length || 3,
      format: uploaded.file_name.endsWith('.png') ? 'PNG' : 'JPEG',
      status: 'uploaded',
      url: uploaded.file_url,
    });
  } catch (err: any) {
    res.status(500).json({ error: `Upload failed: ${err.message}` });
  }
});

// FEATURE 1 & 2: Natural Language Analysis & Query Endpoints
apiRouter.post('/analyze', async (req, res) => {
  try {
    const { image, image_id, imageId, question, query, image_data, imageBase64 } = req.body;
    const activeQuery = (question || query || '').trim();
    if (!activeQuery) {
      res.status(400).json({ error: 'question / query string is required.' });
      return;
    }

    const pyResult = await pythonAgentService.executeBridge('analyze', {
      question: activeQuery,
      query: activeQuery,
      image: image || image_data || imageBase64,
      image_id: image_id || imageId,
    });

    res.json(pyResult);
  } catch (err: any) {
    res.status(500).json({ error: `Analysis failed: ${err.message}` });
  }
});

apiRouter.post('/query', async (req, res) => {
  try {
    const { image, image_id, imageId, question, query, image_data, imageBase64 } = req.body;
    const activeQuery = (question || query || '').trim();
    if (!activeQuery) {
      res.status(400).json({ error: 'Query string is required.' });
      return;
    }

    const pyResult = await pythonAgentService.executeBridge('analyze', {
      question: activeQuery,
      query: activeQuery,
      image: image || image_data || imageBase64,
      image_id: image_id || imageId,
    });

    res.json(pyResult);
  } catch (err: any) {
    res.status(500).json({ error: `Query failed: ${err.message}` });
  }
});

// FEATURE 5: Segmentation Endpoint
apiRouter.post('/segment', async (req, res) => {
  try {
    const { task, image_id, imageId, image_data, imageBase64 } = req.body;
    const pyResult = await pythonAgentService.segmentFastApi({
      task: task || 'water',
      image_id: image_id || imageId,
      image_data: image_data || imageBase64,
    });
    res.json(pyResult);
  } catch (err: any) {
    res.status(500).json({ error: `Segmentation failed: ${err.message}` });
  }
});

// Classification & Detection Endpoints
apiRouter.post('/classify', async (req, res) => {
  try {
    const { image_id, imageId, image_data, imageBase64 } = req.body;
    const pyResult = await pythonAgentService.classifyFastApi({
      image_id: image_id || imageId,
      image_data: image_data || imageBase64,
    });
    res.json(pyResult);
  } catch (err: any) {
    res.status(500).json({ error: `Classification failed: ${err.message}` });
  }
});

apiRouter.post('/detect', async (req, res) => {
  try {
    const { target, image_id, imageId, image_data, imageBase64 } = req.body;
    const pyResult = await pythonAgentService.detectFastApi({
      target: target || 'buildings',
      image_id: image_id || imageId,
      image_data: image_data || imageBase64,
    });
    res.json(pyResult);
  } catch (err: any) {
    res.status(500).json({ error: `Detection failed: ${err.message}` });
  }
});

// Mounted Sub-routers
apiRouter.use('/auth', authRoutes);
apiRouter.use('/projects', projectRoutes);
apiRouter.use('/images', imageRoutes);
apiRouter.use('/analysis', analysisRoutes);
apiRouter.use('/alerts', alertRoutes);
apiRouter.use('/ai', aiRoutes);
apiRouter.use('/satellite', satelliteRoutes);
apiRouter.use('/geoscope', geoscopeRoutes);

// Direct top-level aliases specified in API architecture
apiRouter.get('/models', authMiddleware, AnalysisController.getRegistry);
apiRouter.get('/execution/:id', authMiddleware, AnalysisController.getExecutionTrace);
apiRouter.get('/reports/:id/download', authMiddleware, AnalysisController.downloadReport);
apiRouter.get('/reports/:id', authMiddleware, AnalysisController.getReport);
apiRouter.get('/evaluation/benchmarks', authMiddleware, AnalysisController.getBenchmarks);
apiRouter.post('/evaluation/run', authMiddleware, AnalysisController.runEvaluation);

import { inMemoryStore } from '../database/store.js';

// Reset / Clear Data Endpoint
apiRouter.post('/clear-data', (req, res) => {
  inMemoryStore.clearAll();
  res.json({
    success: true,
    data: true,
    message: 'All application data cleared successfully. Platform reset to empty clean state.',
  });
});

// Saved Queries Endpoints
apiRouter.get('/saved-queries', authMiddleware, AnalysisController.getSavedQueries);
apiRouter.post('/saved-queries', authMiddleware, AnalysisController.saveQuery);
apiRouter.delete('/saved-queries/:id', authMiddleware, AnalysisController.deleteSavedQuery);

export default apiRouter;
