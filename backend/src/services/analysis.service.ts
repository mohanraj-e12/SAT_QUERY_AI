import { AnalysisSession, AnalysisType, SatelliteImage } from '../models/types.js';
import { inMemoryStore } from '../database/store.js';
import { getSupabaseAdminClient } from '../database/supabase.client.js';
import { imageService } from './image.service.js';
import { alertService } from './alert.service.js';
import { pythonAgentService } from './python-agent.service.js';

export class AnalysisService {
  /**
   * Process a natural language query against a satellite image using Agentic Python Backend
   */
  public async queryImage(params: {
    userId: string;
    imageId: string;
    query: string;
    projectId?: string | null;
    explicitType?: AnalysisType;
    imageBase64?: string;
    imageContext?: SatelliteImage;
    secondaryImageId?: string | null;
    secondaryImageContext?: SatelliteImage;
    inputMode?: 'SINGLE' | 'CROSS_MODAL_PAIR' | 'BITEMPORAL_PAIR' | 'AUTO';
    parameters?: Record<string, any>;
  }): Promise<AnalysisSession> {
    const {
      userId,
      imageId,
      query,
      projectId,
      explicitType,
      imageBase64,
      imageContext,
      secondaryImageId,
      secondaryImageContext,
      inputMode,
      parameters,
    } = params;

    const storedImage = await imageService.getImageById(imageId);
    const image = storedImage || (
      imageContext?.id === imageId
        ? { ...imageContext, file_url: imageContext.file_url || imageBase64 || '' }
        : null
    );
    if (!image) {
      throw new Error(`Satellite image with ID ${imageId} not found.`);
    }

    let secondaryImage: any = null;
    if (secondaryImageId) {
      secondaryImage = (await imageService.getImageById(secondaryImageId)) || (
        secondaryImageContext?.id === secondaryImageId
          ? secondaryImageContext
          : null
      );
    } else if (image.metadata?.co_registered_pair_id) {
      secondaryImage = await imageService.getImageById(image.metadata.co_registered_pair_id);
    }

    const mergedParams = {
      ...(parameters || {}),
    };

    // Try executing via Python Remote-Sensing Specialist Agentic Pipeline first
    let analysisResultData: any = null;
    let confidence: number | undefined;
    let detectedAnalysisType: AnalysisType = explicitType || 'GENERAL_QUERY';

    try {
      const pyResult = await pythonAgentService.query({
        query,
        primary_image: image,
        secondary_image: secondaryImage || undefined,
        input_mode: inputMode || (secondaryImage ? (image.metadata?.modality === 'SAR' || secondaryImage?.metadata?.modality === 'SAR' ? 'CROSS_MODAL_PAIR' : 'BITEMPORAL_PAIR') : 'SINGLE'),
        parameters: mergedParams,
      });

      if (pyResult) {
        if (pyResult.is_valid_satellite === false) {
          analysisResultData = {
            analysisType: 'GENERAL_QUERY',
            isValidSatellite: false,
            summary: pyResult.summary,
            directAnswer: pyResult.direct_answer || pyResult.summary,
            confidence: typeof pyResult.confidence === 'number' ? pyResult.confidence : undefined,
            statistics: {},
            detections: [],
            recommendations: pyResult.recommendations || ['Please submit a valid satellite image.'],
            executionTrace: pyResult.execution_trace || [],
            totalLatencyMs: pyResult.total_latency_ms,
          };
        } else {
          if (pyResult.task === 'CROSS_MODAL_PAIR_ANALYSIS') {
            detectedAnalysisType = 'CROSS_MODAL_ANALYSIS' as any;
          } else if (pyResult.task === 'BITEMPORAL_CHANGE_ANALYSIS') {
            detectedAnalysisType = 'CHANGE_DETECTION';
          } else if (pyResult.task === 'TEXT_GUIDED_REGION_GROUNDING') {
            detectedAnalysisType = 'OBJECT_DETECTION';
          } else if (pyResult.task === 'SCENE_CAPTIONING') {
            detectedAnalysisType = 'SCENE_CAPTIONING' as any;
          } else {
            detectedAnalysisType = pyResult.question_category || explicitType || 'GENERAL_QUERY';
          }

          confidence = typeof pyResult.confidence === 'number' && Number.isFinite(pyResult.confidence)
            ? pyResult.confidence
            : undefined;
          const normalizedDetections = (pyResult.detections || [])
            .filter((det: any) =>
              (Array.isArray(det.box_2d) && det.box_2d.length === 4)
              || (det.bounding_box && ['xmin', 'ymin', 'xmax', 'ymax'].every((key) => Number.isFinite(det.bounding_box[key])))
            )
            .map((det: any, idx: number) => {
            const box: [number, number, number, number] = Array.isArray(det.box_2d)
              ? det.box_2d
              : [det.bounding_box.ymin, det.bounding_box.xmin, det.bounding_box.ymax, det.bounding_box.xmax];
            let cat = det.category || 'infrastructure';
            if (det.label?.toLowerCase().includes('water')) cat = 'water_body';
            else if (det.label?.toLowerCase().includes('build') || det.label?.toLowerCase().includes('masonry')) cat = 'building';
            else if (det.label?.toLowerCase().includes('runway') || det.label?.toLowerCase().includes('road')) cat = 'road';
            else if (det.label?.toLowerCase().includes('vegetat') || det.label?.toLowerCase().includes('canopy')) cat = 'vegetation';

            return {
              id: det.id || `py-det-${idx}`,
              label: det.label || 'Target Object',
              category: cat,
              ...(typeof det.confidence === 'number' && Number.isFinite(det.confidence)
                ? { confidence: det.confidence }
                : {}),
              box_2d: box,
              ...(det.area_ha !== undefined
                ? { area_sq_m: det.area_ha * 10000 }
                : det.area_sq_m !== undefined
                  ? { area_sq_m: det.area_sq_m }
                  : {}),
              modality_evidence: det.modality_evidence,
            };
          });

          const stats = pyResult.statistics || {};

          analysisResultData = {
            analysisType: detectedAnalysisType,
            isValidSatellite: true,
            summary: pyResult.summary,
            directAnswer: pyResult.direct_answer || pyResult.summary,
            questionCategory: pyResult.question_category,
            moduleRoute: pyResult.module_route,
            moduleResult: pyResult.module_result,
            suggestedFollowups: pyResult.suggested_followups || [],
            confidence: pyResult.confidence,
            statistics: stats,
            imageAnalysis: pyResult.image_analysis,
            detections: normalizedDetections,
            recommendations: pyResult.recommendations || [],
            executionTrace: pyResult.execution_trace || [],
            auditableSummary: pyResult.auditable_summary,
            modelsExecuted: pyResult.models_executed,
            toolsExecuted: pyResult.tools_executed,
            landCover: pyResult.land_cover,
            changeMetrics: pyResult.change_metrics,
            crossModalMetrics: pyResult.cross_modal_metrics,
            totalLatencyMs: pyResult.total_latency_ms,
            agentsExecuted: pyResult.agents_executed,
            spectralIndices: pyResult.spectral_indices,
            geojsonLayers: pyResult.geojson_layers,
            keyTakeaways: pyResult.key_takeaways,
          };
        }
      }
    } catch (pyErr) {
      console.error('[AnalysisService] Python image analysis failed:', pyErr);
      throw new Error('Image analysis could not be completed; no synthetic result was generated.');
    }

    if (!analysisResultData) {
      throw new Error('Image analysis returned no result; no synthetic result was generated.');
    }

    // 3. Save Session
    const session: AnalysisSession = {
      id: crypto.randomUUID(),
      user_id: userId,
      project_id: projectId || image.project_id || null,
      image_id: imageId,
      query,
      analysis_type: detectedAnalysisType,
      result: analysisResultData,
      ...(confidence !== undefined ? { confidence } : {}),
      created_at: new Date().toISOString(),
    };

    const supabase = getSupabaseAdminClient();
    if (supabase) {
      try {
        await supabase.from('analysis_sessions').insert({
          id: session.id,
          user_id: session.user_id,
          project_id: session.project_id,
          image_id: session.image_id,
          query: session.query,
          analysis_type: session.analysis_type,
          result: session.result,
          confidence: session.confidence,
          created_at: session.created_at,
        });

        // Insert result row
        await supabase.from('analysis_results').insert({
          id: crypto.randomUUID(),
          session_id: session.id,
          result_type: session.analysis_type,
          result_data: session.result,
          image_url: image.file_url,
          statistics: session.result.statistics,
          created_at: session.created_at,
        });
      } catch (err) {
        console.warn('[AnalysisService] Supabase session save error:', err);
      }
    }

    inMemoryStore.sessions.set(session.id, session);
    return session;
  }

