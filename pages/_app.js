import '../styles/globals.css';
import { Analytics } from '@vercel/analytics/react';
import { AuthProvider } from '../components/AuthProvider';
import ReferralBootstrap from '../components/ReferralBootstrap';

export default function App({ Component, pageProps }) {
  return (
    <AuthProvider>
      <ReferralBootstrap />
      <Component {...pageProps} />
      <Analytics />
    </AuthProvider>
  );
}
