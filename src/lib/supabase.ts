import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Clean up URL if user pasted with spaces or trailing slash
const cleanInput = (val: string | undefined) => {
  if (!val) return '';
  return val.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
};

const formattedUrl = cleanInput(supabaseUrl);
const formattedKey = (supabaseAnonKey || '').trim();

export const isSupabaseConfigured = Boolean(formattedUrl && formattedKey && formattedKey.length > 10);

if (!isSupabaseConfigured) {
  console.warn('Supabase configuration is incomplete or looks invalid. Check your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

export const supabase = createClient(
  formattedUrl || 'https://placeholder.supabase.co',
  formattedKey || 'placeholder-key'
);
