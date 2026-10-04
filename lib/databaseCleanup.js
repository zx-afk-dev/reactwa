import { supabaseRpc } from './supabaseAdmin';

export async function runDatabaseCleanup({
  logDays = 30,
  queueDays = 7,
  redeemDays = 90,
  batch = 500,
} = {}) {
  const rows = await supabaseRpc('run_database_cleanup', {
    p_log_days: Math.max(Number(logDays) || 30, 7),
    p_queue_days: Math.max(Number(queueDays) || 7, 1),
    p_redeem_days: Math.max(Number(redeemDays) || 90, 7),
    p_batch: Math.min(Math.max(Number(batch) || 500, 50), 2000),
  });

  return Array.isArray(rows) ? rows[0] : rows;
}
