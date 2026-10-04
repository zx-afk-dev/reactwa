const UPSTREAM_URL = process.env.REACTION_API_URL || 'https://react.zfile.web.id/api/send-reaction';

export async function sendReactionUpstream(url, emojis, requestId = '') {
  const configuredTimeout = Number(process.env.UPSTREAM_TIMEOUT || 10000);
  const timeoutMs = Number.isFinite(configuredTimeout)
    ? Math.max(5000, Math.min(configuredTimeout, 120000))
    : 10000;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(UPSTREAM_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ReactionWA-Queue/1.0',
      },
      body: JSON.stringify({ url, emojis: emojis.join(','), requestId }),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({
      success: false,
      message: 'Response upstream tidak valid.',
    }));

    return { response, data };
  } finally {
    clearTimeout(timer);
  }
}
