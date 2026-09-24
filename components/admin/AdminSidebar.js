import Link from 'next/link';
import { useRouter } from 'next/router';

const ITEMS = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/dev', label: 'DEV Keys (API)' },
  { href: '/admin/redeem', label: 'Redeem Codes' },
  { href: '/admin/pricing', label: 'Pricing' },
  { href: '/admin/promotions', label: 'Promotions' },
  { href: '/admin/queue', label: 'Queue' },
  { href: '/admin/statistics', label: 'Statistics' },
  { href: '/admin/maintenance', label: 'Maintenance' },
  { href: '/admin/settings', label: 'Settings' },
  { href: '/admin/logs', label: 'Logs' },
];

export default function AdminSidebar({ open, onClose }) {
  const router = useRouter();

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.replace('/admin/login');
  }

  return (
    <>
      <aside className={`admin-sidebar ${open ? 'open' : ''}`}>
        <div className="admin-sidebar-header">
          <span>⚡ ReactionWA Admin</span>
          <button className="admin-sidebar-close" onClick={onClose}>✕</button>
        </div>
        <nav>
          {ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className={router.pathname === item.href ? 'active' : ''} onClick={onClose}>
              {item.label}
            </Link>
          ))}
          <button className="admin-logout-btn" onClick={logout}>Logout</button>
        </nav>
      </aside>
      {open && <div className="admin-overlay" onClick={onClose} />}
    </>
  );
}
