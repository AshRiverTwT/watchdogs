export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Minimal black/lime shell shared by all emails; full templates arrive in slice 5. */
export function layout(opts: { heading: string; body: string; cta?: { label: string; url: string }; footer?: string }) {
  const cta = opts.cta
    ? `<p style="margin:28px 0"><a href="${escapeHtml(opts.cta.url)}" style="background:#c5e348;color:#000;padding:14px 24px;border-radius:30px 0;font-weight:700;font-style:italic;text-transform:uppercase;text-decoration:none;display:inline-block">${escapeHtml(opts.cta.label)}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#000;color:#fff;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:32px 20px">
<p style="font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#c5e348;margin:0 0 24px">watchdogs</p>
<h1 style="font-size:26px;text-transform:uppercase;margin:0 0 16px">${escapeHtml(opts.heading)}</h1>
<div style="font-size:16px;line-height:24px">${opts.body}</div>
${cta}
<p style="font-size:13px;color:#9aa1a9;border-top:1px solid #333;padding-top:16px;margin-top:32px">${opts.footer ?? "You got this email because of an action on your watchdogs account."}</p>
</div></body></html>`;
}
