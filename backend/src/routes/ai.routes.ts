import { Router, Response } from 'express';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth.middleware.js';
import { openRouterService } from '../services/openrouter.service.js';
import { imageService } from '../services/image.service.js';
import { analysisService } from '../services/analysis.service.js';

const router = Router();

/**
 * GET /api/ai/health
 * Returns OpenRouter service configuration and operational status
 */
router.get('/health', (req, res: Response) => {
  const status = openRouterService.getHealthStatus();
  res.json({
    success: true,
    data: status,
    message: status.configured ? 'OpenRouter AI Service is configured.' : 'OpenRouter API key is not configured in backend.',
  });
});

/**
 * POST /api/ai/query
 * Processes a satellite question with OpenRouter LLM using available image evidence & spectral pipeline
 */
router.post('/query', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';
    const {
      question,
      query,
      imageId,
      imageContext: suppliedImageContext,
      imageBase64,
      projectId,
      evidence,
      analysisResults,
      preferredModel,
      sessionId,
    } = req.body;

    const userQuestion = question || query;

    if (!userQuestion) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'A question or query string is required.' },
      });
      return;
    }

    let imageContext = evidence?.image || suppliedImageContext || null;
    let existingResults = analysisResults || null;

    // If imageId is provided, fetch image metadata and run/fetch pipeline context
    if (imageId && !imageContext) {
      const fetchedImage = await imageService.getImageById(imageId);
      if (fetchedImage) {
        imageContext = fetchedImage;
      }
    }

    // If analysis results were not passed but an imageId or sessionId exists, perform analysis or retrieve
    if (imageId && !existingResults) {
      try {
        const session = await analysisService.queryImage({
          userId,
          imageId,
          query: userQuestion,
          projectId: projectId || (imageContext ? imageContext.project_id : null),
          imageContext: imageContext || undefined,
          imageBase64,
        });
        existingResults = session.result;
      } catch (analErr) {
        console.warn('[AI Routes] Analysis pipeline evaluation error:', analErr);
      }
    }

    const completion = await openRouterService.generateAnswer(
      userQuestion,
      {
        image: imageContext,
        ...(evidence || {}),
      },
      existingResults,
      preferredModel
    );

    res.json({
      success: true,
      data: {
        question: userQuestion,
        answer: completion.answer,
        model: completion.model,
        workingAssistant: completion.workingAssistant,
        assistantRole: completion.assistantRole,
        autoSwitchedModel: completion.autoSwitchedModel,
        confidence: completion.confidence,
        evidence: completion.evidence,
        analysisResults: existingResults,
        usage: completion.usage,
        timestamp: new Date().toISOString(),
      },
      message: 'AI query reasoning generated successfully.',
    });
  } catch (err: any) {
    console.error('[AI Routes] OpenRouter query error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'AI_QUERY_FAILED', message: err.message || 'Internal AI query failure.' },
    });
  }
});

export default router;
