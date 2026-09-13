const missingVariableMessage = (name: string) =>
  `Missing ${name}. Add it to .env.local before using Supabase.`;

export function getPublicSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error(missingVariableMessage("NEXT_PUBLIC_SUPABASE_URL"));
  }

  if (!anonKey) {
    throw new Error(missingVariableMessage("NEXT_PUBLIC_SUPABASE_ANON_KEY"));
  }

  return { url, anonKey };
}
