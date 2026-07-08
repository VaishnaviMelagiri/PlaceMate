import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail loudly in dev so a missing .env is obvious rather than a blank screen.
  // eslint-disable-next-line no-console
  console.error(
    'Missing Supabase env vars. Copy .env.example to .env and fill in ' +
      'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
  )
}

/** True when both required Supabase env vars are present. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

// createClient throws on an empty URL/key, which would white-screen the whole
// app before the "configure Supabase" notice can render. Fall back to harmless
// placeholders when unconfigured; isSupabaseConfigured gates real usage.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      // Durable session: survives app restarts and phone reboots. The session
      // ends only on an explicit signOut() (or a revoked/expired refresh token).
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      // Explicitly use localStorage (the browser default) — NOT sessionStorage,
      // which clears when the tab/PWA closes and would log the user out on every
      // launch. localStorage also gives us free cross-tab auth sync.
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      storageKey: 'placemate-auth',
    },
  },
)
