export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  headers?: Record<string, string>;
}

/** Nodemailer SMTP adapter (Mailpit locally, Gmail in production) lands in slice 5. */
export interface Mailer {
  send(message: MailMessage): Promise<{ messageId: string }>;
}
