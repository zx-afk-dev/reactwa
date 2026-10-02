const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

async function request(path, options = {}) {
  if (!isSupabaseConfigured()) return { data: null, error: null, skipped: true };

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: options.prefer || 'return=minimal',
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!response.ok) {
    const message = typeof data === 'object' && data?.message
      ? data.message
      : `Supabase request failed with HTTP ${response.status}`;
    throw new Error(message);
  }

  return { data, error: null, skipped: false };
}

export async function supabaseUpsert(table, rows, onConflict) {
  return request(table, {
    method: 'POST',
    prefer: `resolution=merge-duplicates,return=minimal`,
    headers: onConflict ? { Prefer: `resolution=merge-duplicates,return=minimal` } : undefined,
    body: JSON.stringify(Array.isArray(rows) ? rows : [rows]),
  });
}

export async function supabaseInsert(table, rows) {
  return request(table, {
    method: 'POST',
    body: JSON.stringify(Array.isArray(rows) ? rows : [rows]),
  });
}

export async function supabaseUpdate(table, filters, patch) {
  const query = Object.entries(filters)
    .map(([key, value]) => `${encodeURIComponent(key)}=eq.${encodeURIComponent(String(value))}`)
    .join('&');

  return request(`${table}?${query}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function supabaseSelect(table, query = '') {
  return request(`${table}${query ? `?${query}` : ''}`, {
    method: 'GET',
    prefer: 'return=representation',
  });
}

export async function supabaseDelete(table, filters) {
  const query = Object.entries(filters)
    .map(([key, value]) => `${encodeURIComponent(key)}=eq.${encodeURIComponent(String(value))}`)
    .join('&');

  return request(`${table}?${query}`, { method: 'DELETE' });
}