  public async getHistory(userId: string, filters?: {
    projectId?: string;
    analysisType?: string;
    search?: string;
  }): Promise<AnalysisSession[]> {
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      try {
        let q = supabase
          .from('analysis_sessions')
          .select('*')
          .order('created_at', { ascending: false });

        if (filters?.projectId) q = q.eq('project_id', filters.projectId);
        if (filters?.analysisType) q = q.eq('analysis_type', filters.analysisType);

        const { data, error } = await q;
        if (!error && data) {
          return data as AnalysisSession[];
        }
      } catch (err) {
        console.warn('[AnalysisService] Supabase history query failed:', err);
      }
    }

    let all = Array.from(inMemoryStore.sessions.values());
    if (filters?.projectId) {
      all = all.filter((s) => s.project_id === filters.projectId);
    }
    if (filters?.analysisType) {
      all = all.filter((s) => s.analysis_type === filters.analysisType);
    }
    if (filters?.search) {
      const term = filters.search.toLowerCase();
      all = all.filter(
        (s) =>
          s.query.toLowerCase().includes(term) ||
          s.result.summary.toLowerCase().includes(term)
      );
    }
    return all;
  }

  public async getSessionById(id: string): Promise<AnalysisSession | null> {
    return inMemoryStore.sessions.get(id) || null;
  }
}

export const analysisService = new AnalysisService();
