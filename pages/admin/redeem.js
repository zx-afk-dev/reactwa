import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import DataTable from '../../components/admin/DataTable';

const emptyForm = { type: 'coin', coin: 10, durationDays: 30, expiresAt: '' };

export default function AdminRedeem() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState('');

  async function load() {
    setLoading(true);
    try {
      const resp = await fetch('/api/admin/redeem-codes');
      const data = await resp.json();
      if (data.success) setItems(data.items || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function create(e) {
    e.preventDefault();
    setCreating(true);
    setNotice('');

    try {
      const resp = await fetch('/api/admin/redeem-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await resp.json();

      if (!resp.ok || !data.success) {
        setNotice(data.message || 'Gagal membuat VIP key.');
        return;
      }

      setNotice(`${data.type === 'coin' ? 'Coin code' : 'VIP key'} berhasil dibuat: ${data.id}`);
      setForm(emptyForm);
      await load();
    } catch {
      setNotice('Gagal terhubung ke server.');
    } finally {
      setCreating(false);
    }
  }

  async function toggleStatus(item) {
    await fetch(`/api/admin/redeem-codes/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: item.status === 'active' ? 'disabled' : 'active',
      }),
    });
    load();
  }

  async function remove(id) {
    if (!confirm('Hapus redeem code ini?')) return;
    await fetch(`/api/admin/redeem-codes/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <AdminLayout title="Redeem Codes">
      <section className="admin-page-head">
        <div>
          <div className="admin-scribble">redeem / code generator</div>
          <h2>Redeem codes</h2>
          <p>Buat kode coin bonus atau VIP. Semua kode dibuat server-side dan single-use.</p>
        </div>
        <button className="admin-refresh" onClick={load}>↻ Refresh</button>
      </section>

      <form className="admin-panel admin-form" onSubmit={create}>
        <div className="admin-panel-head">
          <div><span className="admin-scribble">new key</span><h3>Buat redeem code</h3></div>
          <span className="admin-status ok">SINGLE USE</span>
        </div>

        <div className="form-grid">
          <label>Jenis kode
            <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="coin">Coin bonus</option>
              <option value="vip">VIP + Coin</option>
            </select>
          </label>
          <label>Bonus coin
            <input className="input" type="number" min="0" max="1000000000" value={form.coin}
              onChange={(e) => setForm({ ...form, coin: Number(e.target.value) })} />
          </label>
          <label>Durasi VIP (hari)
            <input className="input" type="number" min="1" max="3650" value={form.durationDays} disabled={form.type !== "vip"}
              onChange={(e) => setForm({ ...form, durationDays: Number(e.target.value) })} />
          </label>
          <label>Expiry key (opsional)
            <input className="input" type="date" value={form.expiresAt}
              onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
          </label>
        </div>

        <p className="admin-help-note">
          Key yang berhasil diredeem akan otomatis berstatus <b>used</b> dan tidak dapat digunakan lagi.
        </p>

        <button className="admin-save" disabled={creating}>
          {creating ? 'Membuat code…' : 'Buat Redeem Code →'}
        </button>

        {notice && <div className="admin-maintenance-message">{notice}</div>}
      </form>

      <section style={{ marginTop: 24 }}>
        {loading ? <div className="admin-skeleton">Membaca daftar VIP key…</div> : (
          <DataTable
            columns={[
              { key: 'id', label: 'Code' },
              { key: 'type', label: 'Type', render: (r) => r.type === 'coin' ? 'COIN' : 'VIP' },
              { key: 'coin', label: 'Coin', render: (r) => `+${Number(r.coin || 0)}` },
              { key: 'durationDays', label: 'Durasi', render: (r) => `${r.durationDays || 30} hari` },
              { key: 'usedCount', label: 'Usage', render: (r) => `${r.usedCount || 0}/1` },
              { key: 'status', label: 'Status' },
            ]}
            rows={items}
            renderActions={(r) => (
              <div className="row-actions">
                {r.status !== 'used' && (
                  <button className="btn-xs" onClick={() => toggleStatus(r)}>
                    {r.status === 'active' ? 'Disable' : 'Enable'}
                  </button>
                )}
                <button className="btn-xs btn-danger" onClick={() => remove(r.id)}>Hapus</button>
              </div>
            )}
          />
        )}
      </section>
    </AdminLayout>
  );
}
