import Layout from '../components/Layout';
import { useState } from 'react';

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('id-ID');
}

export default function DeveloperDashboard() {
  const [apiKey, setApiKey] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function loadDashboard(e) {
    e.preventDefault();
    if (!apiKey.trim()) {
      setMessage('Masukkan DEV API key.');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const resp = await fetch('/api/v1/dashboard', {
        headers: { 'x-api-key': apiKey.trim(), Accept: 'application/json' },
      });
      const result = await resp.json();
      if (!resp.ok || !result.success) {
        setData(null);
        setMessage(result.message || 'API key tidak valid.');
      } else {
        setData(result);
      }
    } catch {
      setMessage('Gagal terhubung ke server.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout>
      <section className="hero">
        <h1>Developer Dashboard</h1>
        <p>Pantau pemakaian DEV API key dan rate limit tanpa membuka data rahasia key.</p>
      </section>

      <form className="card admin-form" onSubmit={loadDashboard} style={{ maxWidth: 720, margin: '0 auto 20px' }}>
        <label className="field-label">DEV API Key</label>
        <input
          className="input"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="DEV-xxxxxxxxxxxx"
          autoComplete="off"
        />
        <button className="btn btn-primary btn-block" disabled={loading}>
          {loading ? 'Memuat...' : 'Lihat Dashboard'}
        </button>
        {message && <div className="admin-alert" style={{ marginTop: 12 }}>{message}</div>}
      </form>

      {data && (
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div className="admin-stat-grid">
            <div className="stat-card"><span>Key</span><strong>{data.keyId}</strong></div>
            <div className="stat-card"><span>Status</span><strong>{data.status}</strong></div>
            <div className="stat-card"><span>Rate Limit</span><strong>{data.rateLimit.used}/{data.rateLimit.perMinute}</strong></div>
            <div className="stat-card"><span>Remaining</span><strong>{data.rateLimit.remaining}</strong></div>
          </div>

          <div className="card">
            <h2>API Usage</h2>
            <div className="form-grid">
              <div><strong>Total usage</strong><p>{data.usageCount}</p></div>
              <div><strong>Last used</strong><p>{formatDate(data.lastUsedAt)}</p></div>
              <div><strong>Expires</strong><p>{formatDate(data.expiresAt)}</p></div>
              <div><strong>Allowed host</strong><p>{data.allowedHosts.length ? data.allowedHosts.join(', ') : 'Bebas'}</p></div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
