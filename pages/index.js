import Layout from '../components/Layout';
import ReactionForm from '../components/ReactionForm';

export default function Home() {
  return (
    <Layout>
      <section className="hero">
        <div className="hero-copy">
          <div className="scribble">digital scrapbook / 01</div>
          <h1>React like you<br /><span>left a note.</span></h1>
          <p className="hero-text">A tiny handmade corner for sending reactions to WhatsApp Channel posts. No giant dashboard. Just a clean little notebook.</p>
          <div className="stamp">OPEN<br /><b>ARCHIVE</b></div>
        </div>
        <div className="hero-doodle" aria-hidden="true">↗<span>pick a post<br />& leave a mark</span></div>
      </section>
      <section className="archive-grid">
        <ReactionForm />
        <aside className="side-stack">
          <article className="paper-card note-blue tilt-left">
            <span className="pin pin-blue" aria-hidden="true" />
            <span className="note-number">02</span>
            <h3>How this little thing works</h3>
            <ol><li>Paste a public WhatsApp Channel post.</li><li>Pick the reactions you want.</li><li>We send them through the reaction service.</li></ol>
          </article>
          <article className="paper-card note-yellow tilt-right">
            <span className="tape tape-red" aria-hidden="true" />
            <h3>Keep in mind</h3>
            <p>Only use links you are allowed to interact with. The service may queue requests before processing.</p>
            <span className="hand-sign">— archive keeper</span>
          </article>
        </aside>
      </section>
      <section className="tiny-archive">
        <span className="archive-line" />
        <div><b>ARCHIVE NOTE</b><p>Built to feel like paper, not another corporate dashboard.</p></div>
        <span className="archive-line" />
      </section>
    </Layout>
  );
}
