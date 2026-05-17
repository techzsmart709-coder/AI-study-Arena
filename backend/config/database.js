import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// ── Supabase Client ─────────────────────────────────────────────
// Single source of truth — all backend modules import from here.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

export const supabase = (supabaseUrl && !supabaseUrl.includes('dummy')) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;
