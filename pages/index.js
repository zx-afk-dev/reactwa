import Layout from '../components/Layout';
import ReactionForm from '../components/ReactionForm';

export default function Home() {
  return (
    <Layout>
      <section className="hero">
        <div className="hero-copy">
          <div className="scribble">digital scrapbook / 01</div>
          <h1>React like you<br /><span>left a note.</span></h1>
          <p className="hero-text">A tiny handmade corner for sending reactions to WhatsApp Channel posts. Request masuk ke antrean global sebelum diproses.</p>
          <div className="stamp">GLOBAL<br /><b>QUEUE</b></div>
        </div>
        <div className="hero-doodle" aria-hidden="true">↗<span>pick a post<br />& leave a mark</span></div>
      </section>

      <section className="archive-grid">
        <ReactionForm />
        <aside className="side-stack">
          <article className="paper-card note-blue tilt-left">
            <span className="pin pin-blue" aria-hidden="true" />
            <span className="note-number">02</span>
            <h3>One request at a time</h3>
            <ol>
              <li>Request masuk ke server kita.</li>
              <li>Server menyaring spam dan duplikat.</li>
              <li>Request masuk antrean global.</li>
              <li>Worker mengirimnya ke service reaction.</li>
            </ol>
          </article>

          <article className="paper-card note-yellow tilt-right">
            <span className="tape tape-red" aria-hidden="true" />
            <h3>Built to protect the upstream</h3>
            <p>Browser tidak memanggil service reaction secara langsung. Ada rate limit, deduplikasi, batas ukuran antrean, lock worker, timeout, dan retry terbatas.</p>
            <span className="hand-sign">— archive keeper</span>
          </article>
        </aside>
      </section>

      <section className="tiny-archive">
        <span className="archive-line" />
        <div><b>ARCHIVE NOTE</b><p>Paper outside. Queue control inside.</p></div>
        <span className="archive-line" />
      </section>
    </Layout>
  );
}
