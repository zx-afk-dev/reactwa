import { useEffect, useState } from 'react';

const EMPTY = {
  users: 0,
  users_free: 0,
  users_vip: 0,
  users_dev: 0,
  reaction: 0,
  success: 0,
  failed: 0,
};

function formatNumber(value) {
  return new Intl.NumberFormat('id-ID').format(Number(value || 0));
}

export default function GlobalStats() {
  const [stats, setStats] = useState(EMPTY);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await fetch('/api/stats');
        const data = await response.json();
        if (active && data.success) setStats({ ...EMPTY, ...data.stats });
      } catch {}
    }

    load();
    const timer = setInterval(load, 30000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const cards = [
    ['USERS', stats.users, 'total pengguna'],
    ['FREE', stats.users_free, 'pengguna Free'],
    ['VIP', stats.users_vip, 'pengguna VIP'],
    ['DEV', stats.users_dev, 'pengguna Dev'],
    ['REACTIONS', stats.reaction, 'total reaction'],
  ];

  return (
    <section className="global-stats">
      <div className="stats-heading">
        <div className="scribble">live archive / numbers</div>
        <h2>Numbers from the notebook</h2>
        <p className="muted">Statistik aplikasi yang tersimpan di Firestore.</p>
      </div>

      <div className="stats-grid">
        {cards.map(([label, value, note], index) => (
          <article className={`stat-note stat-${index % 3}`} key={label}>
            <span className="stat-label">{label}</span>
            <strong>{formatNumber(value)}</strong>
            <small>{note}</small>
          </article>
        ))}
      </div>
    </section>
  );
}
