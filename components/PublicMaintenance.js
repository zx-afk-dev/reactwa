import { useEffect, useState } from 'react';

export default function PublicMaintenance() {
  const [info, setInfo] = useState({
    title: 'Sedang dalam pemeliharaan',
    description: 'Layanan sedang diperbaiki. Silakan coba lagi nanti.',
    eta: '',
  });

  useEffect(() => {
    let active = true;

    fetch('/api/maintenance', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => {
        if (!active || !data?.success || !data.maintenance) return;
        setInfo({
          title: data.maintenance.title || 'Sedang dalam pemeliharaan',
          description: data.maintenance.description || 'Layanan sedang diperbaiki. Silakan coba lagi nanti.',
          eta: data.maintenance.eta || '',
        });
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="maintenance-screen">
      <div className="maintenance-paper">
        <span className="maintenance-tape" aria-hidden="true" />
        <span className="maintenance-pin" aria-hidden="true" />

        <div className="maintenance-mark" aria-hidden="true">Z</div>
        <div className="scribble">SERVICE NOTE / 503</div>
        <h1>{info.title}</h1>
        <p className="maintenance-description">{info.description}</p>

        {info.eta && (
          <div className="maintenance-eta">
            <span>ESTIMASI</span>
            <b>{info.eta}</b>
          </div>
        )}

        <div className="maintenance-line" />

        <div className="maintenance-footer">
          <span>ReactionWA</span>
          <span>please come back later ↗</span>
        </div>
      </div>
    </main>
  );
}
