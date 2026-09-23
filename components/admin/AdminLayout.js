import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import AdminSidebar from './AdminSidebar';

export default function AdminLayout({ children, title }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    fetch('/api/admin/me').then((r) => {
      if (r.status === 401) {
        router.replace('/admin/login');
      } else {
        setReady(true);
      }
    }).catch(() => router.replace('/admin/login'));
  }, [router]);

  if (!ready) return <div className="admin-loading">Memuat...</div>;

  return (
    <div className="admin-shell">
      <AdminSidebar open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <div className="admin-content">
        <div className="admin-topbar">
          <button className="admin-menu-btn" onClick={() => setDrawerOpen(true)}>☰</button>
          <h1>{title}</h1>
        </div>
        <div className="admin-body">{children}</div>
      </div>
    </div>
  );
    }
  
