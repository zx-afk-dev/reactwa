import Layout from '../components/Layout';

const FAQ = [
  ['Apakah browser langsung menghubungi reaction service?', 'Tidak. Browser hanya berbicara dengan /api/react milik website ini. Pengiriman ke upstream dilakukan server-side oleh worker.'],
  ['Kenapa request bisa menunggu?', 'Karena semua request melewati antrean global dan worker sengaja dibatasi agar upstream tidak menerima lonjakan besar sekaligus.'],
  ['Apakah request yang sama bisa masuk berkali-kali?', 'Request identik yang datang dalam jendela deduplikasi akan ditolak sementara.'],
  ['Apa yang terjadi jika upstream lambat atau error?', 'Worker memakai timeout dan retry terbatas. Setelah batas retry tercapai, job ditandai failed.'],
  ['Apakah antrean bertahan saat Vercel mengganti instance?', 'Data antrean disimpan di Redis, bukan memory instance serverless.'],
];

export default function FAQ() {
  return (
    <Layout title="FAQ — ReactionWA">
      <section className="content-page">
        <div className="scribble">frequently asked notes</div>
        <h1>FAQ</h1>
        {FAQ.map(([question, answer], index) => (
          <article className={`paper-card ${index % 2 ? 'note-yellow tilt-right' : ''}`} key={question}>
            <h3>{question}</h3>
            <p className="muted">{answer}</p>
          </article>
        ))}
      </section>
    </Layout>
  );
}
