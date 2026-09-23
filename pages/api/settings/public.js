import { sendSuccess, sendError, ERROR_CODES } from '../../../lib/errors';
import { getSettings } from '../../../lib/settings';
import { db } from '../../../lib/firebaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'GET') return sendError(res, ERROR_CODES.METHOD_NOT_ALLOWED, 'Method not allowed');

  try {
    const settings = await getSettings();
    const promoSnap = await db.collection('promotions').where('active', '==', true).limit(5).get();
    const now = Date.now();
    const promotions = promoSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((p) => {
        const start = p.startDate ? new Date(p.startDate).getTime() : 0;
        const end = p.endDate ? new Date(p.endDate).getTime() : Infinity;
        return now >= start && now <= end;
      });

    return sendSuccess(res, {
      siteName: settings.siteName,
      siteDescription: settings.siteDescription,
      maintenance: settings.maintenance,
      pricing: settings.pricing,
      whatsappOwnerNumber: settings.whatsappOwnerNumber,
      termsVersion: settings.terms?.version || 1,
      promotions,
    });
  } catch (err) {
    console.error('public settings error', err);
    return sendError(res, ERROR_CODES.INTERNAL_ERROR, 'Terjadi kesalahan pada server.');
  }
}
