import Layout from '../components/Layout';

const ENTRIES = [
  ['2026-10-01', 'Direct reaction flow', 'Request sekarang divalidasi di server lalu langsung diteruskan ke reaction service tanpa global queue atau browser polling.'],
  ['2026-10-01', 'Simplified architecture', 'Sistem queue global, worker cron, reaction status endpoint, dan dependency Firebase untuk alur pengiriman reaction dihapus.'],
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
