# toon-api

Cloudflare Workers API that converts JSON payloads to [TOON](https://github.com/toon-format/toon)
and measures the real token savings, designed to be exposed on RapidAPI.

## Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/v1/convert` | Convert `{ "data": <any JSON> }` to TOON + full metrics |
| `POST` | `/v1/analyze` | Token savings analysis only (no TOON output) |
| `GET`  | `/healthz` | Liveness probe |
| `GET`  | `/` | API info |

### Request

Both POST endpoints accept either a raw JSON value, or a wrapper of the form:

```json
{ "data": <any JSON value> }
```

### Response (convert)

```json
{
  "toon": "...",
  "metrics": {
    "json_tokens": 4820,
    "toon_tokens": 2910,
    "saved_tokens": 1910,
    "saved_pct": 39.6,
    "tabular_eligibility": 92,
    "recommendation": "convert"
  }
}
```

`recommendation` is one of `convert` (≥15% saved), `neutral` (0–15%), `keep_json` (TOON is larger).

## Local development

```bash
npm install
npm run dev      # wrangler dev — local on http://localhost:8787
npm test         # smoke test
```

## Deploy

```bash
npm run deploy   # wrangler deploy — pushes to <name>.<account>.workers.dev
```

To lock the public `*.workers.dev` URL so only RapidAPI can call it:

```bash
wrangler secret put RAPIDAPI_PROXY_SECRET
# then edit wrangler.toml: ALLOW_DIRECT_ACCESS = "false"
```

When `ALLOW_DIRECT_ACCESS = "false"` and `RAPIDAPI_PROXY_SECRET` is set, every request must
carry `X-RapidAPI-Proxy-Secret: <value>` or it is rejected with 401. Get the secret value
from your RapidAPI provider settings once your API is listed.

## Notes

- Built on `@toon-format/toon` (official encoder) and `gpt-3-encoder` (GPT-compatible tokenizer).
  Both are pure JS and run unmodified in the Workers runtime.
- Stateless: no KV, D1, or R2 needed.
- Free tier: 100k req/day on Cloudflare Workers — well above expected load.

## License

MIT
