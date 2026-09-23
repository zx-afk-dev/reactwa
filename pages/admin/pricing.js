import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';

export default function AdminPricing() {
  const [pricing, setPricing] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/admin/pricing').then((r) => r.json()).then((d) => { if (d.success) setPricing(d.pricing); });
  }, []);

  function update(planKey, field, value) {
    setPricing((p) => ({ ...p, [planKey]: { ...p[planKey], [field]: value } }));
  }

  function updateBenefits(planKey, text) {
    update(planKey, 'benefits', text.split('\n').map((s) => s.trim()).filter(Boolean));
  }

  async function save() {
    setSaving(true);
    await fetch('/api/admin/pricing', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pricing }),
    });
    setSaving(false);
    alert('Pricing tersimpan.');
  }

  if (!pricing) return <AdminLayout title="Pricing"><p>Memuat...</p></AdminLayout>;

  return (
    <AdminLayout title="Pricing">
      {['free', 'vip', 'dev'].map((key) => (
        <div className="card admin-form" key={key}>
          <h3>{pricing[key].name || key.toUpperCase()}</h3>
          <div className="form-grid">
            <label>Nama Plan<input className="input" value={pricing[key].name || ''} onChange={(e) => update(key, 'name', e.target.value)} /></label>
            <label>Harga (Rp, 0 = hubungi Owner)<input className="input" type="number" value={pricing[key].price || 0} onChange={(e) => update(key, 'price', Number(e.target.value))} /></label>
            <label>Durasi (hari)<input className="input" type="number" value={pricing[key].durationDays || 0} onChange={(e) => update(key, 'durationDays', Number(e.target.value))} /></label>
            <label>Coin<input className="input" type="number" value={pricing[key].coin || 0} onChange={(e) => update(key, 'coin', Number(e.target.value))} /></label>
            <label>Daily Limit<input className="input" type="number" value={pricing[key].dailyLimit || 0} onChange={(e) => update(key, 'dailyLimit', Number(e.target.value))} /></label>
            <label className="full">Deskripsi<input className="input" value={pricing[key].description || ''} onChange={(e) => update(key, 'description', e.target.value)} /></label>
            <label className="full">Benefit (satu per baris)
              <textarea className="input" rows={4} value={(pricing[key].benefits || []).join('\n')} onChange={(e) => updateBenefits(key, e.target.value)} />
            </label>
          </div>
        </div>
      ))}
      <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan Pricing'}</button>
    </AdminLayout>
  );
}
