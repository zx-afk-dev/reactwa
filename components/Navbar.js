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
        <Link href="/" className="navbar-logo">⚡ ReactionWA</Link>
        <button className="navbar-toggle" onClick={() => setOpen((v) => !v)} aria-label="Menu">☰</button>
        <nav className={`navbar-links ${open ? 'open' : ''}`}>
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)}>{l.label}</Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
