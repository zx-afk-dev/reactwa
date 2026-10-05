import { createHash, randomBytes } from 'crypto';
import {
  supabaseDelete,
  supabaseInsert,
  supabaseRpc,
  supabaseSelect,
  supabaseUpdate,
} from './supabaseAdmin';

const API_KEY_PREFIX = 'rw_live_';

function hashApiKey(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

export function generateApiKey() {
  const secret = randomBytes(32).toString('base64url');
  const key = API_KEY_PREFIX + secret;
  return {
    key,
    keyHash: hashApiKey(key),
    keyPrefix: key.slice(0, 16),
  };
}

export async function useApiKey(key) {
  const value = String(key || '').trim();
  if (!value.startsWith(API_KEY_PREFIX)) return null;

  const rows = await supabaseRpc('use_reaction_api_key', {
    p_key_hash: hashApiKey(value),
  });
  const row = Array.isArray(rows) ? rows[0] : rows;

  if (!row?.id || !row?.firebase_uid) return null;

  return {
    id: row.id,
    firebaseUid: row.firebase_uid,
    name: row.name,
    status: row.status,
    requestCount: Number(row.request_count || 0),
  };
}

export async function createApiKey(firebaseUid, name = 'My API Key') {
  const generated = generateApiKey();
  const cleanName = String(name || 'My API Key').trim().slice(0, 80) || 'My API Key';

  await supabaseInsert('reaction_api_keys', {
    firebase_uid: firebaseUid,
    name: cleanName,
    key_prefix: generated.keyPrefix,
    key_hash: generated.keyHash,
    status: 'active',
  });

  return {
    key: generated.key,
    keyPrefix: generated.keyPrefix,
    name: cleanName,
  };
}

export async function listApiKeys(firebaseUid) {
  const rows = await supabaseSelect(
    'reaction_api_keys',
    'firebase_uid=eq.' + encodeURIComponent(firebaseUid) +
      '&select=id,name,key_prefix,status,request_count,created_at,last_used_at,revoked_at' +
      '&order=created_at.desc'
  );

  return (rows || []).map((row) => ({
    id: row.id,
    name: row.name,
    keyPrefix: row.key_prefix,
    status: row.status,
    requestCount: Number(row.request_count || 0),
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
  }));
}

export async function revokeApiKey(firebaseUid, id) {
  const rows = await supabaseUpdate(
    'reaction_api_keys',
    { id, firebase_uid: firebaseUid, status: 'active' },
    {
      status: 'revoked',
      revoked_at: new Date().toISOString(),
    }
  );

  return rows;
}

export async function countActiveApiKeys(firebaseUid) {
  const rows = await supabaseSelect(
    'reaction_api_keys',
    'firebase_uid=eq.' + encodeURIComponent(firebaseUid) +
      '&status=eq.active&select=id&limit=6'
  );
  return Array.isArray(rows) ? rows.length : 0;
}

export async function deleteRevokedApiKey(firebaseUid, id) {
  return supabaseDelete('reaction_api_keys', {
    id,
    firebase_uid: firebaseUid,
    status: 'revoked',
  });
}
