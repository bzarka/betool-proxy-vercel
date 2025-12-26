import { kv } from '@vercel/kv';

const PROXY_SECRET = process.env.PROXY_SECRET;
const CACHE_TTL = 50 * 60; // 50 minutes en secondes (KV utilise secondes pour EXPIRE)

export const config = {
  runtime: 'edge', // Optionnel : plus rapide, ou 'nodejs' si besoin
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    });
  }

  // Sécurité secret
  const providedSecret = req.headers.get('x-proxy-secret');
  if (providedSecret !== PROXY_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    });
  }

  try {
    const { cookie, bearer } = await req.json();

    if (!cookie || !bearer) {
      return new Response(JSON.stringify({ error: 'Missing cookie or bearer' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      });
    }

    const data = {
      cookie,
      bearer,
      capturedAt: Date.now(),
    };

    // Stocke avec expiration
    await kv.set('betool_session', data, { ex: CACHE_TTL });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Session captured',
        expireInSeconds: CACHE_TTL,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders() } }
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Invalid JSON or server error' }), {
      status: 400,
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