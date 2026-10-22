/**
 * Lifeline - Supabase Client Module
 * Initializes Supabase connection with dynamic configuration & demo fallback
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.1';

const STORAGE_KEYS = {
  URL: 'lifeline_supabase_url',
  ANON_KEY: 'lifeline_supabase_anon_key',
  BUCKET: 'lifeline_supabase_bucket'
};

export const DEFAULT_BUCKET = 'lifeline-media';

// Check if credentials are stored in localStorage or window environment
function loadSavedConfig() {
  const envUrl = (window.LIFELINE_CONFIG && window.LIFELINE_CONFIG.SUPABASE_URL) || '';
  const envKey = (window.LIFELINE_CONFIG && window.LIFELINE_CONFIG.SUPABASE_ANON_KEY) || '';

  const url = localStorage.getItem(STORAGE_KEYS.URL) || envUrl;
  const anonKey = localStorage.getItem(STORAGE_KEYS.ANON_KEY) || envKey;
  const bucket = localStorage.getItem(STORAGE_KEYS.BUCKET) || DEFAULT_BUCKET;

  return { url: url.trim(), anonKey: anonKey.trim(), bucket };
}

let currentConfig = loadSavedConfig();
let supabaseInstance = null;

function isValidSupabaseUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname.includes('supabase.co');
  } catch {
    return false;
  }
}

function isValidAnonKey(key) {
  return typeof key === 'string' && key.length > 20 && !key.includes('your-anon-key');
}

/**
 * Instantiate or get existing Supabase client
 */
export function getSupabase() {
  if (supabaseInstance) return supabaseInstance;

  const { url, anonKey } = currentConfig;
  if (isValidSupabaseUrl(url) && isValidAnonKey(anonKey)) {
    try {
      supabaseInstance = createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
      return supabaseInstance;
    } catch (err) {
      console.warn('[Lifeline] Failed to initialize Supabase client:', err);
      return null;
    }
  }
  return null;
}

/**
 * Check if a valid Supabase project is connected
 * @returns {boolean}
 */
export function isSupabaseConfigured() {
  return getSupabase() !== null;
}

/**
 * Configure Supabase credentials dynamically (e.g. from UI modal)
 * @param {string} url
 * @param {string} anonKey
 * @param {string} [bucket]
 * @returns {boolean} true if successful
 */
export function configureSupabase(url, anonKey, bucket = DEFAULT_BUCKET) {
  if (!isValidSupabaseUrl(url)) {
    throw new Error('Please enter a valid Supabase URL (e.g., https://your-id.supabase.co)');
  }
  if (!isValidAnonKey(anonKey)) {
    throw new Error('Please enter a valid Supabase Anon Key');
  }

  localStorage.setItem(STORAGE_KEYS.URL, url.trim());
  localStorage.setItem(STORAGE_KEYS.ANON_KEY, anonKey.trim());
  localStorage.setItem(STORAGE_KEYS.BUCKET, (bucket || DEFAULT_BUCKET).trim());

  currentConfig = {
    url: url.trim(),
    anonKey: anonKey.trim(),
    bucket: (bucket || DEFAULT_BUCKET).trim()
  };

  supabaseInstance = null;
  return getSupabase() !== null;
}

/**
 * Clear stored Supabase credentials to revert to Demo mode
 */
export function disconnectSupabase() {
  localStorage.removeItem(STORAGE_KEYS.URL);
  localStorage.removeItem(STORAGE_KEYS.ANON_KEY);
  localStorage.removeItem(STORAGE_KEYS.BUCKET);
  currentConfig = { url: '', anonKey: '', bucket: DEFAULT_BUCKET };
  supabaseInstance = null;
}

/**
 * Current config inspection
 */
export function getConfig() {
  return {
    ...currentConfig,
    isConfigured: isSupabaseConfigured()
  };
}

// Initial client initialization attempt
export const supabase = getSupabase();
