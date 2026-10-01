import Head from 'next/head';
import Navbar from './Navbar';
import Footer from './Footer';

export default function Layout({ children, title = 'ReactionWA — Digital Reaction Notebook' }) {
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content="A playful digital scrapbook for sending WhatsApp channel reactions." />
        <meta name="theme-color" content="#f4ead7" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="paper-shell">
        <div className="paper-margin" aria-hidden="true" />
        <Navbar />
        <main className="site-main">{children}</main>
        <Footer />
      </div>
    </>
  );
}
