import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from './AuthProvider';

export default function Navbar() {
  const router = useRouter();
  const { user, ready, isGoogleUser, signInGoogle, logout, error } = useAuth();

  async function handleAuth() {
    try {
      if (isGoogleUser) await logout();
      else await signInGoogle();
    } catch {}
  }

  return (
    <header className="navbar">
      <Link href="/" className="brand" aria-label="ReactionWA home">
        <span className="brand-pin" aria-hidden="true" />
        <span className="brand-mark">rw</span>
        <span><strong>ReactionWA</strong><small>personal reaction archive</small></span>
      </Link>

      <nav className="nav-links" aria-label="Main navigation">
        <Link href="/">Notebook</Link>
        <Link href="/redeem">Redeem</Link>
        <Link href="/docs">Docs</Link>
        <Link href="/changelog">Changelog</Link>
      </nav>

      <div className="nav-account">
        {ready && isGoogleUser && user ? (
          <>
            <span className="nav-user">
              {user.photoURL ? <img src={user.photoURL} alt="" /> : <span className="nav-user-dot" />}
              <span>{user.displayName || user.email || 'Google account'}</span>
            </span>
            <button type="button" className="nav-auth-button" onClick={handleAuth}>Keluar</button>
          </>
        ) : (
          <button type="button" className="nav-auth-button google" onClick={handleAuth} disabled={!ready}>
            {ready ? 'Masuk Google' : 'Menyiapkan…'}
          </button>
        )}
        {error && <span className="nav-auth-error" title={error}>!</span>}
      </div>
    </header>
  );
}
