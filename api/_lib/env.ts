// The app's public Supabase settings (the same ones Vite builds into the
// client), read at runtime by the preview functions.
export function supabaseEnv(): { supabaseUrl: string; anonKey: string } {
  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? ''
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? ''
  return { supabaseUrl, anonKey }
}
