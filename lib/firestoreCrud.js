import { db, FieldValue } from './firebaseAdmin';
import { sendSuccess, sendError, ERROR_CODES } from './errors';
import { withAdminAuth } from './adminApi';
import { logEvent } from './logger';

function generateId(prefix, length) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return prefix ? `${prefix}-${out}` : out;
}

// Generic admin-only list+create handler for simple Firestore collections
// (vipKeys, devKeys, redeemCodes, promotions). Reduces boilerplate across
// otherwise near-identical CRUD endpoints.
export function createCrudHandler(collectionName, { idPrefix, idLength = 10, beforeCreate } = {}) {
  return withAdminAuth(async (req, res) => {
    const col = db.collection(collectionName);
    try {
      if (req.method === 'GET') {
        const snap = await col.orderBy('createdAt', 'desc').limit(200).get();
        return sendSuccess(res, { items: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
      }
      if (req.method === 'POST') {
        let data = { ...(req.body || {}) };
        delete data.id;
        if (beforeCreate) data = beforeCreate(data);
        const id = generateId(idPrefix, idLength);
        data.createdAt = FieldValue.serverTimestamp();
        data.updatedAt = FieldValue.serverTimestamp();
        await col.doc(id).set(data);
        await logEvent(`${collectionName}_create`, `Created ${collectionName}`, { id, admin: req.admin.username });
        return sendSuccess(res, { id }, 201);
      }
      return sendError(res, ERROR_CODES.METHOD_NOT_ALLOWED, 'Method not allowed');
    } catch (err) {
      console.error(`${collectionName} crud error`, err);
      return sendError(res, ERROR_CODES.INTERNAL_ERROR, 'Terjadi kesalahan pada server.');
    }
  });
}

// Generic admin-only update+delete handler for a single document, by :id.
export function createCrudItemHandler(collectionName) {
  return withAdminAuth(async (req, res) => {
    const { id } = req.query;
    if (!id) return sendError(res, ERROR_CODES.VALIDATION_ERROR, 'ID wajib diisi.');
    const ref = db.collection(collectionName).doc(id);
    try {
      if (req.method === 'PATCH' || req.method === 'PUT') {
        const data = { ...(req.body || {}) };
        delete data.id;
        data.updatedAt = FieldValue.serverTimestamp();
        await ref.set(data, { merge: true });
        await logEvent(`${collectionName}_update`, `Updated ${collectionName}`, { id, admin: req.admin.username });
        return sendSuccess(res, { message: 'Berhasil diperbarui.' });
      }
      if (req.method === 'DELETE') {
        await ref.delete();
        await logEvent(`${collectionName}_delete`, `Deleted ${collectionName}`, { id, admin: req.admin.username });
        return sendSuccess(res, { message: 'Berhasil dihapus.' });
      }
      return sendError(res, ERROR_CODES.METHOD_NOT_ALLOWED, 'Method not allowed');
    } catch (err) {
      console.error(`${collectionName} item crud error`, err);
      return sendError(res, ERROR_CODES.INTERNAL_ERROR, 'Terjadi kesalahan pada server.');
    }
  });
}
