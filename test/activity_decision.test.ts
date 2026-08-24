import assert from "node:assert/strict";
import test from "node:test";
import { decideActivity, type ActivitySignals } from "../src/nonprofit_activity.js";

test("a volunteer shift outside the 24-hour window skips its reminder", async () => {
  const counted: Array<{ name: string; tags: Record<string, string> }> = [];
  const signals: ActivitySignals = {
    remindersEnabled: async () => true,
    count: async (name, tags) => {
      counted.push({ name, tags });
    },
  };

  const result = await decideActivity({
    kind: "volunteer_shift",
    eventId: "evt-shift-101",
    shiftId: "shift-101",
    volunteerId: "vol-8",
    hoursUntilStart: 30,
  }, signals);

  assert.deepEqual(result, { action: "reminder_skipped", shiftId: "shift-101" });
  assert.deepEqual(counted, [{
    name: "nonprofit.volunteer_reminder.decided",
    tags: { outcome: "reminder_skipped" },
  }]);
});
