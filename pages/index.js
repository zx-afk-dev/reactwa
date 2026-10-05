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

  return (
    <Layout>
      <section className="hero">
        <div className="hero-copy">
          <div className="scribble">digital scrapbook / 01</div>
          <h1>React like you<br /><span>left a note.</span></h1>
          <p className="hero-text">
            A tiny handmade corner for sending reactions to WhatsApp Channel posts.
            Request divalidasi, masuk antrean, lalu diproses worker.
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
              <li>Request masuk antrean global.</li>
              <li>Worker meneruskan ke reaction service.</li>
            </ol>
          </article>

          <article className="paper-card note-yellow tilt-right">
            <span className="tape tape-red" aria-hidden="true" />
            <h3>Less machinery</h3>
            <p>
              Request diproses lewat antrean global agar traffic lebih stabil.
              Status request bisa dipantau sampai selesai.
            </p>
            <span className="hand-sign">— archive keeper</span>
          </article>
        </aside>
      </section>

      <GlobalStats />

      <section className="paper-card note-yellow" style={{ maxWidth: 900, margin: '28px auto' }}>
        <span className="tape tape-red" aria-hidden="true" />
        <div className="card-label">VIP / BENEFITS</div>
        <h2>💎 Upgrade ke VIP</h2>
        <p className="muted">
          Dapatkan jalur reaction yang lebih cepat dan tools lengkap untuk penggunaan rutin.
        </p>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))',
          gap: 10,
          marginTop: 16,
        }}>
          <div>⚡ <b>Prioritas antrean</b><br /><small>VIP diproses lebih dahulu.</small></div>
          <div>🚀 <b>Proses lebih cepat</b><br /><small>Jalur worker VIP.</small></div>
          <div>🔑 <b>API + API Key</b><br /><small>Untuk integrasi bot/app.</small></div>
          <div>📊 <b>Dashboard lengkap</b><br /><small>Statistik penggunaan VIP.</small></div>
          <div>♾️ <b>Riwayat lengkap</b><br /><small>History reaction tersimpan.</small></div>
        </div>
      </section>

      <section className="tiny-archive">
        <span className="archive-line" />
        <div><b>ARCHIVE NOTE</b><p>Paper outside. Queue inside. Results tracked.</p></div>
        <span className="archive-line" />
      </section>
    </Layout>
  );
}
