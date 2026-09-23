import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';

export default function AdminSettings() {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/admin/settings').then((r) => r.json()).then((d) => { if (d.success) setSettings(d.settings); });
  }, []);

  async function save() {
    setSaving(true);
    await fetch('/api/admin/settings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    alert('Settings tersimpan.');
  }

  if (!settings) return <AdminLayout title="Settings"><p>Memuat...</p></AdminLayout>;

  return (
    <AdminLayout title="Settings">
      <div className="card admin-form">
        <h3>Umum</h3>
        <div className="form-grid">
          <label>Nama Website<input className="input" value={settings.siteName || ''} onChange={(e) => setSettings({ ...settings, siteName: e.target.value })} /></label>
          <label className="full">Deskripsi Website<input className="input" value={settings.siteDescription || ''} onChange={(e) => setSettings({ ...settings, siteDescription: e.target.value })} /></label>
          <label>Nomor WhatsApp Owner<input className="input" value={settings.whatsappOwnerNumber || ''} onChange={(e) => setSettings({ ...settings, whatsappOwnerNumber: e.target.value })} placeholder="628880709243" /></label>
        </div>

        <h3>Coin &amp; Rate Limit</h3>
        <div className="form-grid">
          <label>Coin Free Default<input className="input" type="number" value={settings.freeCoinDefault} onChange={(e) => setSettings({ ...settings, freeCoinDefault: Number(e.target.value) })} /></label>
          <label>Rate Limit Free (req/menit)<input className="input" type="number" value={settings.freeRateLimitPerMinute} onChange={(e) => setSettings({ ...settings, freeRateLimitPerMinute: Number(e.target.value) })} /></label>
          <label>Rate Limit VIP default (req/menit)<input className="input" type="number" value={settings.vipRateLimitPerMinute} onChange={(e) => setSettings({ ...settings, vipRateLimitPerMinute: Number(e.target.value) })} /></label>
          <label>Rate Limit DEV default (req/menit)<input className="input" type="number" value={settings.devRateLimitPerMinute} onChange={(e) => setSettings({ ...settings, devRateLimitPerMinute: Number(e.target.value) })} /></label>
        </div>

        <h3>Terms</h3>
        <div className="form-grid">
          <label>Versi Terms<input className="input" type="number" value={settings.terms?.version || 1} onChange={(e) => setSettings({ ...settings, terms: { ...settings.terms, version: Number(e.target.value) } })} /></label>
        </div>

        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan Settings'}</button>
      </div>
    </AdminLayout>
  );
}
