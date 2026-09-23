import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import DataTable from '../../components/admin/DataTable';

export default function AdminLogs() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/logs').then((r) => r.json()).then((d) => { if (d.success) setItems(d.items); setLoading(false); });
  }, []);

  return (
    <AdminLayout title="Logs">
      {loading ? <p>Memuat...</p> : (
        <DataTable
          columns={[
            { key: 'type', label: 'Tipe' },
            { key: 'message', label: 'Pesan' },
            { key: 'meta', label: 'Detail', render: (r) => JSON.stringify(r.meta || {}) },
          ]}
          rows={items}
        />
      )}
    </AdminLayout>
  );
}
