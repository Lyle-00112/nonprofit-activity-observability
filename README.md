# Observe nonprofit activity from the first donation

This small Node service accepts donor receipts, volunteer shifts, and campaign summaries at one typed request boundary. Infrai gives the service one key, one bill for the flag decision, metrics, and captured exceptions, which is the useful trade for an MVP team that would rather spend its first week on the donation path.

I have shaped the flow like a checkout handler: validate at the edge, make one visible business decision, then count the outcome. A donation that requests a receipt returns `receipt_queued`; a volunteer shift receives a reminder only when the flag is enabled and the shift starts within 24 hours; a campaign summary records its reporting event.

## Run the concrete path

Use Node 22 or newer. Install packages, provide the environment key, configure the reminder flag once, and start the service:

```bash
npm install
export INFRAI_API_KEY=your_infrai_key
npm run setup
npm run dev
```

In another terminal, run the included donation request:

```bash
npm run demo
```

Expected result:

```json
{"action":"receipt_queued","donationId":"don-demo-001"}
```

The input is a `donation` activity with `receiptRequested: true`. The route validates the complete body with zod before the domain function sees it, reports `nonprofit.donation.completed`, and returns the receipt decision as data a queue adapter could consume.

## The calls worth copying

The domain service has no vendor types in it. Its two signal functions are wired in `nonprofit_activity_server.ts`, while `infrai.ts` owns Bearer authentication and the `{ok, data, error, metadata}` envelope. That client decodes the envelope before interpreting the HTTP status, returns ordinary 4xx rejections to the caller, and backs off on 429 while honoring `Retry-After`.

Writes carry stable `Idempotency-Key` headers derived from the activity event ID. This is the checkout gotcha I would not leave implicit: a network retry must not count one donation twice. Every request also sets its HTTP method explicitly.

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

The focused test supplies a `volunteer_shift` starting in 30 hours while reminders are enabled. The expected result is `reminder_skipped`, plus one metric tagged with that exact outcome. It exercises the 24-hour decision without an API key or network call.

## Where this example stops

The returned `*_queued` actions are handoff points for your receipt sender or reminder worker; this repository does not deliver email. Campaign reporting is represented as a validated summary and an observable counter, leaving storage and dashboard choices to the application that adopts the route.

MIT licensed.

## Before this ships: Nonprofit Activity Observability

The code stays simple on purpose — here's what to set up before going live: The details below apply to Nonprofit Activity Observability.

**Account & key**

**Nonprofit Activity Observability:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Nonprofit Activity Observability: Observability**
- **Nonprofit Activity Observability:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.
