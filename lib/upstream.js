// Thin wrapper around the upstream reaction API. Never called directly from
// the browser - the API key stays server-side only.
export async function callUpstreamReact(url, reaction) {
  const endpoint = process.env.UPSTREAM_REACT_URL;
  const apiKey = process.env.UPSTREAM_REACT_KEY;
  const timeoutMs = Number(process.env.UPSTREAM_TIMEOUT || 15000);
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');

  if (!endpoint || !apiKey) {
    throw new Error('Upstream reaction API is not configured (UPSTREAM_REACT_URL / UPSTREAM_REACT_KEY).');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers = { 'Content-Type': 'application/json', 'x-api-key': apiKey };
    // Some upstream providers lock an API key to a specific domain and
    // check the caller's Origin/Referer header to enforce it (this is
    // exactly what apiv2.reactionwa.online's "Akses Ditolak" error means).
    // Since this call happens server-to-server, no browser is involved to
    // add those headers automatically - so we set them ourselves to match
    // the site the key was issued for.
    if (siteUrl) {
      headers.Origin = siteUrl;
      headers.Referer = `${siteUrl}/`;
    }

    const resp = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ url, reaction }),
      signal: controller.signal,
    });
    const body = await resp.json().catch(() => null);
    return { httpOk: resp.ok, status: resp.status, body };
  } finally {
    clearTimeout(timer);
  }
}
