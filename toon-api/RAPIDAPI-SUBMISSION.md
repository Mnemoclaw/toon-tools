# Submission guide — RapidAPI

This is the recipe to publish `toon-api` on RapidAPI. The API is already live
at **https://toon-api.contactjccoaching.workers.dev** — RapidAPI will act as a
billing/discovery proxy in front of it.

## 1. Create the API listing

Log in to https://rapidapi.com and click **"Sell APIs" → "Add New API"**.

| Field | Value |
|---|---|
| API Name | `TOON Converter` |
| Short Description | Convert JSON payloads to TOON and measure real token savings for LLM prompts. |
| Category | `Data` → `Tools`, plus tag `Machine Learning` |
| Base URL | `https://toon-api.contactjccoaching.workers.dev` |
| Authentication | `apiKey` (let RapidAPI generate — that's the proxy secret) |

For the **OpenAPI spec**, import the file `rapidapi-openapi.yaml` from this
folder. RapidAPI will read the endpoints automatically.

## 2. Pricing tiers

RapidAPI lets you define multiple plans. Recommended starting point:

| Plan | Price (USD/mo) | Quota | Notes |
|---|---|---|---|
| Free | $0 | 100 requests/month | No credit card; lets users try |
| Basic | $5 | 10,000 requests/month | Covers most devs |
| Pro | $20 | 100,000 requests/month | For CI/CD pipelines |

Quota is per-month, hard limit (extra requests return 429). RapidAPI takes
~10–20% commission depending on plan; net take-home ≈ 80–90%.

## 3. Lock the origin (recommended after approval)

By default the worker accepts requests from anywhere (including direct
curl). Once RapidAPI has approved the listing, restrict it:

```bash
# 1. Get the RapidAPI Proxy Secret from your provider dashboard
#    (Settings → Security → Proxy Secret)

# 2. Store it as a Worker secret
wrangler secret put RAPIDAPI_PROXY_SECRET
#    paste the secret when prompted

# 3. Edit wrangler.toml: ALLOW_DIRECT_ACCESS = "false"

# 4. Redeploy
wrangler deploy
```

After this, only requests routed through RapidAPI (which inject the
`X-RapidAPI-Proxy-Secret` header) will be accepted. Direct curl from your
worker URL will return 401.

## 4. Marketing copy for the listing page

```
Reduce the cost of every LLM call that embeds JSON in its prompt.

TOON (Token-Oriented Object Notation) is a compact tabular format that
shrinks structured payloads by 20–60% in tokens, with the biggest wins
on uniform arrays of objects (logs, rows, lists of products, etc.).

This API does the conversion and the math for you. Send a JSON payload,
get back the TOON string and the exact token savings on a GPT-compatible
tokenizer — so you can decide whether converting a given payload is worth
it before you wire it into your pipeline.

Use cases:
  • Pre-flight check: "is this JSON worth converting?"
  • Inline conversion in serverless / no-code (Zapier, Make, n8n)
  • CI gate: fail the build if TOON regression is detected

Stateless. Sub-100 ms. No data stored.
```

Tags for SEO: `json`, `llm`, `tokens`, `compression`, `ai`, `openai`, `anthropic`,
`gpt`, `prompt-engineering`, `optimization`.

## 5. After submission

RapidAPI review is usually 1–3 business days. Once approved, the listing is
public. To drive traffic:

1. Add a "Powered by RapidAPI" or direct link in the playground footer
   (`toon-playground/index.html`).
2. Mention the API in the README's root (`README.md`).
3. If immune or MnemoClaw has any place where it fits, link from there.
