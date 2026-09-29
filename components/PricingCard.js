export default function PricingCard({ planKey, plan, ownerNumber }) {
  const waText = encodeURIComponent(
    planKey === 'vip' ? 'Halo Owner, saya ingin membeli plan VIP.' :
    planKey === 'dev' ? 'Halo Owner, saya ingin membeli plan Dev.' :
    'Halo Owner, saya ingin bertanya tentang layanan ReactionWA.'
  );

  const labels = { free: 'FREE NOTE', vip: 'VIP NOTE', dev: 'DEV NOTE' };

  return (
    <div className={`card pricing-card ${planKey === 'vip' ? 'pricing-highlight' : ''}`}>
      <div className="paper-label" style={{ color: 'var(--blue)', fontSize: 17, marginBottom: 2 }}>
        ✦ {labels[planKey] || 'NOTE'}
      </div>
      <h3>{plan.name}</h3>
      <p className="pricing-desc">{plan.description}</p>
      <ul className="benefit-list">
        {(plan.benefits || []).map((b, i) => <li key={i}>✎ {b}</li>)}
      </ul>
      {planKey === 'free' ? (
        <div className="pricing-cta-note">Gratis — langsung digunakan di halaman utama.</div>
      ) : (
        <a
          className="btn btn-primary btn-block"
          href={`https://wa.me/${ownerNumber}?text=${waText}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Tulis ke Owner →
        </a>
      )}
    </div>
  );
}
