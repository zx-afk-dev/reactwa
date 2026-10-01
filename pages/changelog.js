import Layout from '../components/Layout';

const ENTRIES = [
  ['2026-10-01', 'Global queue proxy', 'Request sekarang melewati proxy server-side dan antrean global sebelum diteruskan ke reaction service.'],
  ['2026-10-01', 'Anti-spam layer', 'Ditambahkan burst limit, per-minute limit, deduplikasi, queue cap, worker lock, timeout, dan retry terbatas.'],
  ['2026-10-01', 'Notebook rebuild', 'UI utama diarahkan ke gaya digital scrapbook / notebook.'],
];

export default function Changelog() {
  return (
    <Layout title="Changelog — ReactionWA">
      <section className="content-page">
        <div className="scribble">archive / changes</div>
        <h1>Changelog</h1>
        {ENTRIES.map(([date, title, text], index) => (
          <article className={`paper-card ${index % 2 ? 'note-yellow tilt-right' : 'note-blue tilt-left'}`} key={title}>
            <span className="note-number">{date}</span>
            <h3>{title}</h3>
            <p className="muted">{text}</p>
          </article>
        ))}
      </section>
    </Layout>
  );
}
