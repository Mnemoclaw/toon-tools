/**
 * toon-proxy — a drop-in reverse proxy for chat-completion style APIs.
 *
 * It sits between your app and an OpenAI/Anthropic-compatible endpoint,
 * scans outgoing message content for ```json fenced blocks, converts the
 * ones that are worth converting to TOON, and forwards the request
 * upstream unchanged otherwise.
 *
 * This lets you adopt TOON without touching application code: point your
 * existing client at this proxy's URL instead of the provider's URL.
 *
 * Encoding itself is delegated to the official @toon-format/toon package —
 * this file only contains the routing / detection / rewriting logic.
 */
import express from 'express';
import fetch from 'node-fetch';
import { encode as toonEncode } from '@toon-format/toon';
import { encode as gptEncode } from 'gpt-3-encoder';

const app = express();
app.use(express.json({ limit: '25mb' }));

const UPSTREAM_URL = process.env.TOON_PROXY_UPSTREAM || 'https://api.openai.com/v1/chat/completions';
const UPSTREAM_AUTH_HEADER = process.env.TOON_PROXY_AUTH_HEADER || 'authorization';
const MIN_TABULAR_ELIGIBILITY = parseInt(process.env.TOON_PROXY_MIN_ELIGIBILITY || '40', 10);
const PORT = process.env.PORT || 8787;

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
  return totalArrays === 0 ? null : (eligibleArrays / totalArrays) * 100;
}

/** Finds ```json fenced blocks in a text string and swaps eligible ones for ```toon blocks. */
function convertEmbeddedJson(text) {
  const jsonBlockRegex = /```json\s*([\s\S]*?)```/g;
  let savedTokens = 0;
  let converted = 0;
  let skipped = 0;

  const result = text.replace(jsonBlockRegex, (match, jsonStr) => {
    let data;
    try {
      data = JSON.parse(jsonStr);
    } catch {
      return match; // not valid JSON, leave untouched
    }

    const eligibility = tabularEligibility(data);
    if (eligibility !== null && eligibility < MIN_TABULAR_ELIGIBILITY) {
      skipped++;
      return match; // not worth converting
    }

    const toon = toonEncode(data);
    const before = gptEncode(jsonStr).length;
    const after = gptEncode(toon).length;
    savedTokens += before - after;
    converted++;
    return '```toon\n' + toon + '\n```';
  });

  return { result, savedTokens, converted, skipped };
}

app.post('/v1/chat/completions', async (req, res) => {
  const body = { ...req.body };
  let totalSaved = 0;
  let totalConverted = 0;
  let totalSkipped = 0;

  if (Array.isArray(body.messages)) {
    body.messages = body.messages.map((msg) => {
      if (typeof msg.content === 'string') {
        const { result, savedTokens, converted, skipped } = convertEmbeddedJson(msg.content);
        totalSaved += savedTokens;
        totalConverted += converted;
        totalSkipped += skipped;
        return { ...msg, content: result };
      }
      return msg;
    });
  }

  try {
    const upstreamRes = await fetch(UPSTREAM_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [UPSTREAM_AUTH_HEADER]: req.headers[UPSTREAM_AUTH_HEADER.toLowerCase()] || '',
      },
      body: JSON.stringify(body),
    });

    const data = await upstreamRes.json();
    res.set('X-TOON-Blocks-Converted', String(totalConverted));
    res.set('X-TOON-Blocks-Skipped', String(totalSkipped));
    res.set('X-TOON-Tokens-Saved', String(totalSaved));
    res.status(upstreamRes.status).json(data);
  } catch (err) {
    res.status(502).json({ error: 'Upstream request failed', detail: err.message });
  }
});

app.get('/health', (_req, res) => res.json({ ok: true, upstream: UPSTREAM_URL }));

app.listen(PORT, () => {
  console.log(`toon-proxy listening on :${PORT}`);
  console.log(`forwarding to ${UPSTREAM_URL}`);
  console.log(`min tabular eligibility for conversion: ${MIN_TABULAR_ELIGIBILITY}%`);
});
