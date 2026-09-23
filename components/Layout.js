import { useEffect, useState } from 'react';
import Head from 'next/head';
import Navbar from './Navbar';
import Footer from './Footer';
import PromotionBanner from './PromotionBanner';

export default function Layout({ children, title, description }) {
  const [siteSettings, setSiteSettings] = useState(null);

  useEffect(() => {
    fetch('/api/settings/public')
      .then((r) => r.json())
      .then((d) => { if (d.success) setSiteSettings(d); })
      .catch(() => {});
  }, []);

  const pageTitle = title ? `${title} · ReactionWA` : 'ReactionWA — Reaction Saluran WhatsApp';
  const pageDesc = description || 'Layanan untuk membantu pengguna memberikan reaction pada postingan Saluran WhatsApp dengan cepat dan mudah.';

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDesc} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDesc} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDesc} />
      </Head>
      <Navbar />
      {siteSettings?.maintenance?.enabled && (
        <div className="maintenance-banner">
          🛠️ {siteSettings.maintenance.title || 'Sedang Maintenance'}: {siteSettings.maintenance.description}
          {siteSettings.maintenance.eta ? ` (Estimasi selesai: ${siteSettings.maintenance.eta})` : ''}
        </div>
      )}
      {siteSettings?.promotions?.length > 0 && <PromotionBanner promotions={siteSettings.promotions} />}
      <main className="main-container">{children}</main>
      <Footer />
    </>
  );
}
