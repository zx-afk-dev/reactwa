import Link from 'next/link';
import { useState } from 'react';

const LINKS = [
  { href: '/', label: 'Reaction' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/docs', label: 'Docs' },
  { href: '/status', label: 'Status' },
  { href: '/redeem', label: 'Redeem' },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link href="/" className="navbar-logo" aria-label="ReactionWA home">
          ReactionWA
        </Link>

        <button
          className="navbar-toggle"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Tutup menu' : 'Buka menu'}
          aria-expanded={open}
        >
          {open ? '×' : '☰'}
        </button>

        <nav className={`navbar-links ${open ? 'open' : ''}`} aria-label="Navigasi utama">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)}>
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
