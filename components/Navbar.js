import Link from 'next/link';

export default function Navbar() {
  return (
    <header className="navbar">
      <Link href="/" className="brand" aria-label="ReactionWA home">
        <span className="brand-pin" aria-hidden="true" />
        <span className="brand-mark">rw</span>
        <span><strong>ReactionWA</strong><small>personal reaction archive</small></span>
      </Link>
      <nav className="nav-links" aria-label="Main navigation">
        <Link href="/">Notebook</Link>
        <Link href="/docs">Docs</Link>
        <Link href="/changelog">Changelog</Link>
      </nav>
    </header>
  );
}
