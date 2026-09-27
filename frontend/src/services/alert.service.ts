import { api } from './api.js';
import { Alert } from '../types/index.js';

export const alertService = {
  getAlerts: async (): Promise<Alert[]> => {
    return api.get<Alert[]>('/api/alerts');
  },
  markRead: async (id: string, isRead: boolean = true): Promise<Alert> => {
    return api.put<Alert>(`/api/alerts/${id}/read`, { is_read: isRead });
  },
  deleteAlert: async (id: string): Promise<boolean> => {
    return api.delete<boolean>(`/api/alerts/${id}`);
  },
};
