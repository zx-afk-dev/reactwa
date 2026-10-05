import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInAnonymously,
  signInWithRedirect,
  signInWithPopup,
  signOut,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import { getFirebaseAuth } from '../lib/firebaseClient';

const AuthContext = createContext(null);

function readableAuthError(err) {
  const code = err?.code || '';

  const messages = {
    'auth/unauthorized-domain': 'Domain website belum diizinkan di Firebase Authentication.',
    'auth/operation-not-allowed': 'Login Google belum diaktifkan di Firebase Authentication.',
    'auth/popup-blocked': 'Login Google diblokir browser. Coba gunakan browser biasa, bukan browser dalam aplikasi.',
    'auth/popup-closed-by-user': 'Jendela login Google ditutup sebelum selesai.',
    'auth/cancelled-popup-request': 'Permintaan login dibatalkan karena ada popup lain yang sedang berjalan.',
    'auth/network-request-failed': 'Koneksi ke Firebase gagal. Periksa koneksi internet lalu coba lagi.',
    'auth/invalid-api-key': 'Firebase API key tidak valid atau belum dipasang di Vercel.',
    'auth/app/invalid-credential': 'Konfigurasi Firebase Web tidak valid.',
    'auth/credential-already-in-use': 'Akun Google tersebut sudah memiliki akun ReactWA. Login dilanjutkan sebagai akun Google tersebut.',
    'auth/account-exists-with-different-credential': 'Email tersebut sudah terdaftar dengan metode login lain.',
  };

  return messages[code] || err?.message || 'Login Google gagal. Coba lagi.';
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [isVip, setIsVip] = useState(false);

  useEffect(() => {
    let unsubscribe;
    let mounted = true;

    async function initAuth() {
      try {
        const auth = getFirebaseAuth();

        // Keep Google sessions after refresh/reopen. This is also important
        // after the redirect-based Google OAuth flow on mobile.
        await setPersistence(auth, browserLocalPersistence);

        // Handle the Google redirect result first.
        // This replaces popup-based authentication and works better on mobile.
        try {
          const redirectResult = await getRedirectResult(auth);

          if (mounted && redirectResult?.user) {
            setUser(redirectResult.user);
            setError('');
          }
        } catch (err) {
          console.error('google redirect result error:', err);

          if (mounted) {
            // If a redirect is rejected, surface the real Firebase error.
            // Do not start another redirect here: doing so can create a
            // redirect loop on mobile when the Firebase domain is wrong.
            // If linking an anonymous account failed because the Google
            // account already exists, sign in to that existing account.
            setError(readableAuthError(err));
          }
        }

        unsubscribe = onAuthStateChanged(auth, async (current) => {
          if (!mounted) return;

          if (current) {
            setUser(current);
            setReady(true);
            return;
          }

          try {
            await signInAnonymously(auth);
          } catch (err) {
            console.error('anonymous auth error', err);
            if (mounted) {
              setError(readableAuthError(err));
              setReady(true);
            }
          }
        });
      } catch (err) {
        console.error('firebase auth init error', err);
        if (mounted) {
          setError(readableAuthError(err));
          setReady(true);
        }
      }
    }

    initAuth();

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadVipStatus() {
      if (!user || user.isAnonymous) {
        setIsVip(false);
        return;
      }

      try {
        const token = await user.getIdToken();
        const response = await fetch('/api/me', {
          cache: 'no-store',
          headers: { Authorization: 'Bearer ' + token },
        });
        const data = await response.json().catch(() => ({}));

        if (!cancelled) {
          setIsVip(Boolean(data?.data?.plan === 'VIP' || data?.plan === 'VIP'));
        }
      } catch (err) {
        console.error('VIP status check error:', err);
        if (!cancelled) setIsVip(false);
      }
    }

    loadVipStatus();

    return () => {
      cancelled = true;
    };
  }, [user]);

  async function signInGoogle() {
    if (authBusy) return null;

    setError('');
    setAuthBusy(true);

    try {
      const auth = getFirebaseAuth();
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      // Prefer popup so the result is available immediately in the same
      // browser session. If the browser blocks popups, fall back to redirect.
      try {
        const result = await signInWithPopup(auth, provider);
        if (result?.user) {
          setUser(result.user);
          setError('');
        }
        setAuthBusy(false);
        return result?.user || null;
      } catch (err) {
        console.warn('google popup sign-in failed:', err);

        const fallbackCodes = new Set([
          'auth/popup-blocked',
          'auth/popup-timeout',
          'auth/cancelled-popup-request',
          'auth/web-storage-unsupported',
        ]);

        if (!fallbackCodes.has(err?.code)) {
          throw err;
        }

        // Popup is unavailable on this browser; use redirect as fallback.
        await signInWithRedirect(auth, provider);
        return null;
      }
    } catch (err) {
      console.error('google sign-in error:', err);
      setError(readableAuthError(err));
      setAuthBusy(false);
      return null;
    }
  }

  async function logout() {
    if (authBusy) return;

    setAuthBusy(true);
    setError('');

    try {
      const auth = getFirebaseAuth();
      await signOut(auth);
      setUser(null);
      await signInAnonymously(auth);
    } catch (err) {
      console.error('logout error:', err);
      setError(readableAuthError(err));
    } finally {
      setAuthBusy(false);
    }
  }

  async function getIdToken() {
    const current = getFirebaseAuth().currentUser;
    if (!current) return null;
    return current.getIdToken();
  }

  const value = useMemo(() => ({
    user,
    ready,
    error,
    authBusy,
    isGoogleUser: Boolean(user && !user.isAnonymous),
    isVip,
    signInGoogle,
    logout,
    getIdToken,
  }), [user, ready, error, authBusy, isVip]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth harus digunakan di dalam AuthProvider.');
  return context;
}
