export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  headers?: Record<string, string>;
}

export interface Mailer {
  send(message: MailMessage): Promise<{ messageId: string }>;
}

import { ConsoleMailer } from "./console";
import { smtpMailerFromEnv } from "./smtp";

/** MAIL_TRANSPORT=console prints emails instead of sending them (dev without Mailpit). */
export function mailerFromEnv(env: NodeJS.ProcessEnv = process.env): Mailer {
  return env.MAIL_TRANSPORT === "console" ? new ConsoleMailer() : smtpMailerFromEnv(env);
}

export { SmtpMailer, smtpMailerFromEnv } from "./smtp";
export { MemoryMailer } from "./memory";
export { ConsoleMailer } from "./console";
export { layout, escapeHtml } from "./layout";
