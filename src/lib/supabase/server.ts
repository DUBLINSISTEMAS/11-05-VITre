/**
 * Cliente Supabase com service_role.
 * Uso EXCLUSIVO em server (server actions, route handlers).
 * NUNCA expor a service_role key no client.
 *
 * Operações típicas:
 *   - Upload de imagens para Storage (escrita)
 *   - Geração de signed URLs
 */
import { createClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";

export const supabaseService = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);
