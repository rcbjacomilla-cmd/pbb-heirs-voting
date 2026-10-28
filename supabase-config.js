// Use the SAME project URL and public anon/publishable key as your 3L EVE2 study website.
// Find them in Supabase > Project Settings > Data API / API Keys, or your 3L EVE2 config.js.
// Never put a service_role/secret key or host password in this file.
export const supabaseUrl = 'PASTE_SUPABASE_PROJECT_URL';
export const supabasePublishableKey = 'PASTE_SUPABASE_PUBLISHABLE_OR_ANON_KEY';

// Website falls back to single-browser demo until both values are set.
export const supabaseReady = /^https:\/\/[a-zA-Z0-9-]+\.supabase\.co\/?$/.test(supabaseUrl)
  && supabasePublishableKey.length > 15 && !supabasePublishableKey.includes('PASTE_');
