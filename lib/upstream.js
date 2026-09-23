// Thin wrapper around the upstream reaction API. Never called directly from
// the browser - the API key stays server-side only.
export async function callUpstreamReact(url, reaction) {
  const endpoint = process.env.UPSTREAM_REACT_URL;
  const apiKey = process.env.UPSTREAM_REACT_KEY;
  const timeoutMs = Number(process.env.UPSTREAM_TIMEOUT || 15000);

  if (!endpoint || !apiKey) {
    throw new Error('Upstream reaction API is not configured (UPSTREAM_REACT_URL / UPSTREAM_REACT_KEY).');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ url, reaction }),
      signal: controller.signal,
    });
    const body = await resp.json().catch(() => null);
    return { httpOk: resp.ok, status: resp.status, body };
  } finally {
    clearTimeout(timer);
  }
}
