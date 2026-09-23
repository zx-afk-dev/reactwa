import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import PricingCard from '../components/PricingCard';

export default function Pricing() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/settings/public').then((r) => r.json()).then((d) => { if (d.success) setData(d); });
  }, []);

  if (!data) return <Layout title="Pricing"><p className="loading-text">Memuat...</p></Layout>;

  return (
    <Layout title="Pricing" description="Pilihan plan Free, VIP, dan Dev untuk ReactionWA.">
      <section className="page-header">
        <h1>Pricing</h1>
        <p>Pilih plan yang sesuai dengan kebutuhanmu.</p>
      </section>
      <div className="pricing-grid">
        <PricingCard planKey="free" plan={data.pricing.free} ownerNumber={data.whatsappOwnerNumber} />
        <PricingCard planKey="vip" plan={data.pricing.vip} ownerNumber={data.whatsappOwnerNumber} />
        <PricingCard planKey="dev" plan={data.pricing.dev} ownerNumber={data.whatsappOwnerNumber} />
      </div>
      <div className="card contact-owner-card">
        <p>Punya pertanyaan lain?</p>
        <a
          className="btn btn-secondary"
          target="_blank" rel="noopener noreferrer"
          href={`https://wa.me/${data.whatsappOwnerNumber}?text=${encodeURIComponent('Halo Owner, saya ingin bertanya tentang ReactionWA.')}`}
        >
          Chat Owner
        </a>
      </div>
    </Layout>
  );
}
