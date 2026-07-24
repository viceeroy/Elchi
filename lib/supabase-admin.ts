import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Service-role client — server-only, never import into src/. Used exclusively
// by api/auth-telegram.ts to mint sessions via the Supabase admin API.
//
// Built lazily: creating it eagerly at module load throws
// "supabaseKey is required." when SUPABASE_SERVICE_ROLE_KEY is unset, which on
// Vercel surfaces as an uncatchable FUNCTION_INVOCATION_FAILED (raw HTML 500)
// before the handler runs. Deferring construction lets the handler catch the
// misconfiguration and return clean JSON instead.
let client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (client) return client;

  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Supabase admin client is not configured');
  }

  client = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return client;
}
