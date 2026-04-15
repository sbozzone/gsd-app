// js/triage.js — AI triage suggestions, proxied through the GSD Worker.
// The Worker holds the Anthropic API key as a secret (never exposed to client).
import { API_BASE, AUTH_TOKEN } from './config.js';

const CACHE_PREFIX = 'gsd_triage_';

function hashText(text) {
  // Simple djb2 hash — good enough for a cache key
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h) ^ text.charCodeAt(i);
  return (h >>> 0).toString(36);
}

/**
 * Suggest how to file an inbox item.
 * Returns { bucket, horizon, type } or null on failure.
 * Results are cached in sessionStorage keyed by a hash of the text.
 */
export async function suggestTriage(text) {
  if (!text) return null;

  const cacheKey = CACHE_PREFIX + hashText(text);
  const cached   = sessionStorage.getItem(cacheKey);
  if (cached) {
    try { return JSON.parse(cached); } catch { /* ignore bad cache */ }
  }

  try {
    const res = await fetch(`${API_BASE}/api/suggest`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`,
      },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return null;
    const { data } = await res.json();
    if (!data) return null;

    sessionStorage.setItem(cacheKey, JSON.stringify(data));
    return data;
  } catch (e) {
    console.error('[triage] suggestTriage failed', e);
    return null;
  }
}
