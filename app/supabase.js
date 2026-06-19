// ============================================================
// Gelato — Supabase client config (shared by the mini-app and admin).
// Fill these after creating your Supabase project: Settings → API.
// BOTH values are PUBLIC / publishable — safe to ship in the browser
// (Row Level Security protects the data; no secret keys here).
//
// While these are empty, the mini-app simply runs local-only
// (IndexedDB) exactly as before — nothing breaks.
// ============================================================
window.GELATO_SUPABASE = {
  url: "",      // e.g. https://abcdefgh.supabase.co
  anonKey: "",  // anon / publishable key
};
