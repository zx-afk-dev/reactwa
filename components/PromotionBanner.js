export default function PromotionBanner({ promotions }) {
  if (!promotions || promotions.length === 0) return null;
  return (
    <div className="promo-banner-wrap">
      {promotions.map((p) => (
        <div className="promo-banner" key={p.id}>
          <div>
            <strong>{p.title}</strong>
            {p.description && <span className="promo-desc"> — {p.description}</span>}
          </div>
          {p.url && p.buttonLabel && (
            <a className="promo-btn" href={p.url} target="_blank" rel="noopener noreferrer">{p.buttonLabel}</a>
          )}
        </div>
      ))}
    </div>
  );
}
