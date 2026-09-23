const ALLOWED_WA_HOSTS = ['whatsapp.com', 'www.whatsapp.com'];
const CHANNEL_PATH_REGEX = /^\/channel\/[A-Za-z0-9_-]+\/\d+\/?$/;

// Validates that a URL is a genuine, well-formed WhatsApp Channel post link.
// This also protects against SSRF-style tricks (javascript:, data:, file:,
// credentials-in-url, non-standard ports, non-whitelisted hosts, etc).
export function validateWhatsAppChannelUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string' || rawUrl.length > 512) {
    return { valid: false };
  }
  let parsed;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { valid: false };
  }
  if (parsed.protocol !== 'https:') return { valid: false };
  if (!ALLOWED_WA_HOSTS.includes(parsed.hostname.toLowerCase())) return { valid: false };
  if (parsed.username || parsed.password) return { valid: false };
  if (parsed.port) return { valid: false };
  if (!CHANNEL_PATH_REGEX.test(parsed.pathname)) return { valid: false };
  return { valid: true, url: `${parsed.origin}${parsed.pathname}` };
}

export const ALLOWED_EMOJIS = ['🥳', '👍', '❤️', '😂', '😮', '😢', '🙏', '🔥'];
export const MAX_EMOJIS = 3;

export function validateReactionEmojis(input) {
  if (!input) return { valid: false };
  let list;
  if (Array.isArray(input)) {
    list = input;
  } else if (typeof input === 'string') {
    list = input.split(',').map((s) => s.trim()).filter(Boolean);
  } else {
    return { valid: false };
  }
  if (list.length === 0 || list.length > MAX_EMOJIS) return { valid: false };
  const unique = [...new Set(list)];
  if (unique.length !== list.length) return { valid: false };
  for (const e of list) {
    if (!ALLOWED_EMOJIS.includes(e)) return { valid: false };
  }
  return { valid: true, list, joined: list.join(',') };
}
