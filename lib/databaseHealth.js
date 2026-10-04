import { supabaseRpc } from './supabaseAdmin';

export async function getDatabaseHealth() {
  const rows = await supabaseRpc('get_database_health', {});
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function checkDatabaseIntegrity() {
  const rows = await supabaseRpc('check_database_integrity', {});
  return Array.isArray(rows) ? rows[0] : rows;
}
