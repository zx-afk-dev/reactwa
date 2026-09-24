import { db, FieldValue } from './firebaseAdmin';
import { adjustCoin } from './coin';
import { recordRedeem } from './stats';

// Atomically validates + consumes a redeem code, and records a per-identifier
// history doc so the exact same code can never be redeemed twice by the same
// identity (prevents double-redeem / abuse).
//
// Codes come in three types (set by Owner in the Admin Panel):
//  - 'coin' (default, backward compatible): adds `coin` to the balance.
//  - 'vip' / 'dev': upgrades the identity's plan for `durationDays`, in
//    addition to optionally granting bonus `coin`. This replaces the old
//    "paste a VIP/DEV key into the reaction form every time" flow - VIP/DEV
//    is now redeemed once here and persists on the identity (see
//    lib/coin.js's getOrCreateUser, which auto-reverts it to FREE on expiry).
export async function redeemCode(code, identifier) {
  const codeRef = db.collection('redeemCodes').doc(code);
  const historyRef = db.collection('redeemHistory').doc(`${code}__${identifier}`);
  const userRef = db.collection('users').doc(identifier);

  const result = await db.runTransaction(async (tx) => {
    const [codeSnap, historySnap] = await Promise.all([tx.get(codeRef), tx.get(historyRef)]);
    if (!codeSnap.exists) return { ok: false, reason: 'INVALID' };

    const data = codeSnap.data();
    if (data.status !== 'active') return { ok: false, reason: 'INVALID' };

    if (data.expiresAt) {
      const exp = data.expiresAt.toMillis ? data.expiresAt.toMillis() : new Date(data.expiresAt).getTime();
      if (!Number.isNaN(exp) && Date.now() > exp) return { ok: false, reason: 'EXPIRED' };
    }
    if (historySnap.exists) return { ok: false, reason: 'USED' };

    const maxUses = data.maxUses || 0;
    const usedCount = data.usedCount || 0;
    if (maxUses > 0 && usedCount >= maxUses) return { ok: false, reason: 'USED' };

    const type = data.type === 'vip' || data.type === 'dev' ? data.type : 'coin';

    tx.set(historyRef, { code, identifier, type, coin: data.coin || 0, createdAt: FieldValue.serverTimestamp() });
    tx.update(codeRef, { usedCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });

    if (type === 'vip' || type === 'dev') {
      const plan = type.toUpperCase();
      const durationDays = data.durationDays || 30;
      const planExpiresAt = Date.now() + durationDays * 24 * 60 * 60 * 1000;
      tx.set(userRef, { identifier, plan, planExpiresAt, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return { ok: true, type, plan, durationDays, coin: data.coin || 0 };
    }

    return { ok: true, type: 'coin', coin: data.coin || 0 };
  });

  if (result.ok) {
    if (result.coin) await adjustCoin(identifier, result.coin);
    await recordRedeem();
  }
  return result;
}
