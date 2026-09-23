import Layout from '../components/Layout';

export default function Terms() {
  return (
    <Layout title="Ketentuan & Syarat Penggunaan">
      <section className="page-header">
        <h1>Ketentuan &amp; Syarat Penggunaan</h1>
      </section>
      <div className="card legal-card">
        <p>Dengan menggunakan layanan ReactionWA, kamu menyetujui ketentuan berikut:</p>
        <ol>
          <li>Layanan ini disediakan untuk membantu memberikan reaction pada postingan Saluran WhatsApp secara wajar.</li>
          <li>Pengguna dilarang menyalahgunakan layanan, termasuk namun tidak terbatas pada spam, automasi berlebihan di luar batas wajar, atau upaya mengganggu ketersediaan layanan bagi pengguna lain.</li>
          <li>Kami berhak membatasi, menangguhkan, atau menghentikan akses pengguna yang terindikasi melakukan penyalahgunaan.</li>
          <li>Kuota/coin yang diberikan bersifat sesuai kebijakan yang berlaku dan dapat berubah sewaktu-waktu.</li>
          <li>Kunci VIP/DEV bersifat pribadi. Pengguna bertanggung jawab menjaga kerahasiaan kunci yang dimiliki.</li>
          <li>Layanan dapat mengalami maintenance atau gangguan tanpa pemberitahuan sebelumnya.</li>
          <li>Kami tidak bertanggung jawab atas kerugian yang timbul dari penyalahgunaan layanan oleh pengguna.</li>
          <li>Ketentuan ini dapat diperbarui sewaktu-waktu. Perubahan signifikan akan diinformasikan melalui website ini.</li>
        </ol>
        <p>Jika kamu tidak menyetujui ketentuan di atas, mohon untuk tidak menggunakan layanan ini.</p>
      </div>
    </Layout>
  );
}
