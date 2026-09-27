import { app } from './app.js';
import { config } from './config/env.config.js';

const PORT = config.port;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🛰️  SatQuery AI Server running at http://0.0.0.0:${PORT}`);
  console.log(`📡  Multimodal Remote-Sensing Intelligence Platform Ready`);
  console.log(`🔑  Gemini Multimodal: ${config.geminiApiKey ? 'Configured' : 'Offline Engine Mode'}`);
  console.log(`📦  Supabase Storage & DB: ${config.supabaseUrl ? 'Connected' : 'Local Fallback Store Mode'}`);
});
