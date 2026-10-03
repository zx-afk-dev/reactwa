import { supabaseSelect, supabaseRpc } from '../../lib/supabaseAdmin';
import { sendError, sendSuccess, ERROR_CODES } from '../../lib/errors';

function normalize(row) {
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
  };
}

function visible(ad, placement) {
  const now = Date.now();
  if (!ad.isActive) return false;
  if (ad.startAt && new Date(ad.startAt).getTime() > now) return false;
  if (ad.endAt && new Date(ad.endAt).getTime() < now) return false;
  return ad.placement === 'all' || ad.placement === placement;
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const placement = String(req.query.placement || 'all').toLowerCase();
      const rows = await supabaseSelect('promotions', 'select=id,data&order=updated_at.desc');
      const ads = (rows || [])
        .map(normalize)
        .filter((ad) => visible(ad, placement))
        .sort((a, b) => b.priority - a.priority);
      return sendSuccess(res, { promotions: ads });
    }

    if (req.method === 'POST') {
      const { id, stat } = req.body || {};
      if (!id || !['impression', 'click'].includes(stat)) {
        return sendError(res, ERROR_CODES.BAD_REQUEST, 'Data statistik tidak valid.');
      }
      await supabaseRpc('increment_promotion_stat', { p_id: String(id), p_stat: stat });
      return sendSuccess(res, { tracked: true });
    }

    return sendError(res, ERROR_CODES.METHOD_NOT_ALLOWED, 'Method not allowed');
  } catch (err) {
    console.error('promotions endpoint error', err);
    return sendError(res, ERROR_CODES.INTERNAL_ERROR, 'Gagal memuat promosi.');
  }
}
