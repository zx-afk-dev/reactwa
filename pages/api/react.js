const UPSTREAM_URL = process.env.REACTION_API_URL || 'https://react.zfile.web.id/api/send-reaction';

export const config = {
  api: {
    bodyParser: { sizeLimit: '16kb' },
  },
};

function normalizeUrl(value) {
  return value.trim().replace(/#.*$/, '');
}

function parseEmojis(value) {
  if (Array.isArray(value)) {
    return value.map(String).map((x) => x.trim()).filter(Boolean);
  }

  return String(value || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

function validateInput(body) {
  const url = typeof body?.url === 'string' ? normalizeUrl(body.url) : '';
  const emojis = parseEmojis(body?.emojis);

  if (!/^https?:\/\/whatsapp\.com\/channel\/[^\s/]+\/\d+(?:\?.*)?$/i.test(url)) {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_URL',
      message: 'URL WhatsApp Channel tidak valid.',
    };
  }

  if (emojis.length < 1 || emojis.length > 5) {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_REACTION',
      message: 'Pilih 1 sampai 5 reaction.',
    };
  }

  const unique = [...new Set(emojis)];
  if (unique.length !== emojis.length) {
    return {
      ok: false,
      status: 400,
      code: 'DUPLICATE_REACTION',
      message: 'Reaction tidak boleh duplikat.',
    };
  }

  if (unique.some((emoji) => emoji.length > 12)) {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_REACTION',
      message: 'Reaction terlalu panjang.',
    };
  }

  return { ok: true, url, emojis: unique };
}

async function sendUpstream(url, emojis) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Number(process.env.UPSTREAM_TIMEOUT || 10000)
  );

  try {
    const response = await fetch(UPSTREAM_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ReactionWA-Proxy/2.0',
      },
      body: JSON.stringify({
        url,
        emojis: emojis.join(','),
      }),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({
      success: false,
      message: 'Response upstream tidak valid.',
    }));

    return { response, data };
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      success: false,
      code: 'METHOD_NOT_ALLOWED',
      message: 'Method not allowed.',
    });
  }

  const input = validateInput(req.body);
  if (!input.ok) {
    return res.status(input.status).json({
      success: false,
      code: input.code,
      message: input.message,
    });
  }

  try {
    const { response, data } = await sendUpstream(input.url, input.emojis);

    if (!response.ok || data?.success === false) {
      return res.status(response.status >= 400 ? response.status : 502).json({
        success: false,
        code: 'UPSTREAM_ERROR',
        message: data?.message || 'Reaction service gagal memproses request.',
        response: data,
      });
    }

    return res.status(200).json({
      success: true,
      code: 'SENT',
      message: data?.message || 'Reaction berhasil dikirim.',
      data,
    });
  } catch (error) {
    const timeout = error?.name === 'AbortError';

    console.error('[reaction-proxy]', {
      name: error?.name,
      message: error?.message,
      timeout,
    });

    return res.status(504).json({
      success: false,
      code: timeout ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_UNAVAILABLE',
      message: timeout
        ? 'Reaction service terlalu lama merespons.'
        : 'Reaction service tidak dapat dihubungi.',
    });
  }
}
