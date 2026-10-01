import Layout from '../components/Layout';

export default function Privacy() {
  return (
    <Layout title="Privacy — ReactionWA">
      <section className="content-page">
        <div className="scribble">archive / privacy</div>
        <h1>Privacy</h1>
        <article className="paper-card">
          <h3>Data yang diproses</h3>
          <p className="muted">Request queue menyimpan URL target, reaction, status job, waktu pembuatan, jumlah percobaan, dan hash IP untuk kebutuhan rate-limit/operasional. IP mentah tidak disimpan sebagai bagian dari job.</p>
        </article>
        <article className="paper-card note-blue">
          <h3>Keamanan</h3>
          <p className="muted">Target upstream disimpan sebagai konfigurasi server. Token Redis dan secret cron hanya berada di environment server dan tidak dikirim ke browser.</p>
        </article>
        <article className="paper-card note-yellow">
          <h3>Retensi</h3>
          <p className="muted">Job queue otomatis kedaluwarsa sesuai <code>QUEUE_JOB_TTL</code>. Nilai default adalah 24 jam.</p>
        </article>
      </section>
    </Layout>
  );
}
