const PATHS = ['/', '/pricing', '/redeem', '/docs', '/status', '/terms', '/privacy'];

function generateSiteMap(baseUrl) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${PATHS.map((p) => `  <url><loc>${baseUrl}${p}</loc></url>`).join('\n')}
</urlset>`;
}

export default function SiteMap() {
  return null;
}

export async function getServerSideProps({ res }) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://your-domain.vercel.app';
  res.setHeader('Content-Type', 'text/xml');
  res.write(generateSiteMap(baseUrl));
  res.end();
  return { props: {} };
}
