import { useState } from 'react';
import { useRouter } from 'next/router';

export default function AdminLogin() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const resp = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) throw new Error(data.message || 'Login gagal.');
      router.replace('/admin');
    } catch (e) {
      setError(e.message || 'Gagal terhubung ke server.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="admin-login-new">
      <div className="admin-login-paper">
        <div className="admin-login-tape" />
        <div className="admin-brand-mark big">R</div>
        <div className="admin-scribble">private workspace</div>
        <h1>Admin notebook</h1>
        <p>Masuk untuk mengelola user, coin, dan statistik ReactionWA.</p>
        {error && <div className="admin-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <label>Username<input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus /></label>
          <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></label>
          <button disabled={loading}>{loading ? 'Opening notebook...' : 'Masuk ke Admin →'}</button>
        </form>
        <span className="admin-login-foot">ReactionWA / private area</span>
      </div>
    </main>
  );
}
