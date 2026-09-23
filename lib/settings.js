import { db, FieldValue } from './firebaseAdmin';

const DEFAULT_SETTINGS = {
  siteName: 'ReactionWA',
  siteDescription: 'Layanan untuk membantu pengguna memberikan reaction pada postingan Saluran WhatsApp dengan cepat dan mudah.',
  whatsappOwnerNumber: '628880709243',
  maintenance: { enabled: false, title: '', description: '', eta: '' },
  freeCoinDefault: 3,
  freeRateLimitPerMinute: 6,
  vipRateLimitPerMinute: 20,
  devRateLimitPerMinute: 60,
  queue: { priorityEnabled: true },
  terms: { version: 1 },
  pricing: {
    free: {
      name: 'Free', price: 0, durationDays: 0, coin: 3, dailyLimit: 3,
      description: 'Cocok untuk penggunaan ringan sehari-hari.',
      benefits: ['3 coin setiap hari', 'Antrean standar', 'Akses fitur dasar'],
    },
    vip: {
      name: 'VIP', price: 0, durationDays: 30, coin: 100, dailyLimit: 0,
      description: 'Hubungi Owner untuk info harga & aktivasi.',
      benefits: ['Coin lebih besar', 'Prioritas antrean', 'Akses fitur premium'],
    },
    dev: {
      name: 'Dev', price: 0, durationDays: 30, coin: 0, dailyLimit: 0,
      description: 'Untuk developer yang ingin integrasi via API.',
      benefits: ['API tanpa batas jumlah paket', 'Prioritas tertinggi di antrean', 'Rate limit dapat diatur Owner'],
    },
  },
};

let cache = null;
let cacheAt = 0;
const CACHE_MS = 15000;

function deepMerge(base, override) {
  const out = { ...base };
  for (const key of Object.keys(override || {})) {
    const val = override[key];
    if (val && typeof val === 'object' && !Array.isArray(val) && base[key] && typeof base[key] === 'object' && !Array.isArray(base[key])) {
      out[key] = deepMerge(base[key], val);
    } else if (val !== undefined) {
      out[key] = val;
    }
  }
  return out;
}

export async function getSettings() {
  const now = Date.now();
  if (cache && now - cacheAt < CACHE_MS) return cache;
  const snap = await db.collection('settings').doc('general').get();
  const data = snap.exists ? snap.data() : {};
  cache = deepMerge(DEFAULT_SETTINGS, data);
  cacheAt = now;
  return cache;
}

export async function updateSettings(partial) {
  await db.collection('settings').doc('general').set(
    { ...partial, updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
  cache = null;
  return getSettings();
}
