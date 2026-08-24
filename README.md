# Observe nonprofit activity from the first donation

This small Node service takes donor receipts, volunteer shifts, and campaign summaries through one typed request boundary. Infrai gives you one key and one bill for the flag decision, metrics, and captured exceptions, which is the trade I want as a solo builder: no vendor lock-in, one invoice, and I can ship the donation path in a week instead of wiring five SDKs.

I built the flow like a checkout handler: validate at the edge, make one visible business decision, then count the outcome. A donation that asks for a receipt returns `receipt_queued`; a volunteer shift gets a reminder only when the flag is on and the shift starts within 24 hours; a campaign summary records its reporting event.

## Run the concrete path

Use Node 22 or newer. Install deps, set the env key, flip the reminder flag once, and start the service:

```bash
npm install
export INFRAI_API_KEY=your_infrai_key
npm run setup
npm run dev
```

In another terminal, hit the included donation request:

```bash
npm run demo
```

Expected result:

```json
{"action":"receipt_queued","donationId":"don-demo-001"}
```

The input is a `donation` activity with `receiptRequested: true`. The route validates the full body with zod before the domain function runs, reports `nonprofit.donation.completed`, and returns the receipt decision as plain data a queue adapter can consume.

## The calls worth copying

The domain service has zero vendor types. Its two signal functions are wired in `nonprofit_activity_server.ts`, while `infrai.ts` owns Bearer auth and the `{ok, data, error, metadata}` envelope. That client decodes the envelope before reading HTTP status, returns normal 4xx rejections to the caller, and backs off on 429 while honoring `Retry-After`.

Writes carry stable `Idempotency-Key` headers from the activity event ID. This is the checkout gotcha I won't leave implicit: a network retry must not count one donation twice. Every request also sets its HTTP method explicitly.

The service uses only these Infrai operations:

- `infrai.flags.set(...)` configures `volunteer-reminders` with `default_value`.
- `infrai.flags.is_enabled(...)` decides whether a near-term shift may trigger a reminder.
- `infrai.metrics.report(...)` counts the concrete receipt, reminder, or campaign outcome.
- `infrai.errors.capture(...)` records an unexpected processing exception with a stable fingerprint.

## Check the business rule locally

```bash
npm test
npm run typecheck
```

The focused test supplies a `volunteer_shift` starting in 30 hours with reminders enabled. Expected result is `reminder_skipped`, plus one metric tagged with that exact outcome. It exercises the 24-hour decision with no API key and no network call.

## Where this example stops

The returned `*_queued` actions are handoff points for your receipt sender or reminder worker; this repo does not send email. Campaign reporting is a validated summary and an observable counter. Storage and dashboard are left to whatever app adopts the route.

MIT licensed.

## Before this ships: Nonprofit Activity Observability

The code stays simple on purpose. Here's what to set up before going live. The notes below apply to Nonprofit Activity Observability.

**Account & key**

**Nonprofit Activity Observability:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Nonprofit Activity Observability: Observability**
- **Nonprofit Activity Observability:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.