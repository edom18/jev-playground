# Jev Playground

[日本語](README.ja.md)

A single-screen playground for **Jev**, TypeSafe's System One model: send a `state` plus typed `questions`, get structured answers (choices, scores, probabilities) your code can use directly. It is built to show, at a glance, what the API looks like, what JSON to send, and what comes back.

This is an unofficial demo. See the [TypeSafe docs](https://docs.typesafe.ai/introduction) for the authoritative reference.

## What you see

| Area | Contents |
| --- | --- |
| Left, top | A free-form editor holding the full request body (JSON), a dropdown of working samples, and an explain button that opens a short description of the selected sample: intended use, what it sends, what it returns, and how code would use the result. |
| Left, bottom | The result: one card per answer (value, probability bars, confidence, and the access path such as `response.answers.department.choice`) plus the raw response JSON. |
| Right | The endpoint and headers, status / latency / token usage of the last call, the equivalent sending code (curl, fetch, JS SDK, Python SDK, and this demo's own code) kept in sync with the editor, a cheat sheet of the request and response shapes, error codes, and model / pricing facts. |
| Header | Language toggle, API key settings, and usage since the page was opened: requests, input tokens, output tokens, estimated cost. |

The UI is available in Japanese and English. It follows the browser language on the first visit, and the toggle in the header switches it at any time (the choice is remembered in that browser). Sample request bodies are not translated.

## Run it

Requires Node.js 20 or newer. There are no dependencies and no build step.

```sh
node server.js          # PORT defaults to 8787
```

Open <http://localhost:8787>, click the API key button in the header, and paste a key from <https://console.typesafe.ai/keys>. Pick a sample and press **Send** (or Cmd/Ctrl + Enter).

## The API in one minute

```http
POST https://api.typesafe.ai/v1/systemone
Authorization: Bearer <API_KEY>
Content-Type: application/json
```

```json
{
  "state": "Help! My payouts have been failing for 3 days.",
  "model": "jev-latest",
  "questions": {
    "department": {
      "type": "choice",
      "instructions": "Which team should handle this?",
      "criteria": { "billing": "Payments, refunds", "technical": "Bugs, outages" }
    },
    "frustration": {
      "type": "score",
      "instructions": "How frustrated is the customer?",
      "criteria": ["Calm", "Frustrated", "Very angry"]
    },
    "is_urgent": { "type": "noul", "instructions": "Does this convey urgency?" }
  }
}
```

- `state` is the content to evaluate: a string, an object, or an array.
- `questions` is a map whose keys you choose; answers come back under the same keys. All questions are evaluated in parallel and independently against the same state.
- Three question types: `choice` (pick one option; `criteria` is a map of option to description or `null`), `score` (rate on ordered levels; `criteria` is an array), and `noul` (probability that the answer is yes; `criteria` is optional).
- Choice and Score answers include `probabilities` and a `confidence`; every response includes `usage` (`input_tokens`, `output_tokens`).
- `GET /v1/models` lists the model names available to your account.

## How the API key is handled

- The key is entered in the page and stored only in that browser's `localStorage`. It is shown masked (last four characters).
- Each call sends it as an `Authorization` header to this demo's proxy, which forwards the header to TypeSafe unchanged.
- `server.js` holds no key of its own and does not store or log the header. There is no server-side key or environment variable for it.

## Why there is a proxy

`api.typesafe.ai` rejects browser origins (a CORS preflight returns `Disallowed CORS origin`), so a static page cannot call it directly. `server.js` serves `index.html` and relays two routes, passing the upstream status and body through untouched so that 401 / 422 / 429 / 529 responses stay visible:

| Demo route | Upstream |
| --- | --- |
| `POST /api/systemone` | `POST https://api.typesafe.ai/v1/systemone` |
| `GET /api/models` | `GET https://api.typesafe.ai/v1/models` |

## Cost display

TypeSafe's documentation has no cost or billing API, so the cost in the header is an estimate computed in the page: the sum of `usage.input_tokens` from each response × $0.042 per million tokens (the published jev-1.13 price; output tokens are free). The price is the constant `PRICE_PER_MTOK_USD` in `index.html`; update it if pricing changes. Counts reset when the page is reloaded.

## Hosting it publicly

- It needs a Node runtime (Render, Fly.io, Railway, a VPS, …). Static hosting such as GitHub Pages will not work because the proxy is required.
- The server listens on `PORT` on all interfaces, which suits most PaaS hosts.
- Serve it over **HTTPS**: visitors' API keys travel from their browser to your server.
- The server is an open relay pinned to the TypeSafe API. Visitors use their own keys, so you pay nothing to TypeSafe, only compute and bandwidth. It has no rate limiting or access control; add them if you need them.
- Because visitors are asked to paste an API key, consider linking to the source so they can check what the proxy does.

## Samples

Support ticket (all three types in one call), Noul with criteria, Choice with `null` descriptions, Score, structured `state`, structured `instructions`, structured `criteria` for each of the three types, Japanese text, and an intentionally invalid request to see a 422. Some are taken verbatim from the TypeSafe docs and some were written for this demo; the explain dialog states the source of each. Samples live in the `SAMPLES` array in `index.html`.

Not covered yet: array `state`, and the multi-step patterns and cookbooks from the docs (fan-out, confidence routing, composite scoring, re-ranking, guardrails, and so on).

## Files

- `index.html` — the whole playground (markup, styles, script).
- `server.js` — static file server and API proxy.
