import nodemailer, { type Transporter } from "nodemailer";
import type { MailMessage, Mailer } from "./index";

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
}

/** Mailpit locally; Gmail in production (smtp.gmail.com, 465, secure, app password). */
export class SmtpMailer implements Mailer {
  private transport: Transporter;
  constructor(private config: SmtpConfig) {
    this.transport = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.user ? { user: config.user, pass: config.pass } : undefined,
    });
  }

  async send(message: MailMessage) {
    const info = await this.transport.sendMail({ from: this.config.from, ...message });
    return { messageId: String(info.messageId) };
  }
}

export function smtpMailerFromEnv(env: NodeJS.ProcessEnv = process.env): SmtpMailer {
  return new SmtpMailer({
    host: env.SMTP_HOST ?? "localhost",
    port: Number(env.SMTP_PORT ?? 1025),
    secure: env.SMTP_SECURE === "true",
    user: env.SMTP_USER || undefined,
    pass: env.SMTP_PASS || undefined,
    from: env.MAIL_FROM ?? "watchdogs <alerts@localhost>",
  });
}
