import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';

export default function AdminMaintenance() {
  const [maintenance, setMaintenance] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/admin/maintenance').then((r) => r.json()).then((d) => { if (d.success) setMaintenance(d.maintenance); });
  }, []);

  async function save() {
    setSaving(true);
    await fetch('/api/admin/maintenance', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ maintenance }),
    });
    setSaving(false);
    alert('Maintenance tersimpan.');
  }

  if (!maintenance) return <AdminLayout title="Maintenance"><p>Memuat...</p></AdminLayout>;

  return (
    <AdminLayout title="Maintenance">
      <div className="card admin-form">
        <label className="checkbox-row">
          <input type="checkbox" checked={maintenance.enabled} onChange={(e) => setMaintenance({ ...maintenance, enabled: e.target.checked })} />
          <span>Aktifkan Maintenance</span>
        </label>
        <label className="field-label">Judul</label>
        <input className="input" value={maintenance.title || ''} onChange={(e) => setMaintenance({ ...maintenance, title: e.target.value })} />
        <label className="field-label" style={{ marginTop: 10 }}>Deskripsi</label>
        <textarea className="input" rows={3} value={maintenance.description || ''} onChange={(e) => setMaintenance({ ...maintenance, description: e.target.value })} />
        <label className="field-label" style={{ marginTop: 10 }}>Estimasi Selesai</label>
        <input className="input" value={maintenance.eta || ''} onChange={(e) => setMaintenance({ ...maintenance, eta: e.target.value })} placeholder="mis. 2 jam lagi" />
        <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={save} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</button>
      </div>
    </AdminLayout>
  );
}
