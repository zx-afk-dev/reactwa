import Layout from '../components/Layout';
import ReactionForm from '../components/ReactionForm';

export default function Home() {
  return (
    <Layout>
      <section className="hero">
        <h1>ReactionWA, catatan kecil untuk setiap reaction.</h1>
        <p>Tempel link postingan Saluran WhatsApp, pilih emoji, lalu biarkan ReactionWA mengurus antreannya.</p>
      </section>

      <div className="note-kicker" style={{ textAlign: 'center', margin: '-5px auto 20px', color: 'var(--blue)', fontFamily: 'Caveat, cursive', fontSize: 19 }}>
        ✎ today's reaction note
      </div>

      <ReactionForm />

      <section className="card" style={{ maxWidth: 720, margin: '28px auto 0', background: '#fff4c9' }}>
        <strong className="sticky-title" style={{ fontSize: 24, color: 'var(--red)' }}>Quick note</strong>
        <p style={{ color: 'var(--ink-soft)', lineHeight: 1.7, marginBottom: 0 }}>
          Pilih maksimal 3 emoji per request. Request akan masuk ke antrean dan statusnya bisa dipantau dari halaman ini.
        </p>
      </section>
    </Layout>
  );
}
