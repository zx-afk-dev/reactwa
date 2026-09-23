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
      if (data.success) {
        router.replace('/admin');
      } else {
        setError(data.message || 'Login gagal.');
      }
    } catch {
      setError('Gagal terhubung ke server.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-login-wrap">
      <form className="card admin-login-card" onSubmit={handleSubmit}>
        <h1>⚡ Admin Login</h1>
        {error && <div className="form-error">{error}</div>}
        <label className="field-label">Username</label>
        <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
        <label className="field-label" style={{ marginTop: 10 }}>Password</label>
        <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="btn btn-primary btn-block" disabled={loading}>{loading ? 'Memproses...' : 'Login'}</button>
      </form>
    </div>
  );
}
