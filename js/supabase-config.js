// ============================================================
// Supabase connection config
//
// Fill these two values in from your Supabase project:
// Project Settings -> API -> Project URL / Project API keys
// Use the "anon" / "public" key only. NEVER put the
// service_role key in this file or anywhere in the frontend.
// ============================================================
const SUPABASE_URL = "https://moydvdbhcuahmhxqqxed.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_VUKM4K5Ll5P5LC5vFDjujw_45cKsGZ0";

// Shared client used by every page. Loaded via the Supabase
// UMD build in each HTML file before this script runs.
const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);
