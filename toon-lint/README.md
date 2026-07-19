# toon-lint

A validator for `.toon` files. TOON is designed to be machine-generated, but
as soon as people hand-edit it (fixing a value, deleting a row), it's easy to
end up with a file that's silently wrong — a declared array length that no
longer matches its rows, a ragged table, or data that doesn't round-trip.

`toon-lint` catches these before they reach an LLM prompt or a decoder in
production.

Built entirely on the official [`@toon-format/toon`](https://www.npmjs.com/package/@toon-format/toon)
package for decode/encode — this repo only adds the validation checks.

## Install

```bash
npm install
```

## Usage

```bash
node index.js "data/**/*.toon"
node index.js "data/**/*.toon" --strict   # fail on warnings too
```

## Checks performed

1. **Parse errors** — the file isn't valid TOON at all.
2. **Length mismatches** — a tabular array declares `items[N]{...}:` but
   `N` doesn't match the number of data rows underneath it.
3. **Round-trip integrity** — decoding the file, re-encoding it, and
   decoding again should produce identical data. A mismatch usually means
   an edge case in how the file was hand-edited.

## Example output

```
✓ orders.toon
config.toon
  ✗ error   Line 4: "items" declares length [3] but 2 row(s) follow
  ⚠ warning Round-trip mismatch: decode → encode → decode does not produce identical data
────────────────────────────────────────────────
2 file(s) checked — 1 error(s), 1 warning(s)
```

Exit code is non-zero if any errors are found (or warnings, with `--strict`),
so it can be wired into CI.

## License

MIT
