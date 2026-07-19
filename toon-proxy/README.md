# toon-proxy

A drop-in reverse proxy for OpenAI/Anthropic-compatible chat-completion APIs
that converts eligible JSON payloads embedded in your prompts to
[TOON](https://github.com/toon-format/toon) before forwarding the request
upstream — with zero changes to your application code.

Point your existing client at `http://localhost:8787/v1/chat/completions`
instead of the provider's URL. The proxy scans message content for
` ```json ` fenced blocks, converts the ones with high "tabular eligibility"
(uniform arrays of flat objects) to TOON, and leaves everything else
untouched.

Uses the official [`@toon-format/toon`](https://www.npmjs.com/package/@toon-format/toon)
package for the actual encoding — this repo only contains the proxy/routing logic.

## Install & run

```bash
npm install
TOON_PROXY_UPSTREAM="https://api.openai.com/v1/chat/completions" npm start
```

## Configuration (env vars)

| Variable | Default | Description |
|---|---|---|
| `TOON_PROXY_UPSTREAM` | `https://api.openai.com/v1/chat/completions` | The real API endpoint to forward requests to |
| `TOON_PROXY_AUTH_HEADER` | `authorization` | Header name to pass through for auth |
| `TOON_PROXY_MIN_ELIGIBILITY` | `40` | Minimum tabular eligibility (%) required before converting a block |
| `PORT` | `8787` | Port the proxy listens on |

## Response headers

The proxy adds diagnostic headers to every response:

- `X-TOON-Blocks-Converted` — number of JSON blocks converted to TOON
- `X-TOON-Blocks-Skipped` — number of blocks left as JSON (low eligibility)
- `X-TOON-Tokens-Saved` — estimated tokens saved on this request

## Example

```bash
curl http://localhost:8787/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role":"user","content":"Summarize:\n```json\n{\"users\":[{\"id\":1,\"name\":\"Alice\"},{\"id\":2,\"name\":\"Bob\"}]}\n```"}]
  }'
```

## Notes

- Only converts fenced ` ```json ` blocks inside string message content — it doesn't
  touch `tool_calls`, function-call arguments, or non-chat endpoints.
- TOON is meant for **input**; this proxy does not attempt to convert model output.
- For irregular/deeply-nested JSON, the proxy leaves the block as-is rather than
  forcing a conversion that wouldn't save tokens.

## License

MIT
