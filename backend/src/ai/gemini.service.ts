import { AnalysisResultData, AnalysisType, SatelliteImage, ObjectDetectionItem } from '../models/types.js';
import { pythonAgentService } from '../services/python-agent.service.js';

export class GeminiService {
  public async analyzeSatelliteImage(
    query: string,
    analysisType: AnalysisType,
    image: SatelliteImage,
    imageBase64?: string
  ): Promise<AnalysisResultData> {
    const result = await pythonAgentService.query({
      query,
      primary_image: {
        ...image,
        file_url: imageBase64 || image.file_url,
      },
      input_mode: 'SINGLE',
    });
    const indices = result.image_analysis?.indices || {};
    const preferredIndex = query.toLowerCase().includes('ndvi')
      ? 'ndvi'
      : query.toLowerCase().includes('ndbi')
        ? 'ndbi'
        : query.toLowerCase().includes('ndwi')
          ? (indices.mndwi ? 'mndwi' : 'ndwi')
          : undefined;
    const index = preferredIndex ? indices[preferredIndex] : undefined;
    const detections: ObjectDetectionItem[] = (result.detections || [])
      .filter((detection: any) => Array.isArray(detection.box_2d) && detection.box_2d.length === 4)
      .map((detection: any) => ({
        id: detection.id,
        label: detection.label,
        category: detection.category,
        ...(typeof detection.confidence === 'number' ? { confidence: detection.confidence } : {}),
        box_2d: detection.box_2d,
        modality_evidence: detection.modality_evidence,
      }));
    return {
      analysisType,
      isValidSatellite: result.is_valid_satellite,
      summary: result.summary,
      directAnswer: result.direct_answer || result.summary,
      ...(typeof result.confidence === 'number' ? { confidence: result.confidence } : {}),
      statistics: result.statistics || {},
      detections,
      recommendations: result.recommendations || [],
      imageAnalysis: result.image_analysis,
      executionTrace: result.execution_trace || [],
      agentsExecuted: result.agents_executed || [],
      toolsExecuted: result.tools_executed || [],
      landCover: result.land_cover,
      spectralIndices: result.spectral_indices,
      geojsonLayers: result.geojson_layers,
      keyTakeaways: result.key_takeaways || [],
      ...(index ? {
        spectralInterpretation: {
          indexName: preferredIndex === 'ndvi' ? 'NDVI' as const : preferredIndex === 'ndbi' ? 'NDBI' as const : 'NDWI' as const,
          formula: index.formula,
          scientificMeasurement: `Mean ${index.mean.toFixed(3)}; range ${index.minimum.toFixed(3)} to ${index.maximum.toFixed(3)}`,
          aiInterpretation: result.direct_answer || result.summary,
          colorScale: { min: 'low', mid: 'zero', max: 'high' },
        },
      } : {}),
    };
  }
}

export const geminiService = new GeminiService();
