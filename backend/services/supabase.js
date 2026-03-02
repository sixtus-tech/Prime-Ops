// backend/services/supabase.js
// ═══════════════════════════════════════════════════════════════════════
// Supabase client for backend services (storage, auth verification)
// ═══════════════════════════════════════════════════════════════════════

const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn(
    "[Supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env"
  );
}

// Service role client — has admin access, use only in backend
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

module.exports = { supabase };
