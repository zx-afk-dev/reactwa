import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import ReactionForm from '../components/ReactionForm';
import GlobalStats from '../components/GlobalStats';
import PublicMaintenance from '../components/PublicMaintenance';

export default function Home() {
  const [maintenance, setMaintenance] = useState(null);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    fetch('/api/maintenance', {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json().catch(() => null);

        // A failed maintenance check must never leave the homepage stuck
        // on the loading note. The API can be temporarily unavailable while
        // Supabase/Vercel is being configured.
        if (!response.ok || !data?.success) {
          throw new Error(data?.message || 'Maintenance check unavailable');
        }

        return data;
      })
      .then((data) => {
        if (active) {
          setMaintenance(data.maintenance || { enabled: false });
        }
      })
      .catch(() => {
        if (active) {
          setMaintenance({ enabled: false });
        }
      })
      .finally(() => clearTimeout(timeout));

    return () => {
      active = false;
      controller.abort();
      clearTimeout(timeout);
    };
  }, []);

  if (maintenance?.enabled) {
    return <PublicMaintenance />;
  }

  if (maintenance === null) {
    return (
      <Layout>
        <div className="maintenance-check" aria-label="Memeriksa status layanan">
          <div className="maintenance-check-paper">Checking service note<span>...</span></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="hero">
        <div className="hero-copy">
          <div className="scribble">digital scrapbook / 01</div>
          <h1>React like you<br /><span>left a note.</span></h1>
          <p className="hero-text">
            A tiny handmade corner for sending reactions to WhatsApp Channel posts.
            Request divalidasi lalu langsung dikirim ke reaction service.
          </p>
          <div className="stamp">DIRECT<br /><b>SEND</b></div>
        </div>
        <div className="hero-doodle" aria-hidden="true">↗<span>pick a post<br />& leave a mark</span></div>
      </section>

      <section className="archive-grid">
        <ReactionForm />
        <aside className="side-stack">
          <article className="paper-card note-blue tilt-left">
            <span className="pin pin-blue" aria-hidden="true" />
            <span className="note-number">02</span>
            <h3>Simple, direct flow</h3>
            <ol>
              <li>Request masuk ke server kita.</li>
              <li>Server memvalidasi URL dan reaction.</li>
              <li>Server meneruskan request ke reaction service.</li>
              <li>Response dikembalikan langsung.</li>
            </ol>
          </article>

          <article className="paper-card note-yellow tilt-right">
            <span className="tape tape-red" aria-hidden="true" />
            <h3>Less machinery</h3>
            <p>
              Tidak ada antrean global, worker, polling status, atau Firebase
              Realtime Database yang dibutuhkan untuk mengirim reaction.
            </p>
            <span className="hand-sign">— archive keeper</span>
          </article>
        </aside>
      </section>

      <GlobalStats />

      <section className="tiny-archive">
        <span className="archive-line" />
        <div><b>ARCHIVE NOTE</b><p>Paper outside. Direct send inside.</p></div>
        <span className="archive-line" />
      </section>
    </Layout>
  );
}
