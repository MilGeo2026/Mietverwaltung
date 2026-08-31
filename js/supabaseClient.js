// Initialisiert den globalen Supabase-Client (supabase-js wird per CDN in index.html geladen).
const { createClient } = supabase;

const supabaseClient = createClient(
  window.SUPABASE_CONFIG.url,
  window.SUPABASE_CONFIG.anonKey
);
