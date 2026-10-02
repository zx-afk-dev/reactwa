import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import Toast from '../components/Toast';
import { useAuth } from '../components/AuthProvider';

export default function Referral() {
  const { ready, user, getIdToken } = useAuth();
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  async function load() {
    if (!ready || !user) return;
    setLoading(true);
    try {
      const token = await getIdToken();
      const r = await fetch('/api/referral/me', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const data = await r.json();
      if (!r.ok || !data.success) throw new Error(data.message || 'Gagal memuat referral.');
      setInfo(data);
    } catch (err) {
      setToast({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [ready, user]);

  async function copy() {
    if (!info?.link) return;
    try {
      await navigator.clipboard.writeText(info.link);
      setToast({ type: 'success', text: 'Link undangan berhasil disalin.' });
    } catch {
      setToast({ type: 'error', text: info.link });
    }
  }

  return (
    <Layout title="Undang Teman">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <section className="content-page referral-page">
        <div className="scribble">account / referral note</div>
        <h1>Undang Teman</h1>
        <p className="hero-text">
          Bagikan link kamu. Saat teman mendaftar lewat link tersebut, kamu mendapat bonus coin.
          Setelah reaction pertama teman berhasil, ada bonus reaction referral tambahan.
        </p>

        {!ready ? (
          <div className="paper-card"><p className="muted">Menyiapkan akun…</p></div>
        ) : !user ? (
          <div className="paper-card"><p className="muted">Login diperlukan untuk membuat link undangan.</p></div>
        ) : loading ? (
          <div className="paper-card"><p className="muted">Membaca referral archive…</p></div>
        ) : info ? (
          <>
            <div className="paper-card referral-link-card">
              <span className="tape" aria-hidden="true" />
              <div className="scribble">your invitation link</div>
              <h2>Bagikan link ini ✦</h2>
              <div className="referral-link">{info.link}</div>
              <button className="send-button" type="button" onClick={copy}>Salin link undangan →</button>
              <p className="muted referral-note">
                Bonus pendaftaran: <b>+2 coin</b> · Bonus reaction pertama: <b>+1 coin</b>.
                Masing-masing teman hanya dapat memicu bonus sekali.
              </p>
            </div>

            <div className="referral-stats">
              <article className="paper-card"><span>FRIENDS</span><strong>{info.referredUsers}</strong><small>teman terhubung</small></article>
              <article className="paper-card"><span>SIGNUP</span><strong>{info.signup}</strong><small>bonus pendaftaran</small></article>
              <article className="paper-card"><span>REACTION</span><strong>{info.reactions}</strong><small>bonus reaction</small></article>
              <article className="paper-card"><span>EARNED</span><strong>+{info.earned}</strong><small>total coin referral</small></article>
            </div>
          </>
        ) : null}
      </section>
    </Layout>
  );
}
