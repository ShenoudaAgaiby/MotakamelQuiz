import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const isUrlValid = (url) => {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
}

export const supabase = isUrlValid(supabaseUrl)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

if (!supabase) {
  console.warn('Supabase client not initialized: Invalid or missing VITE_SUPABASE_URL');
}
