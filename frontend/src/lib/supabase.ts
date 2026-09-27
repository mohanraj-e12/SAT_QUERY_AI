import { createClient, SupabaseClient } from '@supabase/supabase-js';

const metaEnv = (import.meta as any).env || {};
export const supabaseUrl: string = metaEnv.VITE_SUPABASE_URL || '';
export const supabaseAnonKey: string = metaEnv.VITE_SUPABASE_ANON_KEY || '';

export let supabase: SupabaseClient | null = null;
export let supabaseConfigError: string | null = null;

if (!supabaseUrl || !supabaseAnonKey) {
  supabaseConfigError = 'Supabase URL or Anonymous Key is missing. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.';
  console.warn('[Supabase Config]', supabaseConfigError);
} else {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  } catch (err: any) {
    supabaseConfigError = `Could not initialize Supabase client: ${err?.message || err}`;
    console.error('[Supabase Init Error]', err);
  }
}

export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseAnonKey && supabase);
}
