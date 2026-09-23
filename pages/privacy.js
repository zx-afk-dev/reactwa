import Layout from '../components/Layout';

export default function Privacy() {
  return (
    <Layout title="Kebijakan Privasi">
      <section className="page-header">
        <h1>Kebijakan Privasi</h1>
      </section>
      <div className="card legal-card">
        <p>Kami menghargai privasi pengguna. Berikut ringkasan bagaimana data diperlakukan:</p>
        <ol>
          <li>Kami tidak menyimpan alamat IP mentah kamu untuk keperluan permanen. Identitas kuota disimpan dalam bentuk hash, bukan IP asli.</li>
          <li>Data yang disimpan terbatas pada yang diperlukan untuk operasional layanan, seperti status kuota, riwayat penggunaan, dan statistik agregat.</li>
          <li>Kami tidak membagikan data pengguna kepada pihak ketiga untuk tujuan komersial.</li>
          <li>Statistik publik yang ditampilkan di halaman Status bersifat agregat dan tidak memuat data pribadi individu.</li>
          <li>Untuk pertanyaan terkait privasi, silakan hubungi Owner melalui kontak yang tersedia di halaman Pricing.</li>
        </ol>
      </div>
    </Layout>
  );
}
