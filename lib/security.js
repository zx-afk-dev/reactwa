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

// Loose-but-safe check that a string is "just one emoji" (optionally a short
// ZWJ/skin-tone/variation-selector sequence, or a 2-letter flag), so a
// custom emoji typed via the device's own emoji keyboard can be accepted
// without opening the door to arbitrary text being smuggled into the
// reaction string that gets forwarded to the upstream API.
const CUSTOM_EMOJI_REGEX = /^((\p{Extended_Pictographic}|\p{Emoji_Presentation})(\u200D(\p{Extended_Pictographic}|\p{Emoji_Presentation})|\uFE0F|[\u{1F3FB}-\u{1F3FF}])*|[\u{1F1E6}-\u{1F1FF}]{2})$/u;

function isValidCustomEmoji(str) {
  if (typeof str !== 'string') return false;
  const trimmed = str.trim();
  if (!trimmed || trimmed.length > 16) return false; // generous ceiling for ZWJ sequences
  return CUSTOM_EMOJI_REGEX.test(trimmed);
}

// Validates 1-3 reaction emoji. Each one must be either from the preset
// ALLOWED_EMOJIS list, or a valid single custom emoji (see above). Returns
// `hasCustom: true` when at least one custom (non-preset) emoji was used,
// which callers use to charge the higher "custom emoji" coin cost.
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

  let hasCustom = false;
  for (const e of list) {
    if (ALLOWED_EMOJIS.includes(e)) continue;
    if (isValidCustomEmoji(e)) {
      hasCustom = true;
      continue;
    }
    return { valid: false };
  }
  return { valid: true, list, joined: list.join(','), hasCustom };
}
