import { db, FieldValue } from './firebaseAdmin';
import { getSettings } from './settings';
import { recordRedeem } from './stats';

// Atomically validates, consumes, and applies a redeem code. This keeps the
// code usage counter, redeem history, plan upgrade, and coin bonus in the
// same Firestore transaction so a successful redeem can never consume the
// code while leaving its bonus unapplied.
export async function redeemCode(code, identifier) {
  const codeRef = db.collection('redeemCodes').doc(code);
  const historyRef = db.collection('redeemHistory').doc(`${code}__${identifier}`);
  const userRef = db.collection('users').doc(identifier);
  const settings = await getSettings();

  const result = await db.runTransaction(async (tx) => {
    const [codeSnap, historySnap, userSnap] = await Promise.all([
      tx.get(codeRef),
      tx.get(historyRef),
      tx.get(userRef),
    ]);

    if (!codeSnap.exists) return { ok: false, reason: 'INVALID' };

    const data = codeSnap.data();
    if (data.status !== 'active') return { ok: false, reason: 'INVALID' };

    if (data.expiresAt) {
      const exp = data.expiresAt.toMillis ? data.expiresAt.toMillis() : new Date(data.expiresAt).getTime();
      if (!Number.isNaN(exp) && Date.now() > exp) return { ok: false, reason: 'EXPIRED' };
    }
    if (historySnap.exists) return { ok: false, reason: 'USED' };

    const rawType = data.type === 'dev' ? 'vip' : data.type;
    const type = rawType === 'vip' ? 'vip' : 'coin';
    const maxUses = type === 'vip' ? 1 : Math.max(0, Number(data.maxUses) || 0);
    const usedCount = Math.max(0, Number(data.usedCount) || 0);
    if (usedCount >= maxUses) return { ok: false, reason: 'USED' };
    const bonusCoin = Math.max(0, Number(data.coin) || 0);

    tx.set(historyRef, {
      code,
      identifier,
      type,
      coin: bonusCoin,
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.update(codeRef, {
      usedCount: FieldValue.increment(1),
      ...(type === 'vip' ? { status: 'used' } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const currentCoin = userSnap.exists
      ? Math.max(0, Number(userSnap.data().coin) || 0)
      : 0;

    if (type === 'vip') {
      const plan = 'VIP';
      const durationDays = Math.max(1, Number(data.durationDays) || 30);
      const planExpiresAt = Date.now() + durationDays * 24 * 60 * 60 * 1000;

      tx.set(userRef, {
        identifier,
        plan,
        planExpiresAt,
        ...(bonusCoin > 0 ? { coin: currentCoin + bonusCoin } : {}),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      return { ok: true, type, plan, durationDays, coin: bonusCoin };
    }

    tx.set(userRef, {
      identifier,
      coin: currentCoin + bonusCoin,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return { ok: true, type: 'coin', coin: bonusCoin };
  });

  if (result.ok) {
    try {
      await recordRedeem();
    } catch (err) {
      // Analytics must never turn an already-committed redeem into a 500.
      console.error('Failed to record redeem stat', err);
    }
  }

  return result;
}
