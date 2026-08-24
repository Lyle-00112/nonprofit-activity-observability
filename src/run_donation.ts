const response = await fetch("http://localhost:3000/activities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "donation", eventId: "evt-demo-001", donationId: "don-demo-001", campaignId: "school-library", donorEmail: "builder@example.org", amountCents: 4500, receiptRequested: true }) });
console.log(await response.json());
export {};
