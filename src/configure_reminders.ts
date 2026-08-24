import { infrai } from "./infrai.js";

await infrai.flags.set({
  key: "volunteer-reminders",
  type: "bool",
  default_value: true,
  enabled: true,
});

console.log("Volunteer reminder flag configured");
