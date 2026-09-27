/**
 * SatQueryAI - Reusable API Client Interface
 * Standardized communication interface between React/TSX Frontend and Python FastAPI Backend.
 */

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || '';

export interface ApiResponse<T = any> {
  success?: boolean;
  status?: string;
  data?: T;
  error?: string | {
    code?: string;
    message?: string;
    details?: any;
  };
  message?: string;
}

export interface UploadImageResult {
  image_id: string;
  filename: string;
  width: number;
  height: number;
  bands: number;
  format: string;
  status: string;
  url?: string;
}

export interface QueryResponse {
  answer: string;
  task: string;
  algorithm: string;
  confidence: number;
  evidence: string[];
  visual_result: string;
  mask_url?: string;
  statistics: {
    total_pixels: number;
    detected_pixels: number;
    coverage_percentage: number;
    number_of_detected_objects: number;
    confidence: number;
    processing_time: number;
    task?: string;
    histogram?: Array<{ range: string; percentage: number }>;
    breakdown?: Array<{ label: string; percentage: number; pixels: number }>;
  };
  processing_time: number;
  status?: string;
}

export interface SegmentationResult {
  task: string;
  mask_url: string;
  coverage_percentage: number;
  confidence: number;
}

export interface HealthStatus {
  status: string;
  backend: string;
  version: string;
  capabilities?: Record<string, any>;
}

/**
 * Robust, production-safe HTTP request executor with error handling.
 */
async function safeFetchJson<T>(url: string, options: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, options);
  } catch (networkErr: any) {
    const errorMsg = networkErr?.message || 'Failed to connect to the SatQuery API backend.';
    const err: any = new Error(errorMsg);
    err.code = 'NETWORK_ERROR';
    throw err;
  }

  const contentType = response.headers.get('content-type') || '';
  const text = await response.text().catch(() => '');

  if (!text || text.trim().length === 0) {
    if (!response.ok) {
      const err: any = new Error(`API error ${response.status}: Empty response returned.`);
      err.status = response.status;
      throw err;
    }
    return {} as T;
  }

  const trimmed = text.trim();
  const isHtml =
    trimmed.startsWith('<') ||
    trimmed.toLowerCase().includes('<!doctype') ||
    trimmed.toLowerCase().includes('<html') ||
    trimmed.toLowerCase().includes('<head');

  const isJson = !isHtml && (contentType.toLowerCase().includes('application/json') || trimmed.startsWith('{') || trimmed.startsWith('['));

  if (!response.ok) {
    if (isJson) {
      try {
        const errJson = JSON.parse(trimmed);
        const errMsg =
          (typeof errJson.error === 'string' ? errJson.error : errJson.error?.message) ||
          errJson.detail ||
          errJson.message ||
          `API error ${response.status}: Request failed`;
        const customErr: any = new Error(errMsg);
        customErr.status = response.status;
        customErr.code = errJson.error?.code || errJson.code || 'API_ERROR';
        throw customErr;
      } catch (parseErr: any) {
        if (parseErr.status) throw parseErr;
      }
    }
    const err: any = new Error(`API error ${response.status}: ${trimmed.slice(0, 300) || response.statusText}`);
    err.status = response.status;
    throw err;
  }

  if (isHtml || !isJson) {
    throw new Error('Expected JSON response from server.');
  }

  let data: any;
  try {
    data = JSON.parse(trimmed);
  } catch {
    throw new Error('Server returned invalid JSON.');
  }

  if (data && typeof data === 'object' && data.success === false) {
    const errMsg = (typeof data.error === 'string' ? data.error : data.error?.message) || data.message || 'Operation failed.';
    const customErr: any = new Error(errMsg);
    customErr.status = response.status;
    throw customErr;
  }

  if (data && typeof data === 'object' && 'data' in data && data.success === true) {
    return data.data as T;
  }

  return data as T;
}

/**
 * FEATURE 10 — Core Reusable API Client Functions:
 * - uploadImage()
 * - sendQuery()
 * - getAnalysis()
 * - checkHealth()
 */

