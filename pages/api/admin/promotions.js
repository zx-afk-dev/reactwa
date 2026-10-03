import crypto from 'crypto';
import { withAdminAuth } from '../../../lib/adminApi';
import { supabaseDelete, supabaseInsert, supabaseSelect, supabaseUpdate } from '../../../lib/supabaseAdmin';
import { sendError, sendSuccess, ERROR_CODES } from '../../../lib/errors';
import { logEvent } from '../../../lib/logger';

function clean(row) {
  const d = row?.data || {};
  return {
    id: row.id,
    title: d.title || '',
    description: d.description || '',
    imageUrl: d.imageUrl || '',
    targetUrl: d.targetUrl || '',
    type: d.type || 'banner',
    placement: d.placement || 'all',
    priority: Number(d.priority || 0),
    isActive: d.isActive !== false,
    startAt: d.startAt || null,
    endAt: d.endAt || null,
    impressions: Number(d.impressions || 0),
    clicks: Number(d.clicks || 0),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function buildData(body, old = {}) {
  const title = String(body.title ?? old.title ?? '').trim();
  if (!title || title.length > 160) throw new Error('Judul iklan wajib diisi dan maksimal 160 karakter.');
  const placement = ['all', 'home', 'react', 'redeem'].includes(body.placement) ? body.placement : (old.placement || 'all');
  const type = ['banner', 'card', 'announcement'].includes(body.type) ? body.type : (old.type || 'banner');
  return {
    title,
    description: String(body.description ?? old.description ?? '').trim().slice(0, 500),
    imageUrl: String(body.imageUrl ?? old.imageUrl ?? '').trim().slice(0, 2000),
    targetUrl: String(body.targetUrl ?? old.targetUrl ?? '').trim().slice(0, 2000),
    type,
    placement,
    priority: Math.max(0, Math.min(999999, Math.floor(Number(body.priority ?? old.priority ?? 0) || 0))),
    isActive: body.isActive === undefined ? old.isActive !== false : Boolean(body.isActive),
    startAt: body.startAt || old.startAt || null,
    endAt: body.endAt || old.endAt || null,
    impressions: Number(old.impressions || 0),
    clicks: Number(old.clicks || 0),
  };
}

export default withAdminAuth(async (req, res) => {
  try {
    if (req.method === 'GET') {
      const rows = await supabaseSelect('promotions', 'select=id,data,created_at,updated_at&order=updated_at.desc');
      return sendSuccess(res, { promotions: (rows || []).map(clean) });
    }

    if (req.method === 'POST') {
      const data = buildData(req.body || {});
      const id = crypto.randomUUID();
      await supabaseInsert('promotions', { id, data, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      await logEvent('admin_promotion_create', `Admin ${req.admin.username} membuat iklan ${id}.`, { admin: req.admin.username, id, title: data.title });
      return sendSuccess(res, { promotion: clean({ id, data, created_at: new Date().toISOString() }) });
    }

    if (req.method === 'PATCH') {
      const id = String(req.body?.id || '');
      if (!id) return sendError(res, ERROR_CODES.BAD_REQUEST, 'ID iklan wajib diisi.');
      const rows = await supabaseSelect('promotions', `id=eq.${encodeURIComponent(id)}&limit=1`);
      if (!rows?.length) return sendError(res, ERROR_CODES.NOT_FOUND, 'Iklan tidak ditemukan.');
      const old = clean(rows[0]);
      const data = buildData(req.body || {}, old);
      await supabaseUpdate('promotions', { id }, { data, updated_at: new Date().toISOString() });
      await logEvent('admin_promotion_update', `Admin ${req.admin.username} mengubah iklan ${id}.`, { admin: req.admin.username, id, title: data.title });
      return sendSuccess(res, { promotion: clean({ ...rows[0], data, updated_at: new Date().toISOString() }) });
    }

    if (req.method === 'DELETE') {
      const id = String(req.body?.id || req.query?.id || '');
      if (!id) return sendError(res, ERROR_CODES.BAD_REQUEST, 'ID iklan wajib diisi.');
      await supabaseDelete('promotions', { id });
      await logEvent('admin_promotion_delete', `Admin ${req.admin.username} menghapus iklan ${id}.`, { admin: req.admin.username, id });
      return sendSuccess(res, { deleted: true });
    }

    return sendError(res, ERROR_CODES.METHOD_NOT_ALLOWED, 'Method not allowed.');
  } catch (err) {
    console.error('admin promotions error', err);
    return sendError(res, ERROR_CODES.INTERNAL_ERROR, err.message || 'Gagal memproses iklan.');
  }
});
