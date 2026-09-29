import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <span style={{ fontFamily: 'Caveat, cursive', fontSize: 20, color: 'var(--red)' }}>
          ✎ ReactionWA — personal reaction notebook
        </span>
        <div className="footer-links">
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/status">Status</Link>
          <Link href="/docs">Docs</Link>
        </div>
      </div>
    </footer>
  );
}
