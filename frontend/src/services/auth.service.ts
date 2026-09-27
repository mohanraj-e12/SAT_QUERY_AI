import { api } from './api.js';
import { UserProfile } from '../types/index.js';

export const authService = {
  getProfile: async (): Promise<{ profile: UserProfile; supabaseConnected: boolean }> => {
    return api.get<{ profile: UserProfile; supabaseConnected: boolean }>('/api/auth/profile');
  },
  updateProfile: async (data: Partial<UserProfile>): Promise<UserProfile> => {
    return api.post<UserProfile>('/api/auth/profile', data);
  },
};
