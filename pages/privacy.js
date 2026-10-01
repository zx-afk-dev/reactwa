import Layout from '../components/Layout';

export default function Privacy() {
  return (
    <Layout title="Privacy — ReactionWA">
      <section className="content-page">
        <div className="scribble">archive / privacy</div>
        <h1>Privacy</h1>
        <article className="paper-card">
          <h3>Data yang diproses</h3>
          <p className="muted">
            ReactionWA memproses URL target dan reaction yang dikirim untuk
            meneruskan request ke reaction service. Untuk profil pengguna,
            coin, dan statistik, sistem menyimpan identifier berbasis hash IP.
            IP mentah tidak disimpan sebagai identifier pengguna.
          </p>
        </article>
        <article className="paper-card note-blue">
          <h3>Alur request</h3>
          <p className="muted">
            Browser mengirim request ke endpoint ReactionWA. Server melakukan
            validasi lalu meneruskannya ke reaction service. Tidak ada global
            queue atau polling status di sisi ReactionWA.
          </p>
        </article>
        <article className="paper-card note-yellow">
          <h3>Keamanan</h3>
          <p className="muted">
            URL service upstream, Firebase Admin credentials, dan secret server
            hanya digunakan di environment server dan tidak dikirim ke browser.
          </p>
        </article>
        <article className="paper-card">
          <h3>Retensi</h3>
          <p className="muted">
            Data profil dan statistik mengikuti penyimpanan Firestore yang
            digunakan oleh aplikasi. ReactionWA tidak lagi menyimpan job queue
            global untuk request reaction.
          </p>
        </article>
      </section>
    </Layout>
  );
}
