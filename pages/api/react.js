import { validateReactionEmojis, validateWhatsAppChannelUrl } from '../../lib/security';
import { getClientIpFromRequest, hashIp } from '../../lib/ip';
import { getOrCreateUser, spendCoin, refundCoin } from '../../lib/coin';
import { getSettings } from '../../lib/settings';
import { recordNewUser, recordStat } from '../../lib/stats';
import { verifyRequestUser } from '../../lib/userAuth';
import { logEvent } from '../../lib/logger';
import { rewardReferralReaction } from '../../lib/referral';

const UPSTREAM_URL = process.env.REACTION_API_URL || 'https://react.zfile.web.id/api/send-reaction';

export const config = {
  api: {
    bodyParser: { sizeLimit: '16kb' },
  },
};

function parseInput(body) {
  const url = typeof body?.url === 'string' ? body.url.trim() : '';
  const reaction = Array.isArray(body?.emojis)
    ? body.emojis
    : String(body?.emojis || '').split(',').map((x) => x.trim()).filter(Boolean);

  return { url, reaction };
}

async function sendUpstream(url, emojis) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Number(process.env.UPSTREAM_TIMEOUT || 10000)
  );

  try {
    const response = await fetch(UPSTREAM_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ReactionWA-Proxy/3.0',
      },
      body: JSON.stringify({
        url,
        emojis: emojis.join(','),
      }),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({
      success: false,
      message: 'Response upstream tidak valid.',
    }));

    return { response, data };
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      success: false,
      code: 'METHOD_NOT_ALLOWED',
      message: 'Method not allowed.',
    });
  }

  const { url, reaction } = parseInput(req.body);
  const urlCheck = validateWhatsAppChannelUrl(url);

  if (!urlCheck.valid) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_URL',
      message: 'URL postingan Saluran WhatsApp tidak valid.',
    });
  }

  const authUser = await verifyRequestUser(req);
  const clientIp = typeof req.body?.visitorIp === 'string' ? req.body.visitorIp.trim() : '';
  const ip = clientIp || getClientIpFromRequest(req);
  const identifier = authUser?.uid || hashIp(ip);

  let currentPlan = 'FREE';
  let reactionCount = 1;

  try {
    const settings = await getSettings();

    if (settings.maintenance?.enabled) {
      return res.status(503).json({
        success: false,
        code: 'MAINTENANCE',
        message: settings.maintenance.description || 'Layanan sedang dalam pemeliharaan.',
      });
    }

    const user = await getOrCreateUser(identifier, authUser ? {
      authUid: authUser.uid,
      email: authUser.email,
      displayName: authUser.name,
      authProvider: authUser.provider,
    } : {});
    const plan = user.plan || 'FREE';
    currentPlan = plan;
    const maxEmojis = plan === 'VIP' ? 30 : 5;
    const reactionCheck = validateReactionEmojis(reaction, maxEmojis);
    reactionCount = reactionCheck.list?.length || 1;

    if (!reactionCheck.valid) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_REACTION',
        message: `Pilih 1 sampai ${maxEmojis} emoji reaction yang valid.`,
        maxEmojis,
      });
    }

    if (user.isNew) {
      await recordNewUser(plan).catch((err) => console.error('new user stat', err));
    }

    if (user.suspended) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'Akun/identitas ini sedang ditangguhkan.',
      });
    }

    const coinCost = reactionCheck.hasCustom ? 2 : 1;
    let spent = 0;
    let remainingCoin = Number(user.coin || 0);

    if (plan === 'FREE') {
      const spend = await spendCoin(identifier, coinCost);

      if (spend.suspended) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: 'Akun/identitas ini sedang ditangguhkan.',
        });
      }

      if (!spend.ok) {
        return res.status(402).json({
          success: false,
          code: 'NO_COIN',
          message: `Coin tidak cukup. Dibutuhkan ${coinCost} coin untuk request ini.`,
          coin: Number(spend.coin || 0),
          cost: coinCost,
        });
      }

      spent = coinCost;
      remainingCoin = Number(spend.coin || 0);
    }

    const { response, data } = await sendUpstream(urlCheck.url, reactionCheck.list);

    if (!response.ok || data?.success === false) {
      if (spent) await refundCoin(identifier, spent).catch(() => {});
      await recordStat({ plan, success: false, reactionCount: reactionCheck.list.length }).catch(() => {});

      return res.status(response.status >= 400 ? response.status : 502).json({
        success: false,
        code: 'UPSTREAM_ERROR',
        message: data?.message || 'Reaction service gagal memproses request.',
      });
    }

    await recordStat({ plan, success: true, reactionCount: reactionCheck.list.length }).catch((err) => {
      console.error('reaction stat error', err);
    });

    await logEvent('reaction_sent', 'Reaction berhasil dikirim.', { plan, reactionCount }).catch(() => {});

    if (authUser?.uid) {
      await rewardReferralReaction(authUser.uid).catch((err) => console.error('referral reaction reward', err));
    }

        return res.status(200).json({
      success: true,
      code: 'SENT',
      message: plan === 'VIP' ? 'Reaction VIP berhasil dikirim.' : 'Reaction berhasil dikirim.',
      plan,
      coin: remainingCoin,
      cost: spent,
      customEmoji: reactionCheck.hasCustom,
      data: {
        success: Boolean(data?.success),
        message: typeof data?.message === 'string' ? data.message : null,
      },
    });
  } catch (error) {
    const timeout = error?.name === 'AbortError';

    await recordStat({
      plan: currentPlan,
      success: false,
      reactionCount,
    }).catch(() => {});

    console.error('[reaction-proxy]', {
      name: error?.name,
      message: error?.message,
      timeout,
    });

    return res.status(timeout ? 504 : 503).json({
      success: false,
      code: timeout ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_UNAVAILABLE',
      message: timeout
        ? 'Reaction service terlalu lama merespons.'
        : 'Reaction service tidak dapat dihubungi.',
    });
  }
}
