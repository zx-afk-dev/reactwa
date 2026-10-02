import { supabaseSelect, supabaseUpsert } from './supabaseAdmin';

const DEFAULT_SETTINGS = {
  siteName: 'ReactionWA',
  siteDescription: 'Layanan untuk membantu pengguna memberikan reaction pada postingan Saluran WhatsApp dengan cepat dan mudah.',
  whatsappOwnerNumber: '628880709243',
  maintenance: { enabled: false, title: '', description: '', eta: '' },
  freeCoinDefault: 3,
  freeRateLimitPerMinute: 6,
  vipRateLimitPerMinute: 20,
  terms: { version: 1 },
  pricing: {
    free: {
      name: 'Free', price: 0, durationDays: 0, coin: 3, dailyLimit: 3,
      description: 'Cocok untuk penggunaan ringan sehari-hari.',
      benefits: ['3 coin setiap 24 jam', 'Maks. 5 emoji/request', 'Akses fitur dasar'],
    },
    vip: {
      name: 'VIP', price: 0, durationDays: 30, coin: 0, dailyLimit: 0,
      description: 'Hubungi Owner untuk info harga & aktivasi.',
      benefits: ['Tidak memakai coin', 'Maks. 30 emoji/request', 'Akses fitur premium'],
    },
  },
};

function finiteNumber(value, fallback, { min = -Infinity, max = Infinity, integer = false } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  if (integer && !Number.isInteger(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function normalizeMaintenance(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return {
    enabled: Boolean(value.enabled),
    title: typeof value.title === 'string' ? value.title.slice(0, 200) : '',
    description: typeof value.description === 'string' ? value.description.slice(0, 1000) : '',
    eta: typeof value.eta === 'string' ? value.eta.slice(0, 100) : '',
  };
}

function normalizePlan(plan, fallback) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) return fallback;
  return {
    name: typeof plan.name === 'string' ? plan.name.slice(0, 100) : fallback.name,
    price: finiteNumber(plan.price, fallback.price, { min: 0, max: 100000000, integer: true }),
    durationDays: finiteNumber(plan.durationDays, fallback.durationDays, { min: 0, max: 3650, integer: true }),
    coin: finiteNumber(plan.coin, fallback.coin, { min: 0, max: 1000000, integer: true }),
    dailyLimit: finiteNumber(plan.dailyLimit, fallback.dailyLimit, { min: 0, max: 1000000, integer: true }),
    description: typeof plan.description === 'string' ? plan.description.slice(0, 1000) : fallback.description,
    benefits: Array.isArray(plan.benefits)
      ? plan.benefits.filter((item) => typeof item === 'string').slice(0, 20).map((item) => item.slice(0, 200))
      : fallback.benefits,
  };
}

export function normalizeSettingsPatch(partial) {
  const input = partial && typeof partial === 'object' && !Array.isArray(partial) ? partial : {};
  const out = {};

  if ('siteName' in input) out.siteName = typeof input.siteName === 'string' ? input.siteName.slice(0, 100) : DEFAULT_SETTINGS.siteName;
  if ('siteDescription' in input) out.siteDescription = typeof input.siteDescription === 'string' ? input.siteDescription.slice(0, 1000) : DEFAULT_SETTINGS.siteDescription;
  if ('whatsappOwnerNumber' in input) out.whatsappOwnerNumber = typeof input.whatsappOwnerNumber === 'string' ? input.whatsappOwnerNumber.slice(0, 30) : DEFAULT_SETTINGS.whatsappOwnerNumber;
  if ('maintenance' in input) out.maintenance = normalizeMaintenance(input.maintenance) || DEFAULT_SETTINGS.maintenance;
  if ('freeCoinDefault' in input) out.freeCoinDefault = finiteNumber(input.freeCoinDefault, DEFAULT_SETTINGS.freeCoinDefault, { min: 0, max: 1000000, integer: true });
  if ('freeRateLimitPerMinute' in input) out.freeRateLimitPerMinute = finiteNumber(input.freeRateLimitPerMinute, DEFAULT_SETTINGS.freeRateLimitPerMinute, { min: 1, max: 100000, integer: true });
  if ('vipRateLimitPerMinute' in input) out.vipRateLimitPerMinute = finiteNumber(input.vipRateLimitPerMinute, DEFAULT_SETTINGS.vipRateLimitPerMinute, { min: 1, max: 100000, integer: true });

  if ('terms' in input && input.terms && typeof input.terms === 'object' && !Array.isArray(input.terms)) {
    out.terms = { version: finiteNumber(input.terms.version, DEFAULT_SETTINGS.terms.version, { min: 1, max: 1000000, integer: true }) };
  }
  if ('pricing' in input && input.pricing && typeof input.pricing === 'object' && !Array.isArray(input.pricing)) {
    out.pricing = {
      free: normalizePlan(input.pricing.free, DEFAULT_SETTINGS.pricing.free),
      vip: normalizePlan(input.pricing.vip, DEFAULT_SETTINGS.pricing.vip),
    };
  }

  return out;
}

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
  const rows = await supabaseSelect('settings', 'key=eq.general&limit=1');
  const data = rows?.[0]?.value && typeof rows[0].value === 'object' ? rows[0].value : {};
  cache = deepMerge(DEFAULT_SETTINGS, data);
  cacheAt = now;
  return cache;
}

export async function updateSettings(partial) {
  const safe = normalizeSettingsPatch(partial);
  const current = await getSettings();
  const merged = deepMerge(current, safe);
  await supabaseUpsert('settings', {
    key: 'general',
    value: merged,
    updated_at: new Date().toISOString(),
  }, 'key');
  cache = merged;
  cacheAt = Date.now();
  return cache;
}
