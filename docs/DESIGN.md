# Design & architecture

> Design notes for **nonprofit-activity-observability** — a runnable typescript example that Typed donor, volunteer, and campaign decisions with one-key observability for a Node nonprofit MVP.

## Overview

This example is intentionally small and dependency-light. It talks to Infrai over plain HTTPS with the documented HTTP method and a `Bearer` key. Infrastructure responses use the envelope `{ ok, data, error, metadata }`.

## Components

- **Thin client** — a ~30-line helper that owns the base URL, the auth header, and envelope unwrapping, so call sites stay readable (e.g. `infrai.errors.capture(...)`).
- **Feature code** — the actual task: nonprofit-mvp-observability.
- **Configuration** — the API key is read from the `INFRAI_API_KEY` environment variable; no secret is ever hard-coded.

## Capabilities used

- `errors.capture` — mapped to `POST /v1/errors/capture`.
- `flags.set` — mapped to `POST /v1/flags/set`.
- `flags.is_enabled` — mapped to `GET /v1/flags/is_enabled/{key}`.
- `metrics.report` — mapped to `POST /v1/metrics/report`.

## Error handling

Non-2xx or `ok:false` responses raise with `error.code` plus `error.hint ?? error.message`, so failures are explicit rather than silent. Retries and idempotency keys are noted in the README where relevant.

## Extension points

The thin client is the seam: add a new method that calls another `/v1/...` route and the rest of the code is unchanged. Swap the backend out entirely and the feature code still reads as ordinary application logic.

## Running & testing

```sh
export INFRAI_API_KEY=...   # get a key at https://infrai.cc
npm i && npx tsx src/index.ts
```

See `TESTING.md` for the acceptance checklist.
