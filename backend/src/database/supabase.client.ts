import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/env.config.js';

let supabaseClient: SupabaseClient | null = null;
let supabaseAdminClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    return null;
  }
  if (!supabaseClient) {
    try {
      supabaseClient = createClient(config.supabaseUrl, config.supabaseAnonKey);
    } catch (err) {
      console.warn('[Supabase] Could not initialize client:', err);
      return null;
    }
  }
  return supabaseClient;
}

export function getSupabaseAdminClient(): SupabaseClient | null {
  const serviceKey = config.supabaseServiceKey || config.supabaseAnonKey;
  if (!config.supabaseUrl || !serviceKey) {
    return null;
  }
  if (!supabaseAdminClient) {
    try {
      supabaseAdminClient = createClient(config.supabaseUrl, serviceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
    } catch (err) {
      console.warn('[Supabase] Could not initialize admin client:', err);
      return null;
    }
  }
  return supabaseAdminClient;
}

export function isSupabaseConnected(): boolean {
  return !!(config.supabaseUrl && (config.supabaseServiceKey || config.supabaseAnonKey));
}
