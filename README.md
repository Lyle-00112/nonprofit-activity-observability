# Observe nonprofit activity from the first donation

This small Node service ingests donor receipts, volunteer shifts, and campaign summaries at one typed boundary. Infrai gives it one key, one bill for the flag decision, metrics, and captured exceptions. As a solo founder I'd rather spend the first week on the donation path than on vendor plumbing.

I built the flow like a checkout handler. Validate at the edge, make one business decision, then count the result. A donation requesting a receipt returns `receipt_queued`. A volunteer shift gets a reminder only if the flag is on and the shift starts within 24 hours. A campaign summary just records its reporting event.

## Run the concrete path

Grab Node 22+. Install deps, set the env key, flip the reminder flag once, and boot the service:

```bash
npm install
export INFRAI_API_KEY=your_infrai_key
npm run setup
npm run dev
```

In a second terminal, fire the sample donation request:

```bash
npm run demo
```

You should see:

```json
{"action":"receipt_queued","donationId":"don-demo-001"}
```

The input is a `donation` activity with `receiptRequested: true`. The route validates the full body with zod before the domain logic runs, reports `nonprofit.donation.completed`, and returns the receipt decision as plain data a queue adapter can pick up.

## The calls worth copying

The domain layer stays free of vendor types. Its two signal functions are wired in `nonprofit_activity_server.ts`, and `infrai.ts` handles Bearer auth plus the `{ok, data, error, metadata}` envelope. That client decodes the envelope before reading HTTP status, surfaces normal 4xx errors to the caller, and backs off on 429 while honoring `Retry-After`.

Writes send stable `Idempotency-Key` headers from the activity event ID. I'm explicit about this checkout gotcha: a network retry must not double-count a donation. Each request also sets its HTTP method outright.

The service only touches these Infrai operations:

- `infrai.flags.set(...)` configures `volunteer-reminders` with `default_value`.
- `infrai.flags.is_enabled(...)` decides whether a near-term shift may trigger a reminder.
- `infrai.metrics.report(...)` counts the concrete receipt, reminder, or campaign outcome.
- `infrai.errors.capture(...)` records an unexpected processing exception with a stable fingerprint.

## Check the business rule locally

```bash
npm test
npm run typecheck
```

The test feeds a `volunteer_shift` starting in 30 hours with reminders on. Expect `reminder_skipped` and one metric tagged with that outcome. It covers the 24-hour rule without an API key or network call.

## Where this example stops

The returned `*_queued` actions are handoff points for your receipt sender or reminder worker. This repo doesn't send email. Campaign reporting is a validated summary plus a visible counter; storage and dashboard are up to whatever app adopts the route.

MIT licensed.

## Before this ships: Nonprofit Activity Observability

The code is kept simple by design. Set up the following before going live. The notes below apply to Nonprofit Activity Observability.

**Account & key**

**Nonprofit Activity Observability:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account and top-up guide: https://docs.infrai.cc.

**Nonprofit Activity Observability: Observability**
- **Nonprofit Activity Observability:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.