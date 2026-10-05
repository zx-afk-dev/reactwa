import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from './AuthProvider';

const MENU = [
  { href: '/', label: 'Notebook', icon: '⌂' },
  { href: '/redeem', label: 'Redeem Coin / VIP', icon: '◆' },
  { href: '/referral', label: 'Undang Teman', icon: '↗' },
  { href: '/docs', label: 'Docs', icon: '✎' },
  { href: '/reactions', label: 'VIP History', icon: '♾️' },
  { href: '/vip', label: 'VIP Dashboard', icon: '💎' },
  { href: '/vip/api-keys', label: 'VIP API Keys', icon: '🔑' },
  { href: '/vip/api-analytics', label: 'API Analytics', icon: '📊' },
  { href: '/changelog', label: 'Changelog', icon: '⌁' },
];

export default function Navbar() {
  const { user, ready, isGoogleUser, signInGoogle, logout, error, authBusy } = useAuth();
  const [open, setOpen] = useState(false);

  async function handleAuth() {
    if (authBusy) return;
    if (isGoogleUser) await logout();
    else await signInGoogle();
  }

  return (
    <header className="navbar">
      <Link href="/" className="brand" aria-label="ReactionWA home" onClick={() => setOpen(false)}>
        <span className="brand-pin" aria-hidden="true" />
        <span className="brand-mark">rw</span>
        <span><strong>ReactionWA</strong><small>personal reaction archive</small></span>
      </Link>

      <button
        type="button"
        className={`nav-hamburger ${open ? 'open' : ''}`}
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? 'Tutup menu' : 'Buka menu'}
        aria-expanded={open}
      >
        <span />
        <span />
        <span />
      </button>

      <div className={`nav-drawer ${open ? 'open' : ''}`}>
        <nav className="nav-links" aria-label="Main navigation">
          {MENU.map((item) => (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
              <span aria-hidden="true">{item.icon}</span>{item.label}
            </Link>
          ))}
        </nav>

        <div className="nav-account">
          {ready && isGoogleUser && user ? (
            <>
              <span className="nav-user">
                {user.photoURL ? <img src={user.photoURL} alt="" /> : <span className="nav-user-dot" />}
                <span>{user.displayName || user.email || 'Google account'}</span>
              </span>
              <button type="button" className="nav-auth-button" onClick={handleAuth} disabled={authBusy}>
                {authBusy ? 'Keluar…' : 'Keluar'}
              </button>
            </>
          ) : (
            <button type="button" className="nav-auth-button google" onClick={handleAuth} disabled={!ready || authBusy} aria-busy={authBusy}>
              {authBusy ? 'Membuka Google…' : ready ? 'Masuk Dengan Google' : 'Menyiapkan…'}
            </button>
          )}
          {error && <span className="nav-auth-error" role="alert">{error}</span>}
        </div>
      </div>
    </header>
  );
}
