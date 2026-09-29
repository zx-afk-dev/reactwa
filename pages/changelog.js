import Layout from '../components/Layout';

const ENTRIES = [
  {
    version: 'v1.9.0',
    date: '29 September 2026',
    title: 'Developer & Monitoring Update',
    changes: [
      'Developer Dashboard untuk memantau usage dan rate limit DEV API key.',
      'Rate Limit Dashboard khusus admin dengan data pemakaian key secara live.',
      'Error Alert opsional untuk mendeteksi lonjakan kegagalan upstream.',
      'Reaction form mendapat preview emoji dan Request ID yang lebih jelas.',
    ],
  },
  {
    version: 'v1.8.0',
    date: '29 September 2026',
    title: 'Queue Control',
    changes: [
      'Admin dapat memproses satu task antrean secara manual.',
      'Worker otomatis GitHub Actions tetap aktif.',
      'Queue lock mencegah manual processor dan worker memproses task yang sama.',
      'Dokumentasi queue dan polling diperbarui.',
    ],
  },
  {
    version: 'v1.7.0',
    date: 'September 2026',
    title: 'Stability & Security',
    changes: [
      'Validasi admin dan API diperketat.',
      'Coin refund pada task gagal dibuat lebih aman.',
      'Logging dan statistik dibuat lebih tahan terhadap data besar.',
      'UI utama diperbarui ke gaya scrapbook/notebook.',
    ],
  },
];

export default function Changelog() {
  return (
    <Layout>
      <section className="hero">
        <h1>Changelog</h1>
        <p>Catatan perubahan ReactionWA dari waktu ke waktu.</p>
      </section>

      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        {ENTRIES.map((entry, index) => (
          <article className="card" key={entry.version} style={{ marginBottom: 20, transform: `rotate(${index % 2 ? '.25' : '-.25'}deg)` }}>
            <div className="note-kicker">{entry.version} · {entry.date}</div>
            <h2 style={{ marginTop: 6 }}>{entry.title}</h2>
            <ul style={{ lineHeight: 1.8, color: 'var(--ink-soft)' }}>
              {entry.changes.map((change) => <li key={change}>{change}</li>)}
            </ul>
          </article>
        ))}
      </div>
    </Layout>
  );
}
