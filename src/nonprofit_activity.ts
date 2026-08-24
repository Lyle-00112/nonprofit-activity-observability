import { z } from "zod";

const donationSchema = z.object({
  kind: z.literal("donation"),
  eventId: z.string().min(1),
  donationId: z.string().min(1),
  campaignId: z.string().min(1),
  donorEmail: z.string().email(),
  amountCents: z.number().int().positive(),
  receiptRequested: z.boolean(),
});

const volunteerShiftSchema = z.object({
  kind: z.literal("volunteer_shift"),
  eventId: z.string().min(1),
  shiftId: z.string().min(1),
  volunteerId: z.string().min(1),
  hoursUntilStart: z.number().nonnegative(),
});

const campaignReportSchema = z.object({
  kind: z.literal("campaign_report"),
  eventId: z.string().min(1),
  campaignId: z.string().min(1),
  donationsCount: z.number().int().nonnegative(),
  raisedCents: z.number().int().nonnegative(),
});

export const activitySchema = z.discriminatedUnion("kind", [
  donationSchema,
  volunteerShiftSchema,
  campaignReportSchema,
]);

export type NonprofitActivity = z.infer<typeof activitySchema>;

export type ActivityResult =
  | { action: "receipt_queued" | "receipt_skipped"; donationId: string }
  | { action: "reminder_queued" | "reminder_skipped"; shiftId: string }
  | { action: "campaign_recorded"; campaignId: string };

export type ActivitySignals = {
  count(name: string, tags: Record<string, string>, eventId: string): Promise<void>;
  remindersEnabled(): Promise<boolean>;
};

export async function decideActivity(
  activity: NonprofitActivity,
  signals: ActivitySignals,
): Promise<ActivityResult> {
  if (activity.kind === "donation") {
    const action = activity.receiptRequested ? "receipt_queued" : "receipt_skipped";
    await signals.count("nonprofit.donation.completed", {
      campaign_id: activity.campaignId,
      receipt: action,
    }, activity.eventId);
    return { action, donationId: activity.donationId };
  }

  if (activity.kind === "volunteer_shift") {
    const enabled = await signals.remindersEnabled();
    const insideReminderWindow = activity.hoursUntilStart <= 24;
    const action = enabled && insideReminderWindow ? "reminder_queued" : "reminder_skipped";
    await signals.count("nonprofit.volunteer_reminder.decided", { outcome: action }, activity.eventId);
    return { action, shiftId: activity.shiftId };
  }

  await signals.count("nonprofit.campaign.reported", {
    campaign_id: activity.campaignId,
    donation_band: activity.donationsCount === 0 ? "empty" : "active",
  }, activity.eventId);
  return { action: "campaign_recorded", campaignId: activity.campaignId };
}
