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
    try {
      await signInGoogle();
    } catch {} finally {
      setLoginLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!code.trim() || !isGoogleUser) return;
    setLoading(true);

    try {
      const token = await getIdToken();
      if (!token) throw new Error('LOGIN_REQUIRED');

      const resp = await fetch('/api/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await resp.json().catch(() => ({}));

      if (data.success) {
        setToast({ type: 'success', text: data.message });
        setCode('');
      } else {
        setToast({ type: 'error', text: data.message || 'Redeem gagal.' });
      }
    } catch (err) {
      setToast({
        type: 'error',
        text: err?.message === 'LOGIN_REQUIRED'
          ? 'Login Google diperlukan sebelum redeem.'
          : 'Gagal terhubung ke server.',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout title="Redeem VIP">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <section className="content-page">
        <div className="scribble">account / redeem note</div>
        <h1>Redeem VIP</h1>
        <p className="hero-text">
          Kode VIP terikat ke akun Google agar benefit tidak bergantung pada IP/browser.
          Setiap VIP key hanya dapat digunakan satu kali.
        </p>

        <div className="paper-card redeem-auth-card">
          {!ready ? (
            <p className="muted">Menyiapkan Firebase Authentication…</p>
          ) : !isGoogleUser ? (
            <>
              <h2>Login dulu ✦</h2>
              <p className="muted">
                Redeem VIP membutuhkan akun Google. Setelah login, akun akan menjadi identitas
                tetap untuk menyimpan plan dan coin.
              </p>
              <button className="send-button" type="button" onClick={login} disabled={loginLoading}>
                {loginLoading ? 'Membuka Google…' : 'Masuk dengan Google →'}
              </button>
            </>
          ) : (
            <>
              <div className="account-strip">
                <span className="plan-badge plan-vip">GOOGLE</span>
                <span className="coin-badge">{user.displayName || user.email || 'Akun Google'}</span>
              </div>
              <h2>Masukkan VIP key ✎</h2>
              <p className="muted">Key akan langsung diproses dan tidak bisa digunakan lagi setelah berhasil.</p>
              <form onSubmit={handleSubmit}>
                <input
                  className="paper-input"
                  placeholder="VIP-XXXXXXXX"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  disabled={loading}
                  autoComplete="off"
                  required
                />
                <button className="send-button" disabled={loading}>
                  {loading ? 'Memproses…' : 'Redeem sekarang →'}
                </button>
              </form>
            </>
          )}
        </div>
      </section>
    </Layout>
  );
}
