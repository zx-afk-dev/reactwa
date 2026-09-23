import { db, FieldValue } from './firebaseAdmin';
import { adjustCoin } from './coin';
import { recordRedeem } from './stats';

// Atomically validates + consumes a redeem code, and records a per-identifier
// history doc so the exact same code can never be redeemed twice by the same
// identity (prevents double-redeem / abuse).
export async function redeemCode(code, identifier) {
  const codeRef = db.collection('redeemCodes').doc(code);
  const historyRef = db.collection('redeemHistory').doc(`${code}__${identifier}`);

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

    tx.set(historyRef, { code, identifier, coin: data.coin || 0, createdAt: FieldValue.serverTimestamp() });
    tx.update(codeRef, { usedCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
    return { ok: true, coin: data.coin || 0 };
  });

  if (result.ok) {
    await adjustCoin(identifier, result.coin);
    await recordRedeem();
  }
  return result;
}
