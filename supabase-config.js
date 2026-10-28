// Use the SAME project URL and public anon/publishable key as your 3L EVE2 study website.
// Find them in Supabase > Project Settings > Data API / API Keys, or your 3L EVE2 config.js.
// Never put a service_role/secret key or host password in this file.
export const supabaseUrl = 'https://wdcutjkusqvcdynmcpfz.supabase.co';
export const supabasePublishableKey = 'sb_publishable_FkaAD7HgQae2-Z_7e_pVkA_BoX7_19F';

// Website falls back to single-browser demo until both values are set.
export const supabaseReady = /^https:\/\/[a-zA-Z0-9-]+\.supabase\.co\/?$/.test(supabaseUrl)
  && supabasePublishableKey.length > 15 && !supabasePublishableKey.includes('PASTE_');
