const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

async function request(path, options = {}) {
  if (!isSupabaseConfigured()) throw new Error('Supabase database belum dikonfigurasi.');
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
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  if (!response.ok) {
    const message = typeof data === 'object' && data?.message ? data.message : `Supabase HTTP ${response.status}`;
    throw new Error(message);
  }
  return data;
}

export async function supabaseUpsert(table, rows, onConflict) {
  const query = onConflict ? `?on_conflict=${encodeURIComponent(onConflict)}` : '';
  return request(`${table}${query}`, {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=minimal',
    body: JSON.stringify(Array.isArray(rows) ? rows : [rows]),
  });
}
export async function supabaseInsert(table, rows) {
  return request(table, { method:'POST', body:JSON.stringify(Array.isArray(rows)?rows:[rows]) });
}
export async function supabaseUpdate(table, filters, patch) {
  const query=Object.entries(filters).map(([k,v])=>`${encodeURIComponent(k)}=eq.${encodeURIComponent(String(v))}`).join('&');
  return request(`${table}?${query}`, {method:'PATCH',body:JSON.stringify(patch)});
}
export async function supabaseSelect(table, query='') {
  return request(`${table}${query ? `?${query}` : ''}`, {method:'GET',prefer:'return=representation'});
}
export async function supabaseDelete(table, filters) {
  const query=Object.entries(filters).map(([k,v])=>`${encodeURIComponent(k)}=eq.${encodeURIComponent(String(v))}`).join('&');
  return request(`${table}?${query}`, {method:'DELETE'});
}
export async function supabaseRpc(name, args={}) {
  return request(`rpc/${name}`, {method:'POST',body:JSON.stringify(args)});
}
