import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';

export default function AdminDatabase() {
  const [collections, setCollections] = useState([]);
  const [selected, setSelected] = useState('logs');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState('');

  async function load() {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/database', { cache: 'no-store' });
      const data = await r.json();
      if (!r.ok || !data.success) throw new Error(data.message || 'Gagal membaca database.');
      setCollections(data.collections || []);
    } catch (err) {
      setNotice(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function clean(e) {
    e.preventDefault();
    setWorking(true);
    setNotice('');
    try {
      const r = await fetch('/api/admin/database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection: selected, confirm, limit: 250 }),
      });
      const data = await r.json();
      if (!r.ok || !data.success) throw new Error(data.message || 'Cleanup gagal.');
      setNotice(data.message);
      setConfirm('');
      await load();
    } catch (err) {
      setNotice(err.message);
    } finally {
      setWorking(false);
    }
  }

  const current = collections.find((x) => x.name === selected);

  return (
    <AdminLayout title="Database Cleanup">
      <section className="admin-page-head">
        <div>
          <div className="admin-scribble">firebase / cleanup desk</div>
          <h2>Database cleanup</h2>
          <p>Hapus data Firestore secara bertahap. Hanya collection yang ditentukan aplikasi yang bisa disentuh.</p>
        </div>
        <button className="admin-refresh" onClick={load}>↻ Refresh</button>
      </section>

      <div className="admin-note-row">
        <article className="admin-note yellow">
          <b>⚠ User data</b><br />
          Menghapus <code>users</code> hanya menghapus profil Firestore, bukan akun Firebase Authentication.
        </article>
        <article className="admin-note blue">
          <b>✦ Batch kecil</b><br />
          Cleanup dibatasi 250 dokumen per klik agar operasi tidak menjadi satu penghapusan besar.
        </article>
        <article className="admin-note red">
          <b>! Tidak bisa undo</b><br />
          Data yang sudah dihapus tidak dipulihkan oleh halaman ini. Pastikan collection dan konfirmasi benar.
        </article>
      </div>

      {notice && <div className="admin-maintenance-message" style={{ marginTop: 22 }}>{notice}</div>}

      <section className="admin-panel" style={{ marginTop: 22 }}>
        <div className="admin-panel-head">
          <div><span className="admin-scribble">collection archive</span><h3>Firestore collections</h3></div>
        </div>

        {loading ? <div className="admin-skeleton">Menghitung dokumen…</div> : (
          <div className="database-collection-grid">
            {collections.map((item) => (
              <button
                type="button"
                key={item.name}
                className={`database-collection ${selected === item.name ? 'selected' : ''}`}
                onClick={() => { setSelected(item.name); setConfirm(''); }}
              >
                <strong>{item.name}</strong>
                <span>{item.error ? 'error' : `${item.count}${item.capped ? '+' : ''} docs`}</span>
              </button>
            ))}
          </div>
        )}

        <form className="database-danger-form" onSubmit={clean}>
          <div>
            <span className="admin-scribble">selected collection</span>
            <h3>{selected}</h3>
            <p>Batch berikutnya: maksimal 250 dokumen. {current?.capped ? 'Jumlah yang tampil adalah minimal karena dibatasi pembacaan.' : ''}</p>
          </div>
          <label>
            Konfirmasi
            <input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={`DELETE ${selected}`}
              autoComplete="off"
            />
          </label>
          <button className="admin-save database-danger-button" disabled={working || confirm !== `DELETE ${selected}`}>
            {working ? 'Membersihkan…' : 'Hapus batch data →'}
          </button>
        </form>
      </section>
    </AdminLayout>
  );
}
