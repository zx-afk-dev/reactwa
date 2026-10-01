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
            ReactionWA memproses URL WhatsApp Channel, reaction yang dipilih,
            informasi paket/coin, statistik penggunaan, dan hash IP untuk
            menghubungkan profil anonim serta kebutuhan operasional. IP mentah
            tidak disimpan sebagai ID pengguna.
          </p>
        </article>

        <article className="paper-card note-blue">
          <h3>Alur request</h3>
          <p className="muted">
            Browser mengirim request ke <code>/api/react</code>. Server
            memvalidasi request lalu meneruskannya ke reaction service.
            Tidak ada global queue atau endpoint polling status di ReactionWA.
          </p>
        </article>

        <article className="paper-card">
          <h3>IP anonim</h3>
          <p className="muted">
            Client dapat memperoleh IP publik melalui layanan ipify di browser
            untuk membantu mengenali profil anonim. Server menggunakan hash
            IP, bukan menyimpan IP mentah sebagai identitas pengguna.
          </p>
        </article>

        <article className="paper-card note-yellow">
          <h3>Keamanan</h3>
          <p className="muted">
            URL service reaction dan secret server disimpan sebagai environment
            variable dan tidak dikirim sebagai konfigurasi ke browser.
          </p>
        </article>

        <article className="paper-card">
          <h3>Retensi</h3>
          <p className="muted">
            ReactionWA tidak menggunakan job queue global untuk menyimpan
            pekerjaan reaction. Data profil dan statistik mengikuti retensi
            penyimpanan Firestore yang digunakan oleh layanan.
          </p>
        </article>
      </section>
    </Layout>
  );
}
