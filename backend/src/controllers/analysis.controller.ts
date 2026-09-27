import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { analysisService } from '../services/analysis.service.js';
import { reportService } from '../services/report.service.js';
import { inMemoryStore } from '../database/store.js';

export class AnalysisController {
  public static async query(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';
      const {
        imageId,
        query,
        projectId,
        imageBase64,
        imageContext,
        secondaryImageId,
        secondaryImageContext,
        inputMode,
        parameters,
      } = req.body;

      if (!imageId || !query) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'imageId and natural-language query are required.' },
        });
        return;
      }

      const session = await analysisService.queryImage({
        userId,
        imageId,
        query,
        projectId,
        imageBase64,
        imageContext,
        secondaryImageId,
        secondaryImageContext,
        inputMode,
        parameters,
      });

      res.json({
        success: true,
        data: session,
        message: 'Analysis completed successfully',
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'ANALYSIS_FAILED', message: err.message },
      });
    }
  }

  public static async analyzeVegetation(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';
      const { imageId, projectId, query } = req.body;

      const session = await analysisService.queryImage({
        userId,
        imageId,
        query: query || 'Analyze vegetation canopy density and NDVI index',
        projectId,
        explicitType: 'VEGETATION',
      });

      res.json({
        success: true,
        data: session,
        message: 'Vegetation NDVI analysis completed successfully',
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'VEGETATION_ANALYSIS_FAILED', message: err.message },
      });
    }
  }

  public static async analyzeWater(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';
      const { imageId, projectId, query } = req.body;

      const session = await analysisService.queryImage({
        userId,
        imageId,
        query: query || 'Identify water bodies and compute NDWI delineation',
        projectId,
        explicitType: 'WATER_DETECTION',
      });

      res.json({
        success: true,
        data: session,
        message: 'Water body NDWI analysis completed successfully',
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'WATER_ANALYSIS_FAILED', message: err.message },
      });
    }
  }

  public static async analyzeChange(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';
      const { imageId, secondaryImageId, projectId, query, imageBase64, parameters } = req.body;

      const session = await analysisService.queryImage({
        userId,
        imageId,
        secondaryImageId,
        imageBase64,
        query: query || 'Compare these satellite acquisitions and detect bi-temporal change, land improvements, and environmental factors',
        projectId,
        explicitType: 'CHANGE_DETECTION',
        inputMode: 'BITEMPORAL_PAIR',
        parameters,
      });

      res.json({
        success: true,
        data: session,
        message: 'Bi-temporal change detection completed successfully',
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'CHANGE_DETECTION_FAILED', message: err.message },
      });
    }
  }

  public static async analyzeObjects(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';
      const { imageId, projectId, query } = req.body;

      const session = await analysisService.queryImage({
        userId,
        imageId,
        query: query || 'Identify buildings, infrastructure, and discrete spatial targets',
        projectId,
        explicitType: 'OBJECT_DETECTION',
      });

      res.json({
        success: true,
        data: session,
        message: 'Object detection completed successfully',
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'OBJECT_DETECTION_FAILED', message: err.message },
      });
    }
  }

  public static async getHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';
      const { projectId, analysisType, search } = req.query;

      const history = await analysisService.getHistory(userId, {
        projectId: projectId as string | undefined,
        analysisType: analysisType as string | undefined,
        search: search as string | undefined,
      });

      res.json({
        success: true,
        data: history,
        message: 'Analysis history retrieved successfully',
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'HISTORY_FETCH_FAILED', message: err.message },
      });
    }
  }

  public static async getSessionById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const session = await analysisService.getSessionById(req.params.id);
      if (!session) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Analysis session not found' },
        });
        return;
      }
      res.json({
        success: true,
        data: session,
        message: 'Analysis session retrieved successfully',
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'SESSION_FETCH_FAILED', message: err.message },
      });
    }
  }

  // Saved Queries
  public static async getSavedQueries(req: AuthenticatedRequest, res: Response): Promise<void> {
    const queries = Array.from(inMemoryStore.savedQueries.values());
    res.json({ success: true, data: queries });
  }

  public static async saveQuery(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { query, category, projectId } = req.body;
    if (!query) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Query is required' } });
      return;
    }
    const saved = {
      id: crypto.randomUUID(),
      user_id: req.user?.id || '00000000-0000-0000-0000-000000000001',
      project_id: projectId || null,
      query,
      category: category || 'General',
      created_at: new Date().toISOString(),
    };
    inMemoryStore.savedQueries.set(saved.id, saved);
    res.status(201).json({ success: true, data: saved, message: 'Query saved successfully' });
  }

  public static async deleteSavedQuery(req: AuthenticatedRequest, res: Response): Promise<void> {
    const success = inMemoryStore.savedQueries.delete(req.params.id);
    res.json({ success, message: 'Saved query deleted successfully' });
  }

  // Python Deep Learning Models Registry & ISRO/SAC Benchmark Evaluation
  public static async getRegistry(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { pythonAgentService } = await import('../services/python-agent.service.js');
      const registryData = await pythonAgentService.getRegistry();
      res.json({ success: true, data: registryData });
    } catch (err: any) {
      res.status(500).json({ success: false, error: { code: 'REGISTRY_ERROR', message: err.message } });
    }
  }

  public static async getEvaluationCriteria(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { pythonAgentService } = await import('../services/python-agent.service.js');
      const evalData = await pythonAgentService.getEvaluationCriteria();
      res.json({ success: true, data: evalData });
    } catch (err: any) {
      res.status(500).json({ success: false, error: { code: 'EVAL_CRITERIA_ERROR', message: err.message } });
    }
  }

  public static async agenticQuery(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';
      const { imageId, query, projectId, secondaryImageId, inputMode, parameters } = req.body;

      if (!imageId || !query) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'imageId and natural-language query are required.' },
        });
        return;
      }

      const session = await analysisService.queryImage({
        userId,
        imageId,
        query,
        projectId,
        secondaryImageId,
        inputMode,
        parameters,
      });

      res.json({
        success: true,
        data: session,
        message: 'Agentic remote-sensing query completed successfully',
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'AGENTIC_ANALYSIS_FAILED', message: err.message },
      });
    }
  }

  // Specialized Task Endpoints
  public static async vqa(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';
      const { imageId, query, projectId } = req.body;
      const session = await analysisService.queryImage({
        userId,
        imageId,
        query: query || 'What type of land cover and structures are visible?',
        projectId,
        explicitType: 'GENERAL_QUERY',
      });
      res.json({ success: true, data: session, message: 'RSVQA inference completed successfully' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: { code: 'VQA_FAILED', message: err.message } });
    }
  }

  public static async caption(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';
      const { imageId, query, projectId } = req.body;
      const session = await analysisService.queryImage({
        userId,
        imageId,
        query: query || 'Describe the land-cover and major objects visible in this image.',
        projectId,
        explicitType: 'SCENE_CAPTIONING',
      });
      res.json({ success: true, data: session, message: 'Scene captioning completed successfully' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: { code: 'CAPTIONING_FAILED', message: err.message } });
    }
  }

  public static async ground(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';
      const { imageId, query, projectId } = req.body;
      const session = await analysisService.queryImage({
        userId,
        imageId,
        query: query || 'Highlight the water body referred to in the query.',
        projectId,
        explicitType: 'OBJECT_DETECTION',
      });
      res.json({ success: true, data: session, message: 'Text-guided region grounding completed successfully' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: { code: 'GROUNDING_FAILED', message: err.message } });
    }
  }

  public static async crossModal(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';
      const { imageId, secondaryImageId, query, projectId, parameters } = req.body;
      const session = await analysisService.queryImage({
        userId,
        imageId,
        secondaryImageId,
        query: query || 'Use the optical and SAR images together to identify built-up and water-covered regions.',
        projectId,
        inputMode: 'CROSS_MODAL_PAIR',
        parameters,
      });
      res.json({ success: true, data: session, message: 'Optical + SAR cross-modal fusion completed successfully' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: { code: 'CROSS_MODAL_FAILED', message: err.message } });
    }
  }

  public static async getExecutionTrace(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const session = await analysisService.getSessionById(req.params.id);
      if (!session) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Session not found' } });
        return;
      }
      res.json({
        success: true,
        data: {
          sessionId: session.id,
          task: session.analysis_type,
          auditableSummary: session.result?.auditableSummary,
          executionTrace: session.result?.executionTrace || [],
          modelsExecuted: session.result?.modelsExecuted || [],
          toolsExecuted: session.result?.toolsExecuted || [],
          latencyMs: session.result?.totalLatencyMs,
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: { code: 'TRACE_FETCH_FAILED', message: err.message } });
    }
  }

  public static async getBenchmarks(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { pythonAgentService } = await import('../services/python-agent.service.js');
      const benchmarks = await pythonAgentService.getBenchmarks();
      res.json({ success: true, data: benchmarks });
    } catch (err: any) {
      res.status(500).json({ success: false, error: { code: 'BENCHMARK_FETCH_FAILED', message: err.message } });
    }
  }

  public static async runEvaluation(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { pythonAgentService } = await import('../services/python-agent.service.js');
      const { benchmarkId, options } = req.body || {};
      const evalResult = await pythonAgentService.runEvaluation(benchmarkId, options);
      res.json({ success: true, data: evalResult, message: 'Benchmark evaluation executed successfully' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: { code: 'EVALUATION_FAILED', message: err.message } });
    }
  }

  public static async getDatasetInfo(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { pythonAgentService } = await import('../services/python-agent.service.js');
      const info = await pythonAgentService.getDatasetInfo();
      res.json({ success: true, data: info });
    } catch (err: any) {
      res.status(500).json({ success: false, error: { code: 'DATASET_INFO_FAILED', message: err.message } });
    }
  }

  public static async trainBigEarthNet(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { pythonAgentService } = await import('../services/python-agent.service.js');
      const { epochs, maxSamples } = req.body || {};
      const result = await pythonAgentService.trainBigEarthNet(epochs, maxSamples);
      res.json({ success: true, data: result, message: 'BigEarthNet model training completed successfully' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: { code: 'TRAINING_FAILED', message: err.message } });
    }
  }

  public static async evaluateUploadedImage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { pythonAgentService } = await import('../services/python-agent.service.js');
      const { image, query } = req.body || {};
      const evaluation = await pythonAgentService.evaluateUploadedImage(image, query);
      res.json({ success: true, data: evaluation, message: 'Image evaluated against trained BigEarthNet dataset successfully' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: { code: 'EVALUATION_FAILED', message: err.message } });
    }
  }

  public static async getReport(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const report = await reportService.generateReport(req.params.id);
      if (!report) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Analysis report not found' } });
        return;
      }
      res.json({ success: true, data: report });
    } catch (err: any) {
      res.status(500).json({ success: false, error: { code: 'REPORT_FAILED', message: err.message } });
    }
  }

  public static async downloadReport(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const report = await reportService.generateReport(req.params.id);
      if (!report) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Analysis report not found' } });
        return;
      }
      const pdf = await reportService.generatePdfReport(report);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${report.reportId}_SatQueryAI_Report.pdf"`);
      res.send(pdf);
    } catch (err: any) {
      res.status(500).json({ success: false, error: { code: 'DOWNLOAD_FAILED', message: err.message } });
    }
  }
}
