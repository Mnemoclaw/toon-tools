# toon-cost-analyzer

CLI that tells you whether converting a given JSON payload to [TOON](https://github.com/toon-format/toon)
is worth it — before you wire it into your pipeline.

It compares real token counts (JSON vs TOON) for your actual data, flags payloads
where TOON won't help (deeply nested / irregular data), and optionally projects
monthly cost savings at your request volume.

This tool doesn't reimplement the TOON format — it wraps the official
[`@toon-format/toon`](https://www.npmjs.com/package/@toon-format/toon) package for encoding
and [`gpt-3-encoder`](https://www.npmjs.com/package/gpt-3-encoder) for token counting.

## Install

```bash
npm install
```

## Usage

```bash
node index.js data.json
node index.js data.json --price 3 --requests 500000
```

| Flag | Description |
|---|---|
| `-p, --price <usd>` | Price per 1M input tokens (default `3`) |
| `-r, --requests <n>` | Requests/month, to project monthly cost savings |
| `-q, --quiet` | Hide the TOON output preview |

## Example

```bash
$ node index.js orders.json --price 3 --requests 200000

TOON Cost Analyzer — orders.json
────────────────────────────────────────────────
JSON tokens:         4820
TOON tokens:         2910
Difference:          -1910 tokens (-39.6%)
Tabular eligibility: 92%

Projected monthly cost @ 200000 requests, $3/1M input tokens:
  JSON: $2892.00
  TOON: $1746.00
  Savings: $1146.00/month
```

## Why this matters

TOON isn't a universal win — its benefit depends entirely on payload shape
(uniform arrays of flat objects compress well, deeply nested configs don't).
This tool measures your actual data instead of assuming TOON always helps,
so you don't convert a pipeline that won't benefit.

## License

MIT
