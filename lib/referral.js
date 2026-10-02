import { createHash } from 'crypto';
import { db, FieldValue } from './firebaseAdmin';

export const REFERRAL_SIGNUP_BONUS = 2;
export const REFERRAL_REACTION_BONUS = 1;

function makeCode(uid) {
  return createHash('sha256').update(String(uid)).digest('hex').slice(0, 12).toUpperCase();
}

export async function getOrCreateReferralCode(uid) {
  if (!uid) throw new Error('UID wajib diisi.');

  const userRef = db.collection('users').doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) throw new Error('User tidak ditemukan.');

  const existing = userSnap.data()?.referralCode;
  if (existing) return existing;

  const code = makeCode(uid);
  const codeRef = db.collection('referralCodes').doc(code);

  await db.runTransaction(async (tx) => {
    const [freshUser, codeSnap] = await Promise.all([tx.get(userRef), tx.get(codeRef)]);
    if (freshUser.data()?.referralCode) return;
    if (codeSnap.exists && codeSnap.data()?.uid !== uid) {
      throw new Error('Kode referral bentrok. Coba lagi.');
    }

    tx.set(codeRef, {
      uid,
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    tx.update(userRef, {
      referralCode: code,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  return code;
}

export async function claimReferral(uid, code) {
  const normalized = String(code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!uid || !normalized || normalized.length < 6 || normalized.length > 32) {
    return { ok: false, reason: 'INVALID' };
  }

  const codeRef = db.collection('referralCodes').doc(normalized);
  const userRef = db.collection('users').doc(uid);

  return db.runTransaction(async (tx) => {
    const codeSnap = await tx.get(codeRef);
    const userSnap = await tx.get(userRef);

    if (!codeSnap.exists) return { ok: false, reason: 'INVALID' };

    const inviterUid = codeSnap.data()?.uid;
    if (!inviterUid || inviterUid === uid) return { ok: false, reason: 'SELF' };

    if (!userSnap.exists) return { ok: false, reason: 'USER_NOT_FOUND' };

    const user = userSnap.data() || {};
    if (user.referrerUid) return { ok: false, reason: 'ALREADY_CLAIMED' };

    const inviterRef = db.collection('users').doc(inviterUid);
    const rewardRef = db.collection('referralRewards').doc(`signup_${inviterUid}_${uid}`);
    const [inviterSnap, rewardSnap] = await Promise.all([
      tx.get(inviterRef),
      tx.get(rewardRef),
    ]);

    if (!inviterSnap.exists) return { ok: false, reason: 'INVITER_NOT_FOUND' };
    if (rewardSnap.exists) return { ok: false, reason: 'ALREADY_CLAIMED' };

    const inviter = inviterSnap.data() || {};
    if (inviter.suspended) return { ok: false, reason: 'INVITER_SUSPENDED' };

    tx.update(userRef, {
      referrerUid: inviterUid,
      referralClaimedAt: FieldValue.serverTimestamp(),
      referralSignupRewarded: true,
      updatedAt: FieldValue.serverTimestamp(),
    });

    tx.set(rewardRef, {
      type: 'signup',
      inviterUid,
      referredUid: uid,
      coin: REFERRAL_SIGNUP_BONUS,
      createdAt: FieldValue.serverTimestamp(),
    });

    tx.update(inviterRef, {
      coin: FieldValue.increment(REFERRAL_SIGNUP_BONUS),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { ok: true, bonus: REFERRAL_SIGNUP_BONUS };
  });
}

export async function rewardReferralReaction(uid) {
  if (!uid) return { ok: false, reason: 'INVALID' };

  const userRef = db.collection('users').doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) return { ok: false, reason: 'USER_NOT_FOUND' };

  const inviterUid = userSnap.data()?.referrerUid;
  if (!inviterUid || inviterUid === uid) return { ok: false, reason: 'NO_REFERRER' };

  const rewardRef = db.collection('referralRewards').doc(`reaction_${inviterUid}_${uid}`);
  const inviterRef = db.collection('users').doc(inviterUid);

  return db.runTransaction(async (tx) => {
    const [rewardSnap, inviterSnap] = await Promise.all([
      tx.get(rewardRef),
      tx.get(inviterRef),
    ]);

    if (rewardSnap.exists) return { ok: false, reason: 'ALREADY_REWARDED' };
    if (!inviterSnap.exists) return { ok: false, reason: 'INVITER_NOT_FOUND' };
    if (inviterSnap.data()?.suspended) return { ok: false, reason: 'INVITER_SUSPENDED' };

    tx.set(rewardRef, {
      type: 'reaction',
      inviterUid,
      referredUid: uid,
      coin: REFERRAL_REACTION_BONUS,
      createdAt: FieldValue.serverTimestamp(),
    });

    tx.update(inviterRef, {
      coin: FieldValue.increment(REFERRAL_REACTION_BONUS),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { ok: true, bonus: REFERRAL_REACTION_BONUS };
  });
}

export async function getReferralInfo(uid) {
  const code = await getOrCreateReferralCode(uid);
  const snap = await db.collection('referralRewards')
    .where('inviterUid', '==', uid)
    .limit(500)
    .get();

  let signup = 0;
  let reactions = 0;
  let earned = 0;
  const referred = new Set();

  for (const doc of snap.docs) {
    const data = doc.data() || {};
    referred.add(data.referredUid);
    const coin = Number(data.coin || 0);
    earned += coin;
    if (data.type === 'signup') signup += 1;
    if (data.type === 'reaction') reactions += 1;
  }

  return {
    code,
    signup,
    reactions,
    referredUsers: referred.size,
    earned,
  };
}
