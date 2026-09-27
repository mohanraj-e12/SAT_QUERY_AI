/**
 * SatQueryAI - Reusable API Client Interface
 * Standardized communication interface between React/TSX Frontend and Python FastAPI Backend.
 */

export * from '../../frontend/src/services/api.js';
export {
  uploadImage,
  sendQuery,
  analyzeImage,
  getAnalysis,
  checkHealth,
  processGeoScopeAOI,
  acquireGeoScopeImagery,
  analyzeGeoScopeAOI,
  compareGeoScopeDates,
  api,
} from '../../frontend/src/services/api.js';
