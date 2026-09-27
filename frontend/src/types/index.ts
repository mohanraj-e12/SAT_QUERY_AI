export type AnalysisType =
  | 'VEGETATION'
  | 'WATER_DETECTION'
  | 'OBJECT_DETECTION'
  | 'BUILT_UP_ANALYSIS'
  | 'CHANGE_DETECTION'
  | 'IMAGE_DESCRIPTION'
  | 'CROSS_MODAL_ANALYSIS'
  | 'SCENE_CAPTIONING'
  | 'GENERAL_QUERY';

export interface UserProfile {
  id: string;
  user_id?: string;
  full_name: string;
  email: string;
  avatar_url?: string;
  organization?: string;
  role?: string;
  created_at: string;
  updated_at?: string;
  preferences?: Record<string, any>;
}

export interface GeoJSONPolygon {
  type: 'Polygon' | 'MultiPolygon' | 'Feature' | 'FeatureCollection';
  coordinates: any;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string;
  aoi?: GeoJSONPolygon | null;
  tags: string[];
  created_at: string;
  updated_at: string;
  image_count?: number;
  analysis_count?: number;
}

export interface SatelliteMetadata {
  crs?: string;
  sun_elevation?: number;
  sun_azimuth?: number;
  radiometric_calibration?: string;
  processing_level?: string;
  epsg?: number;
  [key: string]: any;
}

export interface SatelliteImage {
  id: string;
  project_id?: string | null;
  user_id: string;
  file_name: string;
  file_url: string;
  storage_path: string;
  source: string;
  satellite: string;
  sensor?: string;
  acquisition_date?: string | null;
  cloud_percentage?: number | null;
  resolution_meters?: number | null;
  bands: string[];
  latitude?: number | null;
  longitude?: number | null;
  bbox?: {
    west: number;
    south: number;
    east: number;
    north: number;
  } | null;
  metadata?: SatelliteMetadata;
  created_at: string;
}

export interface ObjectDetectionItem {
  id: string;
  label: string;
  category: 'building' | 'aircraft' | 'vessel' | 'road' | 'water_body' | 'vegetation' | 'infrastructure' | 'agricultural_field';
  confidence?: number;
  box_2d: [number, number, number, number]; // [ymin, xmin, ymax, xmax] in 0..1
  area_sq_m?: number;
  area_ha?: number;
  polygon?: [number, number][]; // [ [lng, lat], ... ]
  spectralIndex?: string;
  evidence?: string;
  modality_evidence?: string;
}

export interface SpectralStatistics {
  meanIndex?: number;
  minVal?: number;
  maxVal?: number;
  vegetationPercentage?: number | null;
  waterPercentage?: number | null;
  builtUpPercentage?: number | null;
  bareSoilPercentage?: number | null;
  cloudPercentage?: number;
  landPercentage?: number | null;
  validPixelCount?: number;
  waterPixelCount?: number | null;
  landPixelCount?: number;
  vegetationPixelCount?: number | null;
  builtUpPixelCount?: number | null;
  bareSoilPixelCount?: number | null;
  excludedPixelCount?: number;
  totalPixels?: number;
  meanNdwi?: number;
  meanNdvi?: number;
  meanNdbi?: number;
  healthyCanopyHa?: number;
  totalAreaHa?: number;
  isMultispectral?: boolean;
  method?: string;
  confidence?: string;
  classAvailability?: Record<string, boolean>;
  debugInfo?: {
    totalPixels: number;
    totalValidPixels: number;
    vegetationPixels: number;
    waterPixels: number;
    builtUpPixels: number;
    bareSoilPixels: number;
    noDataCloudPixels: number;
    finalPercentages: {
      vegetation: number;
      water: number;
      builtUp: number;
      bareSoil: number;
    };
  };
  histogram?: { range: string; percentage: number }[];
  pixelAnalysis?: any;
}

