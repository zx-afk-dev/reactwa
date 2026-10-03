import crypto from 'crypto';

function normalizeIp(value) {
  let ip = String(value || '').trim();
  if (!ip) return '0.0.0.0';

  if (ip.startsWith('::ffff:')) ip = ip.slice(7);

  // Remove IPv6 zone identifiers if a proxy includes one.
  const zone = ip.indexOf('%');
  if (zone !== -1) ip = ip.slice(0, zone);

  return ip.toLowerCase();
}

// Free-tier identity is derived from the server-observed IP.
// The raw IP is never stored in the database.
export function hashIp(ip) {
  const normalized = normalizeIp(ip);
  const salt = process.env.IP_HASH_SALT || process.env.ADMIN_SESSION_SECRET;

  if (!salt) {
    throw new Error('IP_HASH_SALT or ADMIN_SESSION_SECRET must be configured.');
  }

  return crypto
    .createHash('sha256')
    .update(`${normalized}:${salt}`)
    .digest('hex');
}

export function getClientIpFromRequest(req) {
  // On Vercel, x-forwarded-for is the standard client IP header.
  // Only the first address is used; do not trust a browser-supplied
  // visitorIp field from the request body.
  const forwarded = req.headers['x-forwarded-for'];

  if (forwarded) {
    const first = String(forwarded).split(',')[0].trim();
    if (first) return normalizeIp(first);
  }

  const real = req.headers['x-real-ip'];
  if (real) return normalizeIp(real);

  return normalizeIp(req.socket?.remoteAddress || '0.0.0.0');
}
