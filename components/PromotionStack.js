import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';

const MAX_VISIBLE = 3;

function storageKey() {
  return 'reactwa_closed_promotions';
}

export default function PromotionStack() {
  const router = useRouter();
  const [ads, setAds] = useState([]);
  const [closed, setClosed] = useState([]);
  const [ready, setReady] = useState(false);

  const placement = useMemo(() => {
    const path = router.pathname || '/';
    if (path.startsWith('/admin')) return null;
    if (path === '/redeem') return 'redeem';
    if (path === '/') return 'home';
    return 'react';
  }, [router.pathname]);

  useEffect(() => {
    if (!placement) return;
    try {
      setClosed(JSON.parse(sessionStorage.getItem(storageKey()) || '[]'));
    } catch {}
  }, [placement]);

  useEffect(() => {
    if (!placement) return;
    let alive = true;
    setReady(false);
    fetch(`/api/promotions?placement=${encodeURIComponent(placement)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setAds(Array.isArray(d.promotions) ? d.promotions : []);
        setReady(true);
      })
      .catch(() => alive && setReady(true));
    return () => { alive = false; };
  }, [placement]);

  const visible = useMemo(() => {
    const available = ads.filter((ad) => !closed.includes(ad.id));
    return available.slice(0, MAX_VISIBLE);
  }, [ads, closed]);

  useEffect(() => {
    if (!visible.length) return;
    visible.forEach((ad) => {
      const key = `reactwa_promo_impression_${ad.id}`;
      try {
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, '1');
      } catch {}
      fetch('/api/promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ad.id, stat: 'impression' }),
      }).catch(() => {});
    });
  }, [visible]);

  function closeAd(id) {
    setClosed((current) => {
      const next = current.includes(id) ? current : [...current, id];
      try { sessionStorage.setItem(storageKey(), JSON.stringify(next)); } catch {}
      return next;
    });
  }

  function clickAd(ad) {
    fetch('/api/promotions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: ad.id, stat: 'click' }),
    }).catch(() => {});
  }

  if (!placement || !ready || !visible.length) return null;

  return (
    <div className="promotion-stack" aria-label="Promosi">
      {visible.map((ad) => (
        <article className="promotion-card" key={ad.id}>
          <button className="promotion-close" onClick={() => closeAd(ad.id)} aria-label="Tutup iklan">×</button>
          {ad.imageUrl && ad.targetUrl ? (
            <a href={ad.targetUrl} target="_blank" rel="noopener noreferrer" onClick={() => clickAd(ad)}>
              <img src={ad.imageUrl} alt={ad.title} />
            </a>
          ) : ad.imageUrl ? (
            <img src={ad.imageUrl} alt={ad.title} />
          ) : null}
          <div className="promotion-copy">
            <span className="promotion-label">PROMO</span>
            <strong>{ad.title}</strong>
            {ad.description && <p>{ad.description}</p>}
            {ad.targetUrl && !ad.imageUrl && (
              <a href={ad.targetUrl} target="_blank" rel="noopener noreferrer" onClick={() => clickAd(ad)}>Kunjungi →</a>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
