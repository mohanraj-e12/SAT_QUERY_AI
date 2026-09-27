import { api } from './api.js';
import { AnalysisSession, SavedQuery, SatelliteImage } from '../types/index.js';

export const analysisService = {
  query: async (payload: {
    imageId: string;
    query: string;
    projectId?: string | null;
    imageBase64?: string;
    imageContext?: SatelliteImage;
    secondaryImageId?: string | null;
    secondaryImageContext?: SatelliteImage;
    inputMode?: 'SINGLE' | 'CROSS_MODAL_PAIR' | 'BITEMPORAL_PAIR' | 'AUTO';
    parameters?: Record<string, any>;
  }): Promise<AnalysisSession> => {
    return api.post<AnalysisSession>('/api/analysis/query', payload);
  },
  getRegistry: async (): Promise<any> => {
    return api.get<any>('/api/analysis/registry');
  },
  getEvaluationCriteria: async (): Promise<any> => {
    return api.get<any>('/api/analysis/evaluation-criteria');
  },
  analyzeVegetation: async (payload: {
    imageId: string;
    projectId?: string | null;
    query?: string;
  }): Promise<AnalysisSession> => {
    return api.post<AnalysisSession>('/api/analysis/vegetation', payload);
  },
  analyzeWater: async (payload: {
    imageId: string;
    projectId?: string | null;
    query?: string;
  }): Promise<AnalysisSession> => {
    return api.post<AnalysisSession>('/api/analysis/water', payload);
  },
  analyzeChange: async (payload: {
    imageId: string;
    secondaryImageId?: string;
    projectId?: string | null;
    query?: string;
    parameters?: Record<string, any>;
  }): Promise<AnalysisSession> => {
    return api.post<AnalysisSession>('/api/analysis/change-detection', payload);
  },
  analyzeObjects: async (payload: {
    imageId: string;
    projectId?: string | null;
    query?: string;
  }): Promise<AnalysisSession> => {
    return api.post<AnalysisSession>('/api/analysis/object-detection', payload);
  },
  getHistory: async (filters?: {
    projectId?: string;
    analysisType?: string;
    search?: string;
  }): Promise<AnalysisSession[]> => {
    const params = new URLSearchParams();
    if (filters?.projectId) params.append('projectId', filters.projectId);
    if (filters?.analysisType) params.append('analysisType', filters.analysisType);
    if (filters?.search) params.append('search', filters.search);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return api.get<AnalysisSession[]>(`/api/analysis/history${qs}`);
  },
  getSessionById: async (id: string): Promise<AnalysisSession> => {
    return api.get<AnalysisSession>(`/api/analysis/${id}`);
  },
  getSavedQueries: async (): Promise<SavedQuery[]> => {
    return api.get<SavedQuery[]>('/api/saved-queries');
  },
  saveQuery: async (payload: { query: string; category?: string; projectId?: string }): Promise<SavedQuery> => {
    return api.post<SavedQuery>('/api/saved-queries', payload);
  },
  deleteSavedQuery: async (id: string): Promise<boolean> => {
    return api.delete<boolean>(`/api/saved-queries/${id}`);
  },
  getReport: async (id: string): Promise<any> => {
    return api.get<any>(`/api/analysis/reports/${id}`);
  },
  downloadReport: (id: string): void => {
    const link = document.createElement('a');
    link.href = `/api/analysis/reports/${id}/download`;
    link.setAttribute('download', `SatQueryAI_Report_${id.substring(0, 8)}.pdf`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },
  getBenchmarks: async (): Promise<any> => {
    return api.get<any>('/api/analysis/benchmarks');
  },
  runEvaluation: async (benchmarkId?: string, options?: Record<string, any>): Promise<any> => {
    return api.post<any>('/api/analysis/evaluation/run', { benchmarkId, options });
  },
  getBigEarthNetDataset: async (): Promise<any> => {
    return api.get<any>('/api/analysis/dataset/bigearthnet');
  },
  trainBigEarthNet: async (epochs: number = 5, maxSamples: number = 2500): Promise<any> => {
    return api.post<any>('/api/analysis/train/bigearthnet', { epochs, maxSamples });
  },
  evaluateUploadedImage: async (image: Record<string, any>, query?: string): Promise<any> => {
    return api.post<any>('/api/analysis/evaluate-uploaded', { image, query });
  },
  aiQuery: async (payload: {
    question: string;
    imageId?: string;
    imageContext?: SatelliteImage;
    imageBase64?: string;
    projectId?: string | null;
    evidence?: Record<string, any>;
    analysisResults?: Record<string, any>;
    preferredModel?: string;
  }): Promise<{
    question: string;
    answer: string;
    model: string;
    confidence: number | null;
    evidence: Record<string, any>;
    analysisResults?: any;
    usage?: any;
    timestamp: string;
  }> => {
    return api.post<any>('/api/ai/query', payload);
  },
  getAIHealth: async (): Promise<{
    success: boolean;
    provider: string;
    configured: boolean;
    primaryModel: string;
    fallbackModelsCount: number;
  }> => {
    return api.get<any>('/api/ai/health');
  },
};
