import Layout from '../components/Layout';

const FAQ_ITEMS = [
  ['Apakah ada antrean global?', 'Tidak. Request diteruskan langsung ke reaction service setelah validasi server.'],
  ['Apakah browser langsung mengakses reaction service?', 'Tidak. Browser tetap hanya mengakses /api/react milik ReactionWA. Server yang meneruskan request ke service reaction.'],
  ['Kenapa request bisa gagal?', 'Jika reaction service sedang error, tidak tersedia, atau melewati batas waktu, ReactionWA akan mengembalikan error upstream.'],
  ['Apakah perlu Firebase untuk mengirim reaction?', 'Tidak untuk sistem direct reaction. Pengiriman reaction tidak lagi bergantung pada Firebase Realtime Database queue.'],
];

export default function FAQ() {
  return (
    <Layout title="FAQ — ReactionWA">
      <section className="content-page">
        <div className="scribble">frequently asked notes</div>
        <h1>FAQ</h1>
        {FAQ_ITEMS.map(([question, answer], index) => (
          <article className={`paper-card ${index % 2 ? 'note-yellow tilt-right' : ''}`} key={question}>
            <h3>{question}</h3>
            <p className="muted">{answer}</p>
          </article>
        ))}
      </section>
    </Layout>
  );
}
