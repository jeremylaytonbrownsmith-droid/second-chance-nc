import type { SmsAdapter, SendSmsInput, SendSmsResult } from "./adapter";

/**
 * Real SMS delivery via Twilio's REST API — a plain fetch(), not their
 * SDK, same reasoning as the Resend email adapter: one POST request
 * doesn't justify a new npm dependency.
 */
export class TwilioSmsAdapter implements SmsAdapter {
  constructor(
    private readonly accountSid: string,
    private readonly authToken: string,
    private readonly fromNumber: string,
  ) {}

  async sendSms(input: SendSmsInput): Promise<SendSmsResult> {
    try {
      const body = new URLSearchParams({ To: input.to, From: this.fromNumber, Body: input.body });
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body,
        },
      );

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return { ok: false, error: `Twilio API ${res.status}: ${text.slice(0, 300)}` };
      }

      const data = (await res.json()) as { sid?: string };
      return { ok: true, messageId: data.sid ?? "unknown" };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Unknown SMS error" };
    }
  }
}
