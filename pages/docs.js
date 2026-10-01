import Layout from '../components/Layout';

const CURL = `curl -X POST "https://your-domain.com/api/react" \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://whatsapp.com/channel/xxxxxxxx/123",
    "emojis": "🥳,👍"
  }'`;

export default function Docs() {
  return (
    <Layout title="Docs — ReactionWA">
      <section className="content-page">
        <div className="scribble">note / api</div>
        <h1>Direct reaction API</h1>

        <article className="paper-card note-blue">
          <h3>Public endpoint</h3>
          <p className="muted"><code>POST /api/react</code></p>
          <p>
            Request divalidasi oleh server ReactionWA lalu langsung diteruskan
            ke reaction service. Tidak ada antrean global atau polling status.
          </p>
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
  "code": "SENT",
  "message": "Reaction berhasil dikirim.",
  "data": {}
}`}</pre>
          <p>Response berasal dari service reaction setelah request diproses.</p>
        </article>

        <article className="paper-card">
          <h3>Protection</h3>
          <ul>
            <li>Validasi URL WhatsApp Channel.</li>
            <li>Batas 1 sampai 5 reaction unik.</li>
            <li>Timeout upstream.</li>
            <li>Service upstream tetap hanya dipanggil dari server.</li>
          </ul>
        </article>

        <article className="paper-card">
          <h3>cURL</h3>
          <pre>{CURL}</pre>
        </article>

        <article className="paper-card">
          <h3>Environment</h3>
          <p className="muted">
            Gunakan <code>REACTION_API_URL</code> untuk menentukan endpoint
            reaction service dan <code>UPSTREAM_TIMEOUT</code> untuk batas waktu.
          </p>
        </article>
      </section>
    </Layout>
  );
}
