// Thin wrapper around the upstream reaction API. Never called directly from
// the browser - credentials stay server-side only.
//
// Auth: the upstream service authenticates via a refreshToken sent in the
// JSON body (not a header/API key), so UPSTREAM_REFRESH_TOKEN must be set.
export async function callUpstreamReact(url, emojis) {
  const endpoint = process.env.UPSTREAM_REACT_URL;
  const refreshToken = process.env.UPSTREAM_REFRESH_TOKEN;
  const timeoutMs = Number(process.env.UPSTREAM_TIMEOUT || 30000);
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');

  if (!endpoint || !refreshToken) {
    throw new Error('Upstream reaction API is not configured (UPSTREAM_REACT_URL / UPSTREAM_REFRESH_TOKEN).');
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const headers = { 'Content-Type': 'application/json' };
    // Some upstream providers lock access to a specific domain and check
    // the caller's Origin/Referer header to enforce it. This is a
    // server-to-server call, so no browser adds those headers for us -
    // set them explicitly to match the site this deployment runs on.
    if (siteUrl) {
      headers.Origin = siteUrl;
      headers.Referer = `${siteUrl}/`;
    }

    const resp = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ refreshToken, url, emojis }),
      signal: controller.signal,
    });
    const body = await resp.json().catch(() => null);
    return { httpOk: resp.ok, status: resp.status, body };
  } catch (err) {
    if (timedOut || err?.name === 'AbortError' || /aborted/i.test(String(err?.message || ''))) {
      const error = new Error(`Upstream request timed out after ${timeoutMs}ms`);
      error.code = 'UPSTREAM_TIMEOUT';
      error.cause = err;
      throw error;
    }
    const error = new Error(String(err?.message || err));
    error.code = 'UPSTREAM_NETWORK_ERROR';
    error.cause = err;
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

// Keeps only a minimal, safe summary of the upstream's response for our own
// internal storage (queueTasks.result, visible via the Admin API). The
// upstream's internal identifiers (e.g. task.key_id) and account/business
// data (e.g. vip.pointRemaining, packageName) are never ours to keep or
// display - not even to our own Admin Panel - so we deliberately discard
// everything except a success flag and a human-readable message.
export function sanitizeUpstreamResult(body) {
  if (!body || typeof body !== 'object') return null;
  const message = body.message || body.data?.message || null;
  const success = typeof body.success === 'boolean' ? body.success
    : typeof body.status === 'boolean' ? body.status
    : null;
  return { success, message };
}
