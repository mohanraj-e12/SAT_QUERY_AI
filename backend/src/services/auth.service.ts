import { UserProfile } from '../models/types.js';
import { inMemoryStore } from '../database/store.js';
import { getSupabaseClient, getSupabaseAdminClient } from '../database/supabase.client.js';

export class AuthService {
  public async getProfile(userId: string): Promise<UserProfile> {
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', userId)
          .single();

        if (!error && data) {
          return data as UserProfile;
        }
      } catch (err) {
        console.warn('[AuthService] Supabase profile fetch failed:', err);
      }
    }

    const local = inMemoryStore.users.get(userId);
    if (local) return local;

    // Create guest profile if not found
    const defaultUser: UserProfile = {
      id: userId,
      user_id: userId,
      full_name: 'Lead Geospatial Analyst',
      email: 'analyst@satquery.ai',
      organization: 'Earth Observation Research Center',
      role: 'Senior RS/GIS Scientist',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    inMemoryStore.users.set(userId, defaultUser);
    return defaultUser;
  }

  public async updateProfile(userId: string, data: Partial<UserProfile>): Promise<UserProfile> {
    const profile = await this.getProfile(userId);
    const updated = {
      ...profile,
      ...data,
      updated_at: new Date().toISOString(),
    };

    const supabase = getSupabaseAdminClient();
    if (supabase) {
      try {
        await supabase.from('profiles').upsert(updated);
      } catch (err) {
        console.warn('[AuthService] Supabase profile upsert failed:', err);
      }
    }

    inMemoryStore.users.set(userId, updated);
    return updated;
  }
}

export const authService = new AuthService();
