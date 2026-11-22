/**
 * SMS adapter interface — same reasoning as the email and eTapestry
 * adapters: nothing else in this app should know which provider sends a
 * text, or how. No real provider is wired in by default; set
 * TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER to turn on
 * TwilioSmsAdapter (src/lib/sms/twilio-adapter.ts). Until then, and in
 * every test, FakeSmsAdapter stands in.
 */

export interface SendSmsInput {
  to: string;
  body: string;
}

export type SendSmsResult = { ok: true; messageId: string } | { ok: false; error: string };

export interface SmsAdapter {
  sendSms(input: SendSmsInput): Promise<SendSmsResult>;
}
