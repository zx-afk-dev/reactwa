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

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

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
          setReady(true);
        }
      });
    } catch (err) {
      console.error('firebase auth init error', err);
      setError('Firebase Authentication belum dikonfigurasi.');
      setReady(true);
    }

    return () => unsubscribe?.();
  }, []);

  async function signInGoogle() {
    setError('');
    const auth = getFirebaseAuth();
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
      const current = auth.currentUser;
      if (current?.isAnonymous) {
        try {
          const linked = await linkWithPopup(current, provider);
          setUser(linked.user);
          return linked.user;
        } catch (err) {
          if (!['auth/credential-already-in-use', 'auth/provider-already-linked'].includes(err?.code)) {
            throw err;
          }
        }
      }

      const result = await signInWithPopup(auth, provider);
      setUser(result.user);
      return result.user;
    } catch (err) {
      console.error('google sign-in error', err);
      setError(
        err?.code === 'auth/popup-closed-by-user'
          ? 'Login dibatalkan.'
          : 'Login Google gagal. Coba lagi.'
      );
      throw err;
    }
  }

  async function logout() {
    try {
      await signOut(getFirebaseAuth());
      setUser(null);
      await signInAnonymously(getFirebaseAuth());
    } catch (err) {
      console.error('logout error', err);
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
    isGoogleUser: Boolean(user && !user.isAnonymous),
    signInGoogle,
    logout,
    getIdToken,
  }), [user, ready, error]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth harus digunakan di dalam AuthProvider.');
  return context;
}
