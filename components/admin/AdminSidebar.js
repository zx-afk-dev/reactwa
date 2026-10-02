import Link from 'next/link';
import { useRouter } from 'next/router';

const ITEMS = [
  { href: '/admin', label: 'Overview', icon: '⌂' },
  { href: '/admin/users', label: 'Users', icon: '♙' },
  { href: '/admin/logs', label: 'Logs', icon: '✎' },
  { href: '/admin/maintenance', label: 'Maintenance', icon: '⚙' },
];

export default function AdminSidebar({ open, onClose }) {
  const router = useRouter();

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.replace('/admin/login');
  }

  return (
    <>
      <aside className={`admin-sidebar-new ${open ? 'open' : ''}`}>
        <div className="admin-brand">
          <div className="admin-brand-mark">R</div>
          <div><strong>ReactionWA</strong><span>admin notebook</span></div>
          <button className="admin-sidebar-close" onClick={onClose}>×</button>
        </div>

        <div className="admin-nav-label">Workspace</div>
        <nav>
          {ITEMS.map((item) => (
            <Link key={item.href} href={item.href}
              className={router.pathname === item.href ? 'active' : ''} onClick={onClose}>
              <span>{item.icon}</span>{item.label}
            </Link>
          ))}
        </nav>

        <div className="admin-sidebar-note">
          <span>NOTE</span>
          Direct reaction flow is active. No global queue.
        </div>

        <button className="admin-logout-new" onClick={logout}>↪ Sign out</button>
      </aside>
      {open && <div className="admin-overlay" onClick={onClose} />}
    </>
  );
}
