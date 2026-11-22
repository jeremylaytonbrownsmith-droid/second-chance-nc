/**
 * Email adapter interface, same reasoning as src/lib/etapestry/adapter.ts:
 * nothing else in this app should know which provider sends mail, or how.
 * Swapping providers later means writing a new adapter, not touching every
 * call site. No real provider is wired in by default — set RESEND_API_KEY
 * to turn on ResendEmailAdapter (src/lib/email/resend-adapter.ts); until
 * then, and in every test, FakeEmailAdapter stands in.
 */

export interface EmailAttachment {
  filename: string;
  content: Uint8Array;
  contentType: string;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: EmailAttachment[];
}

export type SendEmailResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string };

export interface EmailAdapter {
  sendEmail(input: SendEmailInput): Promise<SendEmailResult>;
}