export interface ChangeDetectionResult {
  beforeImageId: string;
  afterImageId: string;
  beforeDate: string;
  afterDate: string;
  builtUpChangePercentage: number;
  vegetationChangePercentage: number;
  waterChangePercentage: number;
  bareSoilChangePercentage?: number;
  netChangedAreaHa: number;
  confidence: number;
  aiExplanation: string;
  differenceMapUrl?: string;
  landImprovementStatus?: 'IMPROVED' | 'RESTORED' | 'DEGRADED' | 'EXPANDED_URBAN' | 'STABLE';
  landImprovementLabel?: string;
  landImprovementDescription?: string;
  landImprovementScore?: number;
  deltaNdvi?: number;
  deltaNdwi?: number;
  deltaNdbi?: number;
  environmentalFactors?: {
    vegetationVigorDelta: number;
    soilMoistureDelta: number;
    imperviousnessDelta: number;
    landHealthTrend: string;
    summary?: string;
  };
  transitions?: Array<{
    from?: string;
    to?: string;
    fromClass?: string;
    toClass?: string;
    areaHa?: number;
    areaSqKm?: number;
    percentage?: number;
    percentageOfAoi?: number;
    trend?: string;
    category?: string;
  }>;
  changeRegions?: {
    id: string;
    type: string;
    changePercent: number;
    coordinates: [number, number];
    description?: string;
    landImpact?: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  }[];
}

export interface AnalysisResultData {
  analysisType: AnalysisType;
  isValidSatellite?: boolean;
  detectedImageType?: string;
  validationError?: string;
  workingAssistant?: string;
  assistantRole?: string;
  llmModel?: string;
  autoSwitchedModel?: string;
  llmEvidence?: Record<string, any>;
  summary: string;
  directAnswer?: string;
  moduleRoute?: Record<string, any>;
  moduleResult?: Record<string, any>;
  questionCategory?: string;
  suggestedFollowups?: string[];
  confidence?: number;
  statistics: SpectralStatistics;
  imageAnalysis?: {
    available: boolean;
    image_type: 'rgb' | 'multispectral';
    width: number;
    height: number;
    valid_pixel_count: number;
    class_percentages: Record<string, number | null>;
    ndvi_available: boolean;
    indices: Record<string, {
      mean: number;
      median: number;
      minimum: number;
      maximum: number;
      pixel_count: number;
      formula: string;
      health_interpretation?: string;
    }>;
    method: string;
    confidence: string;
    confidence_basis: string;
    georeferencing?: {
      available: boolean;
      bounds: {
        west: number;
        south: number;
        east: number;
        north: number;
        crs: string;
        source: string;
      } | null;
    };
    overlays: Record<string, string>;
  };
  detections: ObjectDetectionItem[];
  recommendations: string[];
  spectralInterpretation?: {
    indexName: 'NDVI' | 'NDWI' | 'NDBI' | 'RGB_MULTISPECTRAL';
    formula: string;
    scientificMeasurement: string;
    aiInterpretation: string;
    colorScale: { min: string; mid: string; max: string };
  };
  changeDetection?: ChangeDetectionResult;
  executionTrace?: {
    step: number;
    name: string;
    action: string;
    duration_ms?: number;
    [key: string]: any;
  }[];
  auditableSummary?: {
    selected_task: string;
    specialist_models: string[];
    permitted_parameters: Record<string, any>;
    input_verification: Record<string, any>;
    total_processing_time_ms: number;
  };
  modelsExecuted?: string[];
  toolsExecuted?: string[];
  mlEvaluation?: any;
  mlFrameworks?: string[];
  librariesUtilized?: string[];
  landCover?: any;
  changeMetrics?: any;
  crossModalMetrics?: any;
  totalLatencyMs?: number;
  agentsExecuted?: string[];
  spectralIndices?: any;
  geojsonLayers?: any;
  keyTakeaways?: string[];
}

export interface AnalysisSession {
  id: string;
  user_id: string;
  project_id?: string | null;
  image_id: string;
  query: string;
  analysis_type: AnalysisType;
  result: AnalysisResultData;
  confidence?: number;
  created_at: string;
}

export interface Alert {
  id: string;
  user_id: string;
  project_id?: string | null;
  title: string;
  message: string;
  alert_type: 'CHANGE_DETECTED' | 'VEGETATION_DECREASE' | 'WATER_ANOMALY' | 'URBAN_EXPANSION' | 'THRESHOLD_ALERT';
  severity: 'low' | 'medium' | 'high' | 'critical';
  is_read: boolean;
  created_at: string;
}

export interface SavedQuery {
  id: string;
  user_id: string;
  project_id?: string | null;
  query: string;
  category?: string;
  created_at: string;
}
