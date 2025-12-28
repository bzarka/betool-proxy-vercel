import { Redis } from '@upstash/redis';

const kv = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    });
  }

  try {
    const data = await kv.get('betool_session');

    if (!data) {
      return new Response(
        JSON.stringify({ cached: false, message: 'No session cached' }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders() } }
      );
    }

    // Calcul expireAt pour compatibilité avec ton format précédent
    const expireAt = data.capturedAt + 50 * 60 * 1000;

    if (Date.now() > expireAt) {
      await kv.del('betool_session');
      return new Response(
        JSON.stringify({ cached: false, message: 'Session expired' }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders() } }
      );
    }

    return new Response(
      JSON.stringify({
        cookie: data.cookie,
        bearer: data.bearer,
        expireAt,
        cached: true,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders() } }
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    });
  }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Proxy-Secret',
  };
}