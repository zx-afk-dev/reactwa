const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

export function redisConfigured() {
  return Boolean(REDIS_URL && REDIS_TOKEN);
}

export async function redis(command, args = []) {
  if (!redisConfigured()) throw new Error('REDIS_NOT_CONFIGURED');

  const response = await fetch(REDIS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([command, ...args]),
  });

  if (!response.ok) throw new Error(`REDIS_HTTP_${response.status}`);
  const payload = await response.json();

  if (payload.error) throw new Error(String(payload.error));
  return payload.result;
}
