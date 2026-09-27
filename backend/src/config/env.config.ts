import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),

  nodeEnv: process.env.NODE_ENV || 'development',

  openrouterApiKey: process.env.OPENROUTER_API_KEY || '',

  openrouterModel:
    process.env.OPENROUTER_MODEL || 'openrouter/auto',

  openrouterFallbackModels: (
    process.env.OPENROUTER_FALLBACK_MODELS ||
    'google/gemma-4-31b-it:free,google/gemma-4-26b-a4b-it:free,nvidia/nemotron-3.5-lightning:free,liquid/lfm-2.5-2.6b:free'
  )
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean),

  openrouterBaseUrl:
    process.env.OPENROUTER_BASE_URL ||
    'https://openrouter.ai/api/v1',

  geminiApiKey: process.env.GEMINI_API_KEY || '',

  supabaseUrl:
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    '',

  supabaseAnonKey:
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    '',

  supabaseServiceKey:
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',

  appUrl:
    process.env.APP_URL ||
    'http://localhost:3000',

  isProduction:
    process.env.NODE_ENV === 'production',

  maxUploadSizeBytes: 50 * 1024 * 1024, // 50 MB
};