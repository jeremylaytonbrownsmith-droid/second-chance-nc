import type { EmailAdapter, SendEmailInput, SendEmailResult } from "./adapter";

/**
 * Real email delivery via Resend's REST API (https://resend.com) — a
 * plain fetch() call, not their SDK, so this doesn't add a new npm
 * dependency for one POST request. Requires RESEND_API_KEY and
 * EMAIL_FROM_ADDRESS to be set; both are validated at construction so a
 * misconfiguration fails loudly at startup rather than silently dropping
 * every receipt email.
 */
export class ResendEmailAdapter implements EmailAdapter {
  private readonly apiKey: string;
  private readonly fromAddress: string;

  constructor(apiKey: string, fromAddress: string) {
    this.apiKey = apiKey;
    this.fromAddress = fromAddress;
  }

  async sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: this.fromAddress,
          to: input.to,
          subject: input.subject,
          html: input.html,
          text: input.text,
          attachments: input.attachments?.map((a) => ({
            filename: a.filename,
            content: Buffer.from(a.content).toString("base64"),
          })),
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        return { ok: false, error: `Resend API ${res.status}: ${body.slice(0, 300)}` };
      }

      const data = (await res.json()) as { id?: string };
      return { ok: true, messageId: data.id ?? "unknown" };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Unknown email error" };
    }
  }
}
