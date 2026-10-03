import { useState } from 'react';
import Layout from '../components/Layout';
import Toast from '../components/Toast';
import { useAuth } from '../components/AuthProvider';

export default function Redeem() {
  const { ready, user, isGoogleUser, signInGoogle, getIdToken } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [toast, setToast] = useState(null);

  async function login() {
    setLoginLoading(true);
    try { await signInGoogle(); } catch {} finally { setLoginLoading(false); }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!code.trim() || loading || !ready) return;
    setLoading(true);

    try {
      const token = await getIdToken();
      if (!token) throw new Error('SESSION_REQUIRED');

      const resp = await fetch('/api/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await resp.json().catch(() => ({}));

      if (data.success) {
        setToast({ type: 'success', text: data.message });
        setCode('');
        return;
      }

      const reason = data.reason || data.data?.reason;
      if (reason === 'LOGIN_REQUIRED') {
        setToast({ type: 'error', text: 'Kode VIP membutuhkan login Google. Kode belum digunakan.' });
        return;
      }

      setToast({ type: 'error', text: data.message || 'Redeem gagal.' });
    } catch (err) {
      setToast({
        type: 'error',
        text: err?.message === 'SESSION_REQUIRED'
          ? 'Sesi belum siap. Tunggu sebentar lalu coba lagi.'
          : 'Gagal terhubung ke server.',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout title="Redeem Coin / VIP">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <section className="content-page">
        <div className="scribble">account / redeem note</div>
        <h1>Redeem Coin / VIP</h1>
        <p className="hero-text">
          Kode coin bonus bisa diredeem tanpa login. VIP Key membutuhkan login Google
          agar benefit VIP tersimpan ke akun.
        </p>

        <div className="paper-card redeem-auth-card">
          {!ready ? (
            <p className="muted">Menyiapkan sesi…</p>
          ) : (
            <>
              <div className="account-strip">
                <span className={isGoogleUser ? 'plan-badge plan-vip' : 'plan-badge'}>
                  {isGoogleUser ? 'GOOGLE' : 'GUEST'}
                </span>
                <span className="coin-badge">
                  {isGoogleUser ? (user?.displayName || user?.email || 'Akun Google') : 'Redeem coin tanpa login'}
                </span>
              </div>

              <h2>Masukkan redeem code ✎</h2>
              <p className="muted">
                Coin code dapat digunakan sebagai guest. Jika kodenya VIP, kamu akan
                diminta login Google sebelum kode dipakai.
              </p>

              <form onSubmit={handleSubmit}>
                <input
                  className="paper-input"
                  placeholder="COIN-XXXXXXXX atau VIP-XXXXXXXX"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  disabled={loading}
                  autoComplete="off"
                  required
                />
                <button className="send-button" disabled={loading || !code.trim()}>
                  {loading ? 'Memproses…' : 'Redeem sekarang →'}
                </button>
              </form>

              {!isGoogleUser && (
                <div className="redeem-login-note">
                  <span>VIP Key?</span>
                  <button type="button" className="nav-auth-button google" onClick={login} disabled={loginLoading}>
                    {loginLoading ? 'Membuka Google…' : 'Login Google'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </Layout>
  );
}
