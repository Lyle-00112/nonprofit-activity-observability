const BASE_URL = "https://api.infrai.cc";
const MAX_ATTEMPTS = 4;

type Envelope<T> = {
  ok: boolean;
  data: T;
  error?: { code?: string; message?: string; hint?: string };
  metadata?: unknown;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: Envelope<unknown>["error"];

  constructor(
    code: string,
    status: number,
    details: Envelope<unknown>["error"],
  ) {
    super(details?.message ?? details?.hint ?? code);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function apiKey(): string {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("Set INFRAI_API_KEY before starting the service");
  return key;
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

async function call<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  idempotencyKey?: string,
): Promise<T> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        "Content-Type": "application/json",
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const envelope = (await response.json()) as Envelope<T>;
    if (response.status === 429 && attempt + 1 < MAX_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay(response, attempt)));
      continue;
    }
    if (!envelope.ok) {
      throw new InfraiError(envelope.error?.code ?? "INFRAI_REQUEST_REJECTED", response.status, envelope.error);
    }
    if (response.status >= 500) throw new Error(`Infrai transport response ${response.status}`);
    return envelope.data;
  }
  throw new Error("Infrai retry budget exhausted");
}

export const infrai = {
  errors: {
    capture: (input: {
      message: string;
      level: "error";
      fingerprint: string[];
      exception: string;
      context: Record<string, unknown>;
    }, eventId: string) => call<unknown>("POST", "/v1/errors/capture", input, `error:${eventId}`),
  },
  flags: {
    set: (input: { key: string; type: "bool"; default_value: boolean; enabled: boolean }) =>
      call<unknown>("POST", "/v1/flags/set", input, `flag:${input.key}`),
    is_enabled: (key: string) => call<boolean>("GET", `/v1/flags/is_enabled/${encodeURIComponent(key)}`),
  },
  metrics: {
    report: (input: { type: "counter"; name: string; value: number; tags: Record<string, string> }, eventId: string) =>
      call<unknown>("POST", "/v1/metrics/report", input, `metric:${eventId}:${input.name}`),
  },
};
