import { Router } from 'express';
import { AnalysisController } from '../controllers/analysis.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

// Model Registry & Evaluation Standards
router.get('/registry', authMiddleware, AnalysisController.getRegistry);
router.get('/models', authMiddleware, AnalysisController.getRegistry);
router.get('/evaluation-criteria', authMiddleware, AnalysisController.getEvaluationCriteria);
router.get('/benchmarks', authMiddleware, AnalysisController.getBenchmarks);
router.post('/evaluation/run', authMiddleware, AnalysisController.runEvaluation);
router.get('/dataset/bigearthnet', authMiddleware, AnalysisController.getDatasetInfo);
router.post('/train/bigearthnet', authMiddleware, AnalysisController.trainBigEarthNet);
router.post('/evaluate-uploaded', authMiddleware, AnalysisController.evaluateUploadedImage);

// Agentic Query Execution
router.post('/agentic-query', authMiddleware, AnalysisController.agenticQuery);
router.post('/run', authMiddleware, AnalysisController.agenticQuery);
router.post('/query', authMiddleware, AnalysisController.query);

// Specialist Remote Sensing Task Routes
router.post('/vqa', authMiddleware, AnalysisController.vqa);
router.post('/caption', authMiddleware, AnalysisController.caption);
router.post('/ground', authMiddleware, AnalysisController.ground);
router.post('/change', authMiddleware, AnalysisController.analyzeChange);
router.post('/change-detection', authMiddleware, AnalysisController.analyzeChange);
router.post('/cross-modal', authMiddleware, AnalysisController.crossModal);
router.post('/vegetation', authMiddleware, AnalysisController.analyzeVegetation);
router.post('/water', authMiddleware, AnalysisController.analyzeWater);
router.post('/object-detection', authMiddleware, AnalysisController.analyzeObjects);

// History, Execution Trace & Auditable Reports
router.get('/history', authMiddleware, AnalysisController.getHistory);
router.get('/execution/:id', authMiddleware, AnalysisController.getExecutionTrace);
router.get('/reports/:id/download', authMiddleware, AnalysisController.downloadReport);
router.get('/reports/:id', authMiddleware, AnalysisController.getReport);
router.get('/:id', authMiddleware, AnalysisController.getSessionById);

export default router;
