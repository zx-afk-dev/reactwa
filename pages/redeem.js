import { useState } from 'react';
import Layout from '../components/Layout';
import Toast from '../components/Toast';

export default function Redeem() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    try {
      const resp = await fetch('/api/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await resp.json();
      if (data.success) {
        setToast({ type: 'success', text: data.message });
        setCode('');
      } else {
        setToast({ type: 'error', text: data.message });
      }
    } catch {
      setToast({ type: 'error', text: 'Gagal terhubung ke server.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout title="Redeem" description="Tukarkan kode redeem untuk mendapatkan coin tambahan.">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <section className="page-header">
        <h1>Redeem Code</h1>
        <p>Tukarkan kode dari Owner untuk mendapatkan coin tambahan, atau upgrade ke plan VIP/DEV.</p>
      </section>
      <form className="card redeem-card" onSubmit={handleSubmit}>
        <input
          className="input"
          placeholder="RDM-XXXXXXXX / VIP-XXXXXXXX / DEV-XXXXXXXX"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          disabled={loading}
        />
        <button className="btn btn-primary btn-block" disabled={loading}>
          {loading ? 'Memproses...' : 'Redeem Sekarang'}
        </button>
      </form>
    </Layout>
  );
}
