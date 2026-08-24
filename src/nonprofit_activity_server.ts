import { createServer, type ServerResponse } from "node:http";
import { ZodError } from "zod";
import { infrai, InfraiError } from "./infrai.js";
import { activitySchema, decideActivity, type ActivitySignals } from "./nonprofit_activity.js";

const signals: ActivitySignals = {
  count: async (name, tags, eventId) => {
    await infrai.metrics.report({ type: "counter", name, value: 1, tags }, eventId);
  },
  remindersEnabled: () => infrai.flags.is_enabled("volunteer-reminders"),
};

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readJson(request: AsyncIterable<Buffer>): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/activities") {
    sendJson(response, 404, { error: "Route not found" });
    return;
  }

  let eventId = "unparsed-request";
  try {
    const activity = activitySchema.parse(await readJson(request));
    eventId = activity.eventId;
    sendJson(response, 200, await decideActivity(activity, signals));
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      sendJson(response, 400, { error: "Invalid activity body" });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      sendJson(response, status, { error: error.code });
      return;
    }

    const exception = error instanceof Error ? error : new Error(String(error));
    await infrai.errors.capture({
      message: exception.message,
      level: "error",
      fingerprint: ["nonprofit-activity", request.url ?? "unknown"],
      exception: exception.stack ?? exception.message,
      context: { event_id: eventId },
    }, eventId);
    sendJson(response, 500, { error: "Activity processing failed" });
  }
});

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT ?? 3000);
  server.listen(port, () => console.log(`Nonprofit activity service listening on http://localhost:${port}`));
}
