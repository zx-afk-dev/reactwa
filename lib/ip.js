import crypto from 'crypto';

// Visitor identity for the free-tier coin system is always derived from a
// salted hash of the IP, never the raw IP - see /privacy for why.
export function hashIp(ip) {
  const salt = process.env.IP_HASH_SALT || process.env.ADMIN_SESSION_SECRET || 'reactionwa-default-salt';
  return crypto.createHash('sha256').update(`${ip}:${salt}`).digest('hex');
}

export function getClientIpFromRequest(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  const real = req.headers['x-real-ip'];
  if (real) return String(real).trim();
  return req.socket?.remoteAddress || '0.0.0.0';
}
