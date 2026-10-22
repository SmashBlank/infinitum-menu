/* ==========================================================================
   Infinitum — Supabase client
   Loads the Supabase JS library (via CDN script tag in each HTML page) and
   creates one shared client used by every other script on the page.
   The publishable/anon key below is *meant* to be public — it's safe to ship
   in browser code. Real data protection comes from the Row Level Security
   policies defined in supabase/schema.sql, not from hiding this key.
   ========================================================================== */

const SUPABASE_URL = "https://mhknvilcltuwkvvpekal.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_y0u4vhCoiGISHNr2duIgiw_9udwlKkY";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
window.sb = sb;
