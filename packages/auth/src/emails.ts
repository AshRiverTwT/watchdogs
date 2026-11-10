import { type MailMessage, escapeHtml, layout } from "@watchdogs/mail";

export function verifyEmail(to: string, url: string): MailMessage {
  return {
    to,
    subject: "Confirm your email for watchdogs",
    text: `Confirm your email to start creating show alerts:\n\n${url}\n\nThe link works for 24 hours. If you did not sign up, ignore this email.`,
    html: layout({
      heading: "Confirm your email",
      body: "<p>Confirm your address to start creating show alerts. The link works for 24 hours.</p>",
      cta: { label: "Confirm email", url },
      footer: "If you did not sign up for watchdogs, ignore this email.",
    }),
  };
}

export function resetEmail(to: string, url: string): MailMessage {
  return {
    to,
    subject: "Reset your watchdogs password",
    text: `Set a new password:\n\n${url}\n\nThe link works for 1 hour and signs you out everywhere. If you did not ask for this, ignore this email.`,
    html: layout({
      heading: "Reset your password",
      body: "<p>Use the button below to set a new password. The link works for 1 hour, and using it signs you out on every device.</p>",
      cta: { label: "Set new password", url },
      footer: "If you did not ask for a reset, ignore this email; your password stays the same.",
    }),
  };
}

export function accountExistsEmail(to: string, loginUrl: string, resetUrl: string): MailMessage {
  return {
    to,
    subject: "You already have a watchdogs account",
    text: `Someone tried to sign up with this address, which already has an account.\n\nSign in: ${loginUrl}\nForgot your password? ${resetUrl}`,
    html: layout({
      heading: "You already have an account",
      body: `<p>Someone tried to sign up with this address, which already has an account.</p><p>Forgot your password? <a style="color:#c5e348" href="${escapeHtml(resetUrl)}">Reset it here</a>.</p>`,
      cta: { label: "Sign in", url: loginUrl },
      footer: "If this was not you, no action is needed.",
    }),
  };
}
