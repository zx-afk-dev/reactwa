import Layout from '../components/Layout';

const CURL = `curl -X POST "https://your-domain.com/api/react" \\  -H "Content-Type: application/json" \\  -d '{
    "url": "https://whatsapp.com/channel/xxxxxxxx/123",
    "emojis": "🥳,👍"
  }'`;

export default function Docs() {
  return (
    <Layout title="Docs — ReactionWA">
      <section className="content-page">
        <div className="scribble">note / api</div>
        <h1>How the queue works</h1>

        <article className="paper-card note-blue">
          <h3>Public endpoint</h3>
          <p className="muted"><code>POST /api/react</code></p>
          <p>Website menerima request lalu memasukkannya ke antrean global. URL service upstream disimpan di server dan tidak dikirim ke browser.</p>
        </article>

        <article className="paper-card">
          <h3>Request body</h3>
          <pre>{`{
  "url": "https://whatsapp.com/channel/xxxxxxxx/123",
  "emojis": "🥳,👍"
}`}</pre>
          <p className="muted">Maksimal 5 reaction unik dalam satu request.</p>
        </article>

        <article className="paper-card note-yellow">
          <h3>Response</h3>
          <pre>{`{
  "success": true,
  "code": "QUEUED",
  "requestId": "uuid",
  "status": "waiting",
  "queue": { "position": 1 }
}`}</pre>
          <p>Gunakan <code>GET /api/reaction-status?id=REQUEST_ID</code> untuk melihat status.</p>
        </article>

        <article className="paper-card">
          <h3>Protection</h3>
          <ul>
            <li>Burst limit dan per-minute limit berbasis IP.</li>
            <li>Deduplikasi request yang sama.</li>
            <li>Batas ukuran queue global.</li>
            <li>Satu worker global pada satu waktu dengan Redis lock.</li>
            <li>Timeout upstream dan retry terbatas.</li>
            <li>Request hanya boleh menuju format WhatsApp Channel yang valid.</li>
          </ul>
        </article>

        <article className="paper-card">
          <h3>cURL</h3>
          <pre>{CURL}</pre>
        </article>

        <article className="paper-card">
          <h3>Environment</h3>
          <p className="muted">Wajib: <code>UPSTASH_REDIS_REST_URL</code>, <code>UPSTASH_REDIS_REST_TOKEN</code>, <code>CRON_SECRET</code>, dan <code>IP_HASH_SALT</code>.</p>
          <p className="muted">Target upstream default berada di sisi server melalui <code>REACTION_API_URL</code>; jangan membuatnya menjadi <code>NEXT_PUBLIC_*</code>.</p>
        </article>
      </section>
    </Layout>
  );
}
