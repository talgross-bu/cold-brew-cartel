import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const configurationError =
  !supabaseUrl || !publishableKey || publishableKey === "replace-with-your-publishable-key"
    ? "Supabase is not configured. Copy .env.example to .env.local and add the project's publishable key."
    : null;

export const supabase: SupabaseClient | null = configurationError
  ? null
  : createClient(supabaseUrl, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });

export async function ensureAnonymousSession(): Promise<void> {
  if (!supabase) throw new Error(configurationError ?? "Supabase is unavailable.");

  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (data.session) return;

  const signIn = await supabase.auth.signInAnonymously();
  if (signIn.error) {
    if (signIn.error.message.toLowerCase().includes("anonymous")) {
      throw new Error(
        "Anonymous sign-ins are disabled. Enable Anonymous Sign-Ins in Supabase Authentication settings, then reload.",
      );
    }
    throw signIn.error;
  }
}

