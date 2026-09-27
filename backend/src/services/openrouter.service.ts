import { config } from '../config/env.config.js';
import { SatelliteImage, SpectralStatistics } from '../models/types.js';

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface SatelliteEvidenceContext {
  image?: Partial<SatelliteImage> | null;
  analysisType?: string;
  spectralIndices?: {
    ndvi?: { mean?: number; min?: number; max?: number; coveragePercent?: number };
    ndwi?: { mean?: number; min?: number; max?: number; coveragePercent?: number; isWaterDetected?: boolean };
    ndbi?: { mean?: number; min?: number; max?: number; coveragePercent?: number };
    savi?: { mean?: number };
  };
  statistics?: SpectralStatistics;
  detections?: Array<{
    id?: string;
    label: string;
    category?: string;
    confidence: number;
    box_2d?: [number, number, number, number];
    area_sq_m?: number;
  }>;
  visualObservations?: string[];
  computedMeasurementsAvailable?: {
    ndwiCalculated: boolean;
    ndviCalculated: boolean;
    ndbiCalculated: boolean;
    changeDetectionCalculated: boolean;
    segmentationCalculated: boolean;
  };
  geographicMetadata?: {
    latitude?: number;
    longitude?: number;
    satellite?: string;
    sensor?: string;
    resolutionMeters?: number;
    acquisitionDate?: string;
    cloudPercentage?: number;
    bands?: string[];
  };
  additionalContext?: Record<string, any>;
}

export interface OpenRouterCompletionResult {
  answer: string;
  model: string;
  workingAssistant: string;
  assistantRole: string;
  autoSwitchedModel: string;
  confidence: number | null;
  evidence: Record<string, any>;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

interface OpenRouterChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  model?: string;
  usage?: OpenRouterCompletionResult['usage'];
}

export interface WorkingAssistantProfile {
  title: string;
  role: string;
  domain: string;
  recommendedModels: string[];
}

