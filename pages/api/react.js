const UPSTREAM_URL = process.env.REACTION_API_URL || 'https://react.zfile.web.id/api/send-reaction';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, message: 'Method not allowed.' });
  }

  const { url, emojis } = req.body || {};

  if (typeof url !== 'string' || !/^https?:\/\/whatsapp\.com\/channel\//i.test(url.trim())) {
    return res.status(400).json({ success: false, message: 'URL WhatsApp Channel tidak valid.' });
  }

  if (typeof emojis !== 'string' || !emojis.trim()) {
    return res.status(400).json({ success: false, message: 'Reaction belum dipilih.' });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const upstream = await fetch(UPSTREAM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: url.trim(),
        emojis: emojis.trim()
      }),
      signal: controller.signal
    });

    const data = await upstream.json().catch(() => ({
      success: false,
      message: 'Upstream mengembalikan response tidak valid.'
    }));

    return res.status(upstream.ok ? 200 : upstream.status).json(data);
  } catch (error) {
    return res.status(error.name === 'AbortError' ? 504 : 502).json({
      success: false,
      message: error.name === 'AbortError'
        ? 'Request upstream timeout.'
        : 'Gagal menghubungi reaction service.'
    });
  } finally {
    clearTimeout(timeout);
  }
}
