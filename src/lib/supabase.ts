import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('--- SUPABASE CONFIGURATION MISSING ---');
  console.error('Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.');
  console.error('If you are on Vercel, add these to your Project Settings > Environment Variables.');
}

// We use placeholders if variables are missing to prevent "supabaseUrl is required" error at runtime.
// The app will still fail on actual data requests, but it won't crash the entire screen on load.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder-url.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);
