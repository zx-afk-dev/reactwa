import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import AdminSidebar from './AdminSidebar';

export default function AdminLayout({ children, title, eyebrow = 'CONTROL ROOM' }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [admin, setAdmin] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch('/api/admin/me')
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          router.replace('/admin/login');
          return;
        }
        if (alive) {
          setAdmin(data);
          setReady(true);
        }
      })
      .catch(() => router.replace('/admin/login'));
    return () => { alive = false; };
  }, [router]);

  if (!ready) {
    return <div className="admin-loading"><div className="admin-loading-paper">Opening admin notebook<span>...</span></div></div>;
  }

  return (
    <div className="admin-shell">
      <AdminSidebar open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <main className="admin-main">
        <header className="admin-topbar">
          <button className="admin-menu-btn" onClick={() => setDrawerOpen(true)} aria-label="Open menu">☰</button>
          <div>
            <div className="admin-eyebrow">{eyebrow}</div>
            <h1>{title}</h1>
          </div>
          <div className="admin-user-chip">✦ {admin?.username || 'admin'}</div>
        </header>
        <div className="admin-body">{children}</div>
      </main>
    </div>
  );
}
