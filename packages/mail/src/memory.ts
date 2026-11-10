import type { MailMessage, Mailer } from "./index";

/** Collects messages in memory; used by tests. */
export class MemoryMailer implements Mailer {
  readonly sent: MailMessage[] = [];
  async send(message: MailMessage) {
    this.sent.push(message);
    return { messageId: `memory-${this.sent.length}` };
  }
  last(): MailMessage | undefined {
    return this.sent.at(-1);
  }
}
