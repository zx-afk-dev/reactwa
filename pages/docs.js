import Layout from '../components/Layout';

const CURL = `curl -X POST "https://react.v1.zfile.web.id/api/react" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: rw_live_YOUR_API_KEY" \
  -d '{
    "url": "https://whatsapp.com/channel/xxxxxxxx/123",
    "emojis": "🥳,👍"
  }'`;

export default function Docs() {
  return (
    <Layout title="Docs — ReactionWA">
      <section className="content-page">
        <div className="scribble">note / api</div>
        <h1>ReactionWA API</h1>

        <article className="paper-card note-blue">
          <h3>💎 VIP API</h3>
          <p>
            Pengguna VIP dapat menggunakan <code>POST /api/react</code> dengan API Key.
            API Key dibuat dari menu VIP API Keys dan secret hanya ditampilkan sekali.
          </p>
          <p className="muted">
            Rate limit VIP API: 30 request/menit dan 1.000 request/jam.
          </p>
        </article>

        <article className="paper-card">
          <h3>Endpoint</h3>
          <p className="muted"><code>POST /api/react</code></p>
          <p>
            Request divalidasi di server, dimasukkan ke antrean global, lalu diproses
            oleh worker. VIP mendapat prioritas antrean.
          </p>
        </article>

        <article className="paper-card">
          <h3>Headers</h3>
          <pre>{`Content-Type: application/json
X-API-Key: rw_live_YOUR_API_KEY`}</pre>
          <p className="muted">
            Alternatif: API Key juga dapat dikirim sebagai <code>Authorization: Bearer rw_live_...</code>.
          </p>
        </article>

        <article className="paper-card">
          <h3>Request body</h3>
          <pre>{`{
  "url": "https://whatsapp.com/channel/xxxxxxxx/123",
  "emojis": "🥳,👍",
  "requestId": "optional-uuid"
}`}</pre>
          <p className="muted">
            VIP dapat mengirim maksimal 30 reaction unik dalam satu request.
            <code>requestId</code> opsional, tetapi direkomendasikan untuk idempotensi.
          </p>
        </article>

        <article className="paper-card note-yellow">
          <h3>Response</h3>
          <pre>{`{
  "success": true,
  "code": "QUEUED",
  "message": "Reaction masuk antrean VIP.",
  "requestId": "uuid",
  "status": "waiting",
  "plan": "VIP"
}`}</pre>
        </article>

        <article className="paper-card">
          <h3>cURL</h3>
          <pre>{CURL}</pre>
        </article>

        <article className="paper-card">
          <h3>Status request</h3>
          <p>
            Gunakan <code>GET /api/reaction-status?id=REQUEST_ID</code> dengan
            Firebase authentication untuk melihat status request milik akun.
          </p>
        </article>

        <article className="paper-card">
          <h3>Protection</h3>
          <ul>
            <li>API Key disimpan dalam bentuk SHA-256 hash.</li>
            <li>API Key hanya aktif untuk akun VIP.</li>
            <li>API request tidak membutuhkan CAPTCHA interaktif.</li>
            <li>Rate limit API terpisah dari request browser.</li>
            <li>Idempotency mencegah request yang sama melakukan charge dua kali.</li>
            <li>VIP diprioritaskan oleh worker queue.</li>
          </ul>
        </article>

        <article className="paper-card note-yellow">
          <h3>Coin & paket</h3>
          <p>
            Paket Free menggunakan coin. Paket VIP tidak menggunakan coin untuk
            reaction dan mendapatkan prioritas antrean.
          </p>
        </article>
      </section>
    </Layout>
  );
}
