import type { MailMessage, Mailer } from "./index";

/** Prints emails to stdout; for local dev without Mailpit. */
export class ConsoleMailer implements Mailer {
  private n = 0;
  async send(message: MailMessage) {
    this.n += 1;
    console.log(
      `\n----- email #${this.n} -----\nTo: ${message.to}\nSubject: ${message.subject}\n\n${message.text}\n---------------------------\n`,
    );
    return { messageId: `console-${this.n}` };
  }
}