export async function uploadImage(payload: {
  fileName: string;
  fileData: string; // base64 data URI or raw base64
  mimetype?: string;
  projectId?: string | null;
  source?: string;
}): Promise<UploadImageResult> {
  const url = `${API_BASE_URL}/api/upload`;
  return safeFetchJson<UploadImageResult>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function sendQuery(payload: {
  image_id?: string;
  imageId?: string;
  query: string;
  image_data?: string;
  imageBase64?: string;
}): Promise<QueryResponse> {
  const url = `${API_BASE_URL}/api/query`;
  return safeFetchJson<QueryResponse>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function analyzeImage(payload: {
  image?: string;
  image_id?: string;
  imageId?: string;
  question?: string;
  query?: string;
  image_data?: string;
  imageBase64?: string;
}): Promise<QueryResponse> {
  const url = `${API_BASE_URL}/api/analyze`;
  return safeFetchJson<QueryResponse>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function getAnalysis(payload: {
  task: 'water' | 'vegetation' | 'buildings' | 'roads' | 'urban' | 'flood' | 'land_cover' | string;
  image_id?: string;
  imageId?: string;
  image_data?: string;
  imageBase64?: string;
}): Promise<SegmentationResult> {
  const url = `${API_BASE_URL}/api/segment`;
  return safeFetchJson<SegmentationResult>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export interface GeoScopeAOIResult {
  valid: boolean;
  area_km2: number;
  center: { lat: number; lon: number };
  bounds: [number, number, number, number];
  geometry: any;
  geojson?: any;
  status: string;
}

export interface GeoScopeImageryResult {
  image_data_url: string;
  metadata: {
    sensor: string;
    acquisition_date: string;
    resolution_m: number;
    bands: string[];
    cloud_percentage: number;
    crs: string;
    bounds: [number, number, number, number];
    center: { lat: number; lon: number };
    dimensions: string;
    provider?: string;
  };
  status: string;
}

export interface GeoScopeAnalysisResult {
  analysis_id: string;
  answer: string;
  confidence?: number;
  task: string;
  evidence: string[];
  detected_features: string[];
  model: string;
  processing_time: number;
  visual_result?: string;
  mask_url?: string;
  aoi?: any;
  metadata?: any;
  statistics?: any;
}

export interface GeoScopeCompareResult {
  task: string;
  answer: string;
  confidence: number;
  date_a: string;
  date_b: string;
  image_a_url: string;
  image_b_url: string;
  change_metric_pct: number;
  evidence: string[];
  metadata_a: any;
  metadata_b: any;
}

export async function processGeoScopeAOI(geometry: any): Promise<GeoScopeAOIResult> {
  const url = `${API_BASE_URL}/api/geoscope/aoi`;
  return safeFetchJson<GeoScopeAOIResult>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ geometry }),
  });
}

export async function acquireGeoScopeImagery(payload: {
  bounds: [number, number, number, number];
  sensor?: string;
  acquisition_date?: string;
  max_cloud_cover?: number;
  composite_type?: string;
}): Promise<GeoScopeImageryResult> {
  const url = `${API_BASE_URL}/api/geoscope/imagery`;
  return safeFetchJson<GeoScopeImageryResult>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function analyzeGeoScopeAOI(payload: {
  question: string;
  image?: string;
  aoi_geojson?: any;
  metadata?: any;
}): Promise<GeoScopeAnalysisResult> {
  const url = `${API_BASE_URL}/api/geoscope/analyze`;
  return safeFetchJson<GeoScopeAnalysisResult>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function compareGeoScopeDates(payload: {
  bounds: [number, number, number, number];
  date_a: string;
  date_b: string;
  question?: string;
}): Promise<GeoScopeCompareResult> {
  const url = `${API_BASE_URL}/api/geoscope/compare`;
  return safeFetchJson<GeoScopeCompareResult>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function checkHealth(): Promise<HealthStatus> {
  const url = `${API_BASE_URL}/api/health`;
  return safeFetchJson<HealthStatus>(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Compatibility Class ApiClient for existing UI services
 */
class ApiClient {
  private getAuthHeader(): Record<string, string> {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('satquery_auth_token') || 'demo_analyst_token' : 'demo_analyst_token';
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  public async get<T>(endpoint: string): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    return safeFetchJson<T>(url, {
      method: 'GET',
      headers: this.getAuthHeader(),
    });
  }

  public async post<T>(endpoint: string, body: any): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    return safeFetchJson<T>(url, {
      method: 'POST',
      headers: this.getAuthHeader(),
      body: JSON.stringify(body),
    });
  }

  public async put<T>(endpoint: string, body: any): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    return safeFetchJson<T>(url, {
      method: 'PUT',
      headers: this.getAuthHeader(),
      body: JSON.stringify(body),
    });
  }

  public async delete<T>(endpoint: string): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    return safeFetchJson<T>(url, {
      method: 'DELETE',
      headers: this.getAuthHeader(),
    });
  }

  public async clearAllData(): Promise<boolean> {
    return this.post<boolean>('/api/clear-data', {});
  }
}

export const api = new ApiClient();
