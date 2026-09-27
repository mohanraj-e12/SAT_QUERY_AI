/**
 * SatQuery AI: Geospatial & System Data Models
 */

export interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
  organization?: string;
  role?: string;
  created_at: string;
  updated_at: string;
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

export interface ObjectDetectionItem {
  id: string;
  label: string;
  category: 'building' | 'aircraft' | 'vessel' | 'road' | 'water_body' | 'vegetation' | 'infrastructure' | 'agricultural_field';
  confidence?: number;
  // Normalized bounding box [ymin, xmin, ymax, xmax] between 0 and 1
  box_2d: [number, number, number, number];
  area_sq_m?: number;
}

export interface SpectralStatistics {
  meanIndex?: number;
  minVal?: number;
  maxVal?: number;
  vegetationPercentage?: number;
  waterPercentage?: number;
  builtUpPercentage?: number;
  bareSoilPercentage?: number;
  cloudPercentage?: number;
  landPercentage?: number;
  validPixelCount?: number;
  waterPixelCount?: number;
  landPixelCount?: number;
  vegetationPixelCount?: number;
  builtUpPixelCount?: number;
  bareSoilPixelCount?: number;
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
    from: string;
    to: string;
    areaHa: number;
    percentage: number;
    trend: string;
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
  imageAnalysis?: Record<string, any>;
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
  auditableSummary?: Record<string, any>;
  executionTrace?: Array<{
    step: number;
    name: string;
    action: string;
    status: string;
    duration_ms?: number;
    details?: string;
  }>;
  modelsExecuted?: string[];
  toolsExecuted?: string[];
  totalLatencyMs?: number;
  crossModalMetrics?: Record<string, any>;
  changeMetrics?: Record<string, any>;
  landCover?: Record<string, any>;
  agentsExecuted?: string[];
  spectralIndices?: Record<string, any>;
  geojsonLayers?: Record<string, any>;
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

export interface AnalysisResultRecord {
  id: string;
  session_id: string;
  result_type: string;
  result_data: AnalysisResultData;
  image_url?: string;
  geojson?: GeoJSONPolygon | null;
  statistics: SpectralStatistics;
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
