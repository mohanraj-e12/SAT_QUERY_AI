import { api } from './api.js';
import { Project } from '../types/index.js';

export const projectService = {
  getProjects: async (): Promise<Project[]> => {
    return api.get<Project[]>('/api/projects');
  },
  getProjectById: async (id: string): Promise<Project> => {
    return api.get<Project>(`/api/projects/${id}`);
  },
  createProject: async (data: { name: string; description?: string; aoi?: any; tags?: string[] }): Promise<Project> => {
    return api.post<Project>('/api/projects', data);
  },
  updateProject: async (id: string, data: Partial<Project>): Promise<Project> => {
    return api.put<Project>(`/api/projects/${id}`, data);
  },
  deleteProject: async (id: string): Promise<boolean> => {
    return api.delete<boolean>(`/api/projects/${id}`);
  },
};
