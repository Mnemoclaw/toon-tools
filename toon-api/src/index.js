/**
 * toon-api — Cloudflare Workers API
 *
 * POST /v1/convert   : JSON payload → TOON + token savings analysis
 * POST /v1/analyze   : JSON payload → token savings analysis (no TOON output)
 * GET /healthz       : liveness probe
 * GET /              : basic info
 *
 * All POST bodies are JSON of the form: { "data": <any JSON value> }
 * Alternatively, POST the raw JSON value directly (we accept both).
 */
import { encode as toonEncode } from '@toon-format/toon';
import { encode as gptEncode } from 'gpt-tokenizer';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-RapidAPI-Key, X-RapidAPI-Proxy-Secret, Authorization',
};

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS, ...extra },
  });
}

function extractData(reqBody) {
  // Accept either the raw JSON value or { "data": <value> }
  if (reqBody && typeof reqBody === 'object' && Object.keys(reqBody).length === 1 && 'data' in reqBody) {
    return reqBody.data;
  }
  return reqBody;
}

function tabularEligibility(data) {
  let totalArrays = 0;
  let eligibleArrays = 0;
  function walk(node) {
    if (Array.isArray(node)) {
      totalArrays++;
      if (node.length > 0 && node.every((i) => i && typeof i === 'object' && !Array.isArray(i))) {
        const refKeys = Object.keys(node[0]).sort().join(',');
        const uniform = node.every((i) => Object.keys(i).sort().join(',') === refKeys);
        const flatValues = node.every((i) => Object.values(i).every((v) => typeof v !== 'object' || v === null));
        if (uniform && flatValues) eligibleArrays++;
      }
      node.forEach(walk);
    } else if (node && typeof node === 'object') {
      Object.values(node).forEach(walk);
    }
  }
  walk(data);
  return totalArrays === 0 ? null : Math.round((eligibleArrays / totalArrays) * 100);
}

function analyze(data) {
  const jsonCompact = JSON.stringify(data);
  const toon = toonEncode(data);
  const jsonTokens = gptEncode(jsonCompact).length;
  const toonTokens = gptEncode(toon).length;
  const savedTokens = jsonTokens - toonTokens;
  const savedPct = jsonTokens === 0 ? 0 : Math.round((savedTokens / jsonTokens) * 1000) / 10;
  return {
    toon,
    json_tokens: jsonTokens,
    toon_tokens: toonTokens,
    saved_tokens: savedTokens,
    saved_pct: savedPct,
    tabular_eligibility: tabularEligibility(data),
    recommendation: savedPct >= 15 ? 'convert' : savedPct >= 0 ? 'neutral' : 'keep_json',
  };
}

function checkAuth(request, env) {
  // If direct access is disabled, require X-RapidAPI-Proxy-Secret to match the configured secret.
  if (env.ALLOW_DIRECT_ACCESS === 'false' && env.RAPIDAPI_PROXY_SECRET) {
    const provided = request.headers.get('X-RapidAPI-Proxy-Secret');
    if (provided !== env.RAPIDAPI_PROXY_SECRET) {
      return json({ error: 'unauthorized', detail: 'missing or invalid proxy secret' }, 401);
    }
  }
  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method.toUpperCase();

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (method === 'GET' && (path === '/healthz' || path === '/health')) {
      return json({ ok: true, service: 'toon-api', version: '1.0.0' });
    }

    if (method === 'GET' && path === '/') {
      return json({
        name: 'toon-api',
        version: '1.0.0',
        description: 'Convert JSON payloads to TOON and measure token savings for LLM prompts.',
        endpoints: {
          convert: 'POST /v1/convert  — body: { "data": <any JSON> } → TOON + savings',
          analyze: 'POST /v1/analyze  — body: { "data": <any JSON> } → savings only (no TOON)',
          healthz: 'GET  /healthz',
        },
        homepage: 'https://github.com/Mnemoclaw/toon-tools',
      });
    }

    if (method === 'POST' && (path === '/v1/convert' || path === '/convert')) {
      const authError = checkAuth(request, env);
      if (authError) return authError;

      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'invalid_request', detail: 'body must be valid JSON' }, 400);
      }

      const data = extractData(body);
      try {
        const result = analyze(data);
        return json({
          toon: result.toon,
          metrics: {
            json_tokens: result.json_tokens,
            toon_tokens: result.toon_tokens,
            saved_tokens: result.saved_tokens,
            saved_pct: result.saved_pct,
            tabular_eligibility: result.tabular_eligibility,
            recommendation: result.recommendation,
          },
        });
      } catch (err) {
        return json({ error: 'encoding_failed', detail: err.message }, 422);
      }
    }

    if (method === 'POST' && (path === '/v1/analyze' || path === '/analyze')) {
      const authError = checkAuth(request, env);
      if (authError) return authError;

      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'invalid_request', detail: 'body must be valid JSON' }, 400);
      }

      const data = extractData(body);
      try {
        const result = analyze(data);
        // strip the toon output for the analyze endpoint
        return json({
          metrics: {
            json_tokens: result.json_tokens,
            toon_tokens: result.toon_tokens,
            saved_tokens: result.saved_tokens,
            saved_pct: result.saved_pct,
            tabular_eligibility: result.tabular_eligibility,
            recommendation: result.recommendation,
          },
        });
      } catch (err) {
        return json({ error: 'encoding_failed', detail: err.message }, 422);
      }
    }

    return json({ error: 'not_found', detail: `${method} ${path} is not a valid endpoint` }, 404);
  },
};
