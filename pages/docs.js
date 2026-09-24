import { useState } from 'react';
import Layout from '../components/Layout';

function CodeBlock({ code }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <div className="code-block">
      <button className="copy-btn" onClick={copy}>{copied ? 'Copied!' : 'Copy'}</button>
      <pre><code>{code}</code></pre>
    </div>
  );
}

const REQUEST_BODY = `{
  "url": "https://whatsapp.com/channel/xxxxxxxx/123",
  "reaction": "🥳,👍",
  "requestId": "optional-idempotency-id"
}`;

const RESPONSE_QUEUED = `{
  "success": true,
  "code": "QUEUED",
  "message": "Request kamu sedang berada dalam antrean.",
  "requestId": "...",
  "status": "waiting",
  "queue": { "position": 2, "total": 3 }
}`;

const RESPONSE_ERROR = `{
  "success": false,
  "code": "RATE_LIMIT",
  "message": "Rate limit tercapai. Coba lagi sebentar lagi."
}`;

const CURL = `curl -X POST "https://your-domain.com/api/v1/react" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: DEV-XXXXXXXXXXXX" \\
  -d '{
    "url": "https://whatsapp.com/channel/xxxxxxxx/123",
    "reaction": "🥳,👍"
  }'`;

const JS_EXAMPLE = `const res = await fetch("https://your-domain.com/api/v1/react", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": "DEV-XXXXXXXXXXXX",
  },
  body: JSON.stringify({
    url: "https://whatsapp.com/channel/xxxxxxxx/123",
    reaction: "🥳,👍",
  }),
});
const data = await res.json();
console.log(data);`;

const PY_EXAMPLE = `import requests

resp = requests.post(
    "https://your-domain.com/api/v1/react",
    headers={
        "Content-Type": "application/json",
        "x-api-key": "DEV-XXXXXXXXXXXX",
    },
    json={
        "url": "https://whatsapp.com/channel/xxxxxxxx/123",
        "reaction": "🥳,👍",
    },
)
print(resp.json())`;

export default function Docs() {
  return (
    <Layout title="Docs" description="Dokumentasi API ReactionWA untuk developer.">
      <section className="page-header">
        <h1>Reaction API</h1>
        <p>Dokumentasi untuk developer yang punya DEV Key (API access).</p>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Catatan: ini beda dari kode redeem tipe &quot;DEV&quot; di halaman{' '}
          <a href="/redeem">/redeem</a> (yang meng-upgrade plan browsing di
          website ini). DEV Key di bawah ini untuk memanggil API dari server
          kamu sendiri (curl, backend, dsb), diminta terpisah ke Owner.
        </p>
      </section>

      <div className="card docs-card">
        <h2><span className="method-badge">POST</span> /api/v1/react</h2>

        <h3>Authentication</h3>
        <p>Sertakan header <code>x-api-key</code> berisi DEV key kamu.</p>

        <h3>Request Body</h3>
        <CodeBlock code={REQUEST_BODY} />

        <h3>Response (queued)</h3>
        <CodeBlock code={RESPONSE_QUEUED} />

        <h3>Response (error)</h3>
        <CodeBlock code={RESPONSE_ERROR} />

        <h3>Error Codes</h3>
        <ul className="docs-list">
          <li><code>INVALID_URL</code> — URL postingan tidak valid</li>
          <li><code>INVALID_REACTION</code> — Emoji tidak valid / lebih dari 3</li>
          <li><code>UNAUTHORIZED</code> — DEV key tidak dikirim</li>
          <li><code>INVALID_KEY</code> / <code>EXPIRED_KEY</code> — DEV key tidak valid</li>
          <li><code>HOST_NOT_ALLOWED</code> — Origin/host tidak diizinkan untuk key ini</li>
          <li><code>RATE_LIMIT</code> — Rate limit per menit tercapai</li>
          <li><code>MAINTENANCE</code> — Layanan sedang maintenance</li>
          <li><code>SERVICE_BUSY</code> / <code>UPSTREAM_ERROR</code> — Gagal di sisi layanan reaction</li>
        </ul>

        <h3>Rate Limit</h3>
        <p>Setiap DEV key memiliki rate limit per menit yang dapat diatur Owner melalui Admin Panel. Semua request, termasuk dari plan DEV, tetap diproses melalui antrean global satu-per-satu ke upstream.</p>

        <h3>Allowed Host</h3>
        <p>Owner dapat membatasi DEV key agar hanya bisa dipakai dari host/origin tertentu. Jika tidak diatur, key dapat digunakan dari mana saja — tetap rahasiakan key kamu, karena header Origin/Referer saja bukan lapisan keamanan yang sempurna.</p>

        <h3>Contoh cURL</h3>
        <CodeBlock code={CURL} />
        <h3>Contoh JavaScript</h3>
        <CodeBlock code={JS_EXAMPLE} />
        <h3>Contoh Python</h3>
        <CodeBlock code={PY_EXAMPLE} />

        <h3>Ketentuan Penggunaan API</h3>
        <p>Penggunaan API DEV tunduk pada <a href="/terms">Ketentuan &amp; Syarat Penggunaan</a>. Jangan membagikan DEV key kamu ke pihak lain, dan jangan gunakan API untuk tujuan yang melanggar ketentuan tersebut.</p>
      </div>
    </Layout>
  );
}