export class OpenRouterService {
  private primaryModel: string;
  private fallbackModels: string[];
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = config.openrouterApiKey;
    this.primaryModel = config.openrouterModel || 'openrouter/auto';
    this.fallbackModels = config.openrouterFallbackModels || [
      'openrouter/auto',
      'google/gemma-4-31b-it:free',
      'google/gemma-4-26b-a4b-it:free',
      'nvidia/nemotron-3.5-lightning:free',
      'liquid/lfm-2.5-2.6b:free',
      'meta-llama/llama-3.2-11b-vision-instruct:free',
      'meta-llama/llama-3.3-70b-instruct:free',
      'qwen/qwen-2.5-vl-72b-instruct:free',
    ];
    this.baseUrl = config.openrouterBaseUrl || 'https://openrouter.ai/api/v1';
  }

  /**
   * Identifies the exact working assistant specialist based on query intent, analysis type, and evidence
   */
  public determineWorkingAssistant(
    analysisType?: string,
    query?: string,
    evidence?: SatelliteEvidenceContext | null
  ): WorkingAssistantProfile {
    const q = (query || '').toLowerCase();
    const type = (analysisType || '').toUpperCase();

    // 1. Bi-Temporal Change Detection & Land Improvement Specialist
    if (
      type === 'CHANGE_DETECTION' ||
      type === 'BITEMPORAL_CHANGE_ANALYSIS' ||
      q.includes('change') ||
      q.includes('before') ||
      q.includes('after') ||
      q.includes('expansion') ||
      q.includes('deforest') ||
      q.includes('improvement')
    ) {
      return {
        title: 'Bi-Temporal Change Detection Specialist',
        role: 'CDVQA Multi-Temporal Transition Engine',
        domain: 'Multi-Temporal Differencing & Land Conversion',
        recommendedModels: [
          'openrouter/auto',
          'google/gemma-4-31b-it:free',
          'meta-llama/llama-3.3-70b-instruct:free',
          'nvidia/nemotron-3.5-lightning:free',
          'liquid/lfm-2.5-2.6b:free',
        ],
      };
    }

    // 2. Spectral & Hydrological Analyst (NDWI / NDVI / NDBI / Land-Water Math)
    if (
      type === 'SPECTRAL_ANALYSIS' ||
      q.includes('water') ||
      q.includes('lake') ||
      q.includes('river') ||
      q.includes('reservoir') ||
      q.includes('vegetat') ||
      q.includes('ndvi') ||
      q.includes('ndwi') ||
      q.includes('ndbi') ||
      q.includes('split') ||
      q.includes('percentage') ||
      q.includes('canopy') ||
      q.includes('built-up')
    ) {
      return {
        title: 'Spectral & Hydrological Analyst',
        role: 'NDWI / NDVI Multi-Band Radiometric Engine',
        domain: 'Radiometric Calibration & Land-Water Partitioning',
        recommendedModels: [
          'openrouter/auto',
          'google/gemma-4-31b-it:free',
          'nvidia/nemotron-3.5-lightning:free',
          'google/gemma-4-26b-a4b-it:free',
          'liquid/lfm-2.5-2.6b:free',
        ],
      };
    }

    // 3. SAR Polarimetric Radar Specialist
    if (
      type === 'SAR_ANALYSIS' ||
      type === 'CROSS_MODAL_ANALYSIS' ||
      q.includes('sar') ||
      q.includes('radar') ||
      q.includes('backscatter') ||
      q.includes('polarim') ||
      q.includes('sentinel-1') ||
      q.includes('roughness')
    ) {
      return {
        title: 'SAR Polarimetric Radar Specialist',
        role: 'Sentinel-1 Dual-Pol Backscatter Engine',
        domain: 'Synthetic Aperture Radar & Roughness Penetration',
        recommendedModels: [
          'openrouter/auto',
          'google/gemma-4-31b-it:free',
          'meta-llama/llama-3.3-70b-instruct:free',
          'liquid/lfm-2.5-2.6b:free',
        ],
      };
    }

    // 4. Object Grounding & Spatial Delineation Vision Specialist
    if (
      type === 'OBJECT_DETECTION' ||
      type === 'TEXT_GUIDED_REGION_GROUNDING' ||
      q.includes('detect') ||
      q.includes('locate') ||
      q.includes('find') ||
      q.includes('runway') ||
      q.includes('airport') ||
      q.includes('plane') ||
      q.includes('aircraft') ||
      q.includes('ship') ||
      q.includes('vessel') ||
      q.includes('building') ||
      q.includes('box')
    ) {
      return {
        title: 'GeoGrounding Vision Specialist',
        role: 'Spatial Grounding & Bounding Delineation Agent',
        domain: 'Object Detection & Top-Down Feature Grounding',
        recommendedModels: [
          'openrouter/auto',
          'meta-llama/llama-3.2-11b-vision-instruct:free',
          'qwen/qwen-2.5-vl-72b-instruct:free',
          'google/gemma-4-31b-it:free',
          'nvidia/nemotron-3.5-lightning:free',
        ],
      };
    }

    // 5. BigEarthNet Land Cover Classifier
    if (
      type === 'LAND_COVER_CLASSIFICATION' ||
      q.includes('land cover') ||
      q.includes('classif') ||
      q.includes('corine') ||
      q.includes('bigearthnet') ||
      q.includes('urban class')
    ) {
      return {
        title: 'BigEarthNet Land Cover Classifier',
        role: '19-Class Multi-Modal CORINE Classifier',
        domain: 'Multispectral Land Use Classification',
        recommendedModels: [
          'openrouter/auto',
          'google/gemma-4-31b-it:free',
          'nvidia/nemotron-3.5-lightning:free',
          'google/gemma-4-26b-a4b-it:free',
        ],
      };
    }

    // 6. Default: GeoVLM Scene Captioner & Remote Sensing Assistant
    return {
      title: 'GeoVLM Remote Sensing Assistant',
      role: 'Earth Observation Multi-Modal Synthesis Engine',
      domain: 'Top-Down Geospatial Natural Language Q&A',
      recommendedModels: [
        'openrouter/auto',
        'google/gemma-4-31b-it:free',
        'liquid/lfm-2.5-2.6b:free',
        'nvidia/nemotron-3.5-lightning:free',
      ],
    };
  }

  /**
   * Health check / configuration verification (without exposing API key)
   */
  public getHealthStatus(): {
    success: boolean;
    provider: string;
    configured: boolean;
    primaryModel: string;
    fallbackModelsCount: number;
  } {
    return {
      success: true,
      provider: 'OpenRouter',
      configured: Boolean(this.apiKey && this.apiKey.startsWith('sk-or-')),
      primaryModel: this.primaryModel,
      fallbackModelsCount: this.fallbackModels.length,
    };
  }

  /**
   * Builds the strict SatQueryAI system prompt emphasizing ground truth & anti-fabrication
   */
  public getSatQuerySystemPrompt(): string {
    return `You are SatQueryAI, an expert Geospatial Remote Sensing Analysis Assistant.

CRITICAL DIRECTIVE:
You MUST answer the user's question by directly analyzing the specific satellite image evidence provided in the context. DO NOT give generic, predefined, or "inbuilt" canned answers. Your entire response must be strictly grounded in the concrete remote-sensing metrics, spectral indices, classified land-cover profiles, geographic metadata, and object detections extracted for this exact image.

STRICT OPERATIONAL & SCIENTIFIC RULES:
1. IMAGE-SPECIFIC ANALYSIS: Always ground your answer in the specific satellite image being queried (referencing the satellite sensor, spatial resolution, coordinates, acquisition date, spectral band indicators, and detected features from the provided context).
2. NEVER FABRICATE OR GENERALIZE: Do not recite generic textbook definitions or generic AI responses. If the user asks about water, vegetation, buildings, runways, roads, or terrain, analyze whether that specific feature is detected, absent, or measured in the provided data.
3. LAND & WATER SPLIT PERCENTAGE:
   - NEVER equate Mean NDWI with water surface coverage percentage. Radiometric indices (-1.0 to +1.0) measure spectral reflectance ratios, while surface percentages come from segmented pixel counts.
   - For land/water queries, use the exact pixel percentages provided in the evidence.
   - When asked for "land and water split" or similar, present the answer clearly:
     Land: <X>%
     Water: <Y>%

     Method: <Spectral NDWI segmentation / Pixel-based classification / Visual estimate>
     Confidence: <High / Moderate / Low>
4. WATER & HYDROLOGY:
   - If water features are detected in the evidence: State the calculated water coverage percentage, mean index, and specific delineated features.
   - If water is NOT present or NDWI indicates dry land: State clearly that no significant surface water bodies or reservoirs are detected in this scene footprint.
5. INFRASTRUCTURE & AIRPORT / RUNWAY:
   - If infrastructure/runway features are detected: Describe the specific detections and coordinates.
   - If not detected or absent in the image: Explicitly declare that no such features were observed in the image analysis.
6. VEGETATION & URBAN METRICS:
   - Report the exact calculated NDVI and NDBI percentages and values from the analysis results.
7. CLARITY & SCIENTIFIC PRECISION: Provide a clear, direct, and helpful answer backed by the extracted quantitative evidence.`;
  }

  /**
   * Compiles satellite evidence and metadata into a formatted context string for LLM reasoning
   */
  public formatEvidenceContext(
    question: string,
    evidence?: SatelliteEvidenceContext | null,
    analysisResults?: Record<string, any> | null
  ): string {
    const lines: string[] = [];
    lines.push(`USER QUESTION: "${question}"\n`);
    lines.push('=== SATELLITE IMAGE ANALYSIS EVIDENCE (GROUND TRUTH) ===');

    // 1. Geographic & Sensor Metadata
    const geo = evidence?.geographicMetadata || (evidence?.image as any);
    if (geo) {
      lines.push('ACQUISITION & SENSOR SPECIFICATIONS:');
      if (geo.satellite) lines.push(`- Platform/Satellite: ${geo.satellite} ${geo.sensor ? `(${geo.sensor})` : ''}`);
      if (geo.resolutionMeters || geo.resolution_meters) lines.push(`- Spatial Resolution: ${geo.resolutionMeters || geo.resolution_meters}m Ground Sampling Distance (GSD)`);
      if (geo.acquisitionDate || geo.acquisition_date) lines.push(`- Acquisition Date: ${geo.acquisitionDate || geo.acquisition_date}`);
      if (geo.cloudPercentage !== undefined || geo.cloud_percentage !== undefined) lines.push(`- Cloud Cover: ${geo.cloudPercentage ?? geo.cloud_percentage}%`);
      if (geo.latitude && geo.longitude) lines.push(`- Scene Coordinates: Latitude ${geo.latitude}°, Longitude ${geo.longitude}°`);
      if (geo.bands && Array.isArray(geo.bands)) lines.push(`- Radiometric Bands: ${geo.bands.join(', ')}`);
      if (geo.file_name) lines.push(`- Source File: ${geo.file_name}`);
    }

    // 2. Computed Spectral Indices (NDVI, NDWI, NDBI)
    const spectral = evidence?.spectralIndices || analysisResults?.spectralIndices || analysisResults?.spectralInterpretation;
    const stats = analysisResults?.statistics || evidence?.statistics;

    lines.push('\nCOMPUTED RADIOMETRIC & SPECTRAL INDICES:');
    if (spectral?.ndvi) {
      const vegPct = spectral?.ndvi?.statistics?.vegetation_percentage ?? spectral?.ndvi?.coveragePercent ?? stats?.vegetationPercentage;
      const meanNdvi = spectral?.ndvi?.statistics?.mean_ndvi ?? spectral?.ndvi?.mean ?? stats?.ndviMean ?? stats?.meanIndex;
      lines.push(`- NDVI (Vegetation Index): Mean = ${meanNdvi !== undefined ? Number(meanNdvi).toFixed(3) : 'N/A'}, Canopy Coverage = ${vegPct !== undefined ? vegPct : 'N/A'}%`);
      if (spectral?.ndvi?.interpretation) lines.push(`  * Interpretation: ${spectral.ndvi.interpretation}`);
    } else if (typeof stats?.vegetationPercentage === 'number') {
      lines.push(`- Vegetation-like pixel coverage estimate: ${stats.vegetationPercentage}%. NDVI was not supplied.`);
    }

    if (spectral?.ndwi) {
      const waterPct = spectral?.ndwi?.statistics?.water_percentage ?? spectral?.ndwi?.coveragePercent ?? stats?.waterPercentage;
      const meanNdwi = spectral?.ndwi?.statistics?.mean_ndwi ?? spectral?.ndwi?.mean ?? stats?.ndwiMean;
      lines.push(`- NDWI (Water Index): Mean = ${meanNdwi !== undefined ? Number(meanNdwi).toFixed(3) : 'N/A'}, Water Surface Coverage = ${waterPct !== undefined ? waterPct : 'N/A'}%`);
      if (spectral?.ndwi?.interpretation) lines.push(`  * Interpretation: ${spectral.ndwi.interpretation}`);
    } else if (typeof stats?.waterPercentage === 'number') {
      lines.push(`- Water-like pixel coverage estimate: ${stats.waterPercentage}%. NDWI/MNDWI was not supplied.`);
    }

    if (spectral?.ndbi) {
      const builtPct = spectral?.ndbi?.statistics?.builtup_percentage ?? spectral?.ndbi?.coveragePercent ?? stats?.builtUpPercentage;
      const meanNdbi = spectral?.ndbi?.statistics?.mean_ndbi ?? spectral?.ndbi?.mean ?? stats?.ndbiMean;
      lines.push(`- NDBI (Built-Up Urban Index): Mean = ${meanNdbi !== undefined ? Number(meanNdbi).toFixed(3) : 'N/A'}, Impervious Built-up Area = ${builtPct !== undefined ? builtPct : 'N/A'}%`);
      if (spectral?.ndbi?.interpretation) lines.push(`  * Interpretation: ${spectral.ndbi.interpretation}`);
    } else if (typeof stats?.builtUpPercentage === 'number') {
      lines.push(`- Built-up-like pixel coverage estimate: ${stats.builtUpPercentage}%. NDBI was not supplied.`);
    }

    // 3. Land Cover Classification
    const landCover = analysisResults?.landCover;
    if (landCover && landCover.top_classes) {
      lines.push('\nBIGEARTHNET VLM LAND COVER CLASSIFICATION:');
      lines.push(`- Model Domain: ${landCover.domain_corpus || 'BigEarthNet-S2 (19 CLC Classes)'}`);
      lines.push(`- Training Status: ${landCover.training_status || 'Not provided'}`);
      landCover.top_classes.forEach((tc: any, i: number) => {
        lines.push(`  * Top ${i + 1}: ${tc.label} (Score: ${(tc.score * 100).toFixed(1)}%)`);
      });
    }

    // 4. Object Detections & Spatial Grounding
    const detections = evidence?.detections || analysisResults?.detections;
    if (detections && Array.isArray(detections) && detections.length > 0) {
      lines.push(`\nSPATIAL FEATURE DETECTIONS & GROUNDING (${detections.length} features resolved):`);
      detections.slice(0, 8).forEach((d: any, idx: number) => {
        lines.push(`- [${idx + 1}] ${d.label} | Category: ${d.category || 'feature'} | Confidence: ${(d.confidence * 100).toFixed(1)}%`);
      });
    } else {
      lines.push('\nSPATIAL FEATURE DETECTIONS: No image-grounded object detections were provided.');
    }

    // 5. Specialist Agent Direct Analysis
    const pipelineDirectAnswer = analysisResults?.directAnswer || analysisResults?.summary;
    if (pipelineDirectAnswer) {
      lines.push(`\nSPECIALIST PIPELINE IMAGE FINDING:\n${pipelineDirectAnswer}`);
    }

    lines.push('\nINSTRUCTION: Synthesize the above image-specific ground-truth evidence to directly answer the user query. Do NOT use generic canned answers; analyze the image metrics provided above.');
    return lines.join('\n');
  }

  /**
   * Executes a chat completion request to OpenRouter with automatic model auto-switching across specialist pools
   */
  public async generateAnswer(
    question: string,
    evidenceContext?: SatelliteEvidenceContext | null,
    analysisResults?: Record<string, any> | null,
    preferredModel?: string
  ): Promise<OpenRouterCompletionResult> {
    const workingProfile = this.determineWorkingAssistant(
      analysisResults?.analysisType,
      question,
      evidenceContext
    );

    const formattedUserPrompt = this.formatEvidenceContext(question, evidenceContext, analysisResults);
    const systemInstruction = this.getSatQuerySystemPrompt();

    const messages: OpenRouterMessage[] = [
      { role: 'system', content: systemInstruction },
      { role: 'user', content: formattedUserPrompt },
    ];

    // Build intelligent auto-switch model priority chain for this working assistant
    const autoSwitchPool = Array.from(
      new Set([
        ...(preferredModel ? [preferredModel] : []),
        ...workingProfile.recommendedModels,
        this.primaryModel,
        ...this.fallbackModels,
      ])
    );

    let lastError: any = null;
    const switchTrace: Array<{ model: string; error?: string; success?: boolean }> = [];

    for (const model of autoSwitchPool) {
      try {
        const result = await this.callOpenRouterApi(messages, model);
        if (result && result.answer) {
          switchTrace.push({ model, success: true });
          const actualResolvedModel = result.actualModel || model;
          return {
            answer: result.answer,
            model: `OpenRouter (${workingProfile.title}) • ${actualResolvedModel}`,
            workingAssistant: workingProfile.title,
            assistantRole: workingProfile.role,
            autoSwitchedModel: actualResolvedModel,
            confidence: null,
            evidence: {
              ndwiCalculated: Boolean(evidenceContext?.spectralIndices?.ndwi || analysisResults?.statistics?.waterPercentage !== undefined),
              ndviCalculated: Boolean(evidenceContext?.spectralIndices?.ndvi || analysisResults?.statistics?.vegetationPercentage !== undefined),
              featuresDetectedCount: (analysisResults?.detections || evidenceContext?.detections || []).length,
              sourceModel: actualResolvedModel,
              workingAssistant: workingProfile.title,
              assistantRole: workingProfile.role,
              autoSwitchTrace: switchTrace,
            },
            usage: result.usage,
          };
        }
      } catch (err: any) {
        lastError = err;
        switchTrace.push({ model, error: err.message, success: false });
        console.warn(`[OpenRouterService / Auto-Switch] Model '${model}' for assistant '${workingProfile.title}' failed: ${err.message}. Auto-switching to next candidate...`);
      }
    }

    // Safe fallback synthesis if all OpenRouter calls fail or no key is present
    console.warn(`[OpenRouterService] All OpenRouter model attempts failed for '${workingProfile.title}', utilizing deterministic ground-truth synthesis.`);
    return this.synthesizeDeterministicFallback(question, evidenceContext, analysisResults, workingProfile, lastError?.message, switchTrace);
  }

  /**
   * Internal HTTP call to OpenRouter's OpenAI-compatible /chat/completions endpoint
   */
  private async callOpenRouterApi(
    messages: OpenRouterMessage[],
    model: string
  ): Promise<{ answer: string; actualModel: string; usage?: any }> {
    if (!this.apiKey) {
      throw new Error('OPENROUTER_API_KEY is not configured in backend environment.');
    }

    const payload = {
      model,
      messages,
      temperature: 0.15,
      max_tokens: 600,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 18000); // 18s timeout

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://satquery.ai',
          'X-Title': 'SatQueryAI Remote Sensing Assistant',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        let safeErrorMsg = `OpenRouter API returned status ${response.status}`;
        try {
          const parsed = JSON.parse(errorText);
          if (parsed.error?.message) safeErrorMsg = parsed.error.message;
        } catch {
          // Keep safe message
        }
        throw new Error(safeErrorMsg);
      }

      const json = await response.json() as OpenRouterChatCompletionResponse;
      const content = json.choices?.[0]?.message?.content;
      if (!content || typeof content !== 'string') {
        throw new Error('OpenRouter returned an empty or malformed completion.');
      }

      return {
        answer: content.trim(),
        actualModel: json.model || model,
        usage: json.usage,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error(`OpenRouter request timed out after 18s for model ${model}`);
      }
      throw err;
    }
  }

  /**
   * Deterministic domain fallback obeying anti-fabrication rules
   */
  private synthesizeDeterministicFallback(
    question: string,
    evidenceContext?: SatelliteEvidenceContext | null,
    analysisResults?: Record<string, any> | null,
    workingProfile?: WorkingAssistantProfile,
    reason?: string,
    switchTrace?: Array<{ model: string; error?: string; success?: boolean }>
  ): OpenRouterCompletionResult {
    const profile = workingProfile || this.determineWorkingAssistant(analysisResults?.analysisType, question, evidenceContext);
    const qLower = question.toLowerCase();
    const spectral = evidenceContext?.spectralIndices || analysisResults?.spectralIndices || analysisResults?.spectralInterpretation;
    const stats = analysisResults?.statistics;

    let answer = '';

    if (qLower.includes('water') || qLower.includes('lake') || qLower.includes('river')) {
      if (typeof stats?.waterPercentage === 'number') {
        answer = stats.waterPercentage > 0
          ? `Water-like pixels occupy approximately ${stats.waterPercentage}% of the image.`
          : 'No water-like pixels were detected by the available image analysis.';
      } else if (spectral?.ndwi && spectral.ndwi.isWaterDetected) {
        answer = `Yes. Open water bodies were delineated using spectral-band reflectance analysis (mean NDWI: ${spectral.ndwi.mean || 'positive'}).`;
      } else {
        answer = analysisResults?.directAnswer
          || analysisResults?.summary
          || 'Water coverage is unavailable because no image-derived water measurement was provided.';
      }
    } else if (qLower.includes('vegetat') || qLower.includes('forest') || qLower.includes('green') || qLower.includes('tree')) {
      if (typeof stats?.vegetationPercentage === 'number') {
        answer = `Vegetation-like pixels occupy approximately ${stats.vegetationPercentage}% of the image.`;
      } else {
        answer = analysisResults?.directAnswer
          || analysisResults?.summary
          || 'Vegetation coverage is unavailable because no image-derived measurement was provided.';
      }
    } else {
      answer =
        analysisResults?.directAnswer ||
        analysisResults?.summary ||
        'SatQueryAI processed the satellite scene. Spectral and spatial metrics have been recorded in the session trace.';
    }

    return {
      answer,
      model: `OpenRouter Engine (${profile.title}) • Auto-Switch Ready`,
      workingAssistant: profile.title,
      assistantRole: profile.role,
      autoSwitchedModel: 'OpenRouter Auto-Switch Pipeline',
      confidence: null,
      evidence: {
        fallbackReason: reason || 'OpenRouter model auto-switch fallback',
        ndwiCalculated: Boolean(stats?.waterPercentage !== undefined),
        ndviCalculated: Boolean(stats?.vegetationPercentage !== undefined),
        workingAssistant: profile.title,
        assistantRole: profile.role,
        autoSwitchTrace: switchTrace || [],
      },
    };
  }
}

export const openRouterService = new OpenRouterService();
