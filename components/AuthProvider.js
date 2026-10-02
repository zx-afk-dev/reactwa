import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  linkWithPopup,
  signOut,
} from 'firebase/auth';
import { getFirebaseAuth } from '../lib/firebaseClient';

const AuthContext = createContext(null);

function readableAuthError(err) {
  const code = err?.code || '';

  const messages = {
    'auth/unauthorized-domain': 'Domain website belum diizinkan di Firebase Authentication.',
    'auth/operation-not-allowed': 'Login Google belum diaktifkan di Firebase Authentication.',
    'auth/popup-blocked': 'Popup Google diblokir browser. Izinkan popup untuk website ini lalu coba lagi.',
    'auth/popup-closed-by-user': 'Jendela login Google ditutup sebelum selesai.',
    'auth/cancelled-popup-request': 'Permintaan login dibatalkan karena ada popup lain yang sedang berjalan.',
    'auth/network-request-failed': 'Koneksi ke Firebase gagal. Periksa koneksi internet lalu coba lagi.',
    'auth/invalid-api-key': 'Firebase API key tidak valid atau belum dipasang di Vercel.',
    'auth/app/invalid-credential': 'Konfigurasi Firebase Web tidak valid.',
  };

  return messages[code] || err?.message || 'Login Google gagal. Coba lagi.';
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);

  useEffect(() => {
    let unsubscribe;

    try {
      const auth = getFirebaseAuth();

      unsubscribe = onAuthStateChanged(auth, async (current) => {
        if (current) {
          setUser(current);
          setReady(true);
          return;
        }

        try {
          await signInAnonymously(auth);
        } catch (err) {
          console.error('anonymous auth error', err);
          setError(readableAuthError(err));
          setReady(true);
        }
      });
    } catch (err) {
      console.error('firebase auth init error', err);
      setError(readableAuthError(err));
      setReady(true);
    }

    return () => unsubscribe?.();
  }, []);

  async function signInGoogle() {
    if (authBusy) return null;

    setError('');
    setAuthBusy(true);

    try {
      const auth = getFirebaseAuth();
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      const current = auth.currentUser;

      if (current?.isAnonymous) {
        try {
          const linked = await linkWithPopup(current, provider);
          setUser(linked.user);
          return linked.user;
        } catch (err) {
          // If this Google account already belongs to another Firebase user,
          // sign in normally instead of silently failing.
          if (!['auth/credential-already-in-use', 'auth/provider-already-linked'].includes(err?.code)) {
            throw err;
          }
        }
      }

      const result = await signInWithPopup(auth, provider);
      setUser(result.user);
      return result.user;
    } catch (err) {
      console.error('google sign-in error:', err);
      setError(readableAuthError(err));
      return null;
    } finally {
      setAuthBusy(false);
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
    if (!current || current.isAnonymous) return null;
    return current.getIdToken();
  }

  const value = useMemo(() => ({
    user,
    ready,
    error,
    authBusy,
    isGoogleUser: Boolean(user && !user.isAnonymous),
    signInGoogle,
    logout,
    getIdToken,
  }), [user, ready, error, authBusy]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth harus digunakan di dalam AuthProvider.');
  return context;
}
