// Go/no-go: can a normal Chromium on this machine load a BookMyShow page?
// Usage: node check.mjs [url]   (HEADED=1 to show the window, e.g. under Xvfb)
// No stealth, no proxies, no CAPTCHA solving: it reports what a plain browser sees.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const url = process.argv[2] ?? "https://in.bookmyshow.com/explore/movies-hyderabad";
const outDir = join(import.meta.dirname, "out");
const profileDir = join(import.meta.dirname, ".browser-profile");
mkdirSync(outDir, { recursive: true });

const CHALLENGE = [/just a moment/i, /verify you are human/i, /cf-challenge|challenge-platform/i, /captcha/i, /checking your browser/i];
const BLOCKED = [/access denied/i, /request blocked/i, /you don't have permission/i, /error 1020/i, /reference #\d/i];
const CONTENT = [/book tickets/i, /movies in hyderabad/i, /now showing/i, /showtimes?/i];

const started = Date.now();
const ctx = await chromium.launchPersistentContext(profileDir, {
  headless: process.env.HEADED !== "1",
  viewport: { width: 1366, height: 900 },
  locale: "en-IN",
  timezoneId: "Asia/Kolkata",
});
const page = ctx.pages()[0] ?? (await ctx.newPage());

let httpStatus = null;
let navError = null;
try {
  const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
  httpStatus = res?.status() ?? null;
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
} catch (err) {
  navError = String(err?.message ?? err).split("\n")[0];
}

const title = await page.title().catch(() => "");
const text = await page.evaluate(() => document.body?.innerText ?? "").catch(() => "");
const haystack = `${title}\n${text.slice(0, 20_000)}`;
const has = (list) => list.some((re) => re.test(haystack));

let verdict;
if (navError) verdict = "error";
else if (has(BLOCKED) || httpStatus === 403 || httpStatus === 429) verdict = "blocked";
else if (has(CHALLENGE)) verdict = "challenged";
else if (has(CONTENT) && text.length > 500) verdict = "rendered";
else verdict = "unclear";

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const shot = join(outDir, `check-${stamp}.png`);
await page.screenshot({ path: shot, fullPage: false }).catch(() => {});

const report = {
  verdict,
  url,
  finalUrl: page.url(),
  httpStatus,
  title,
  textLength: text.length,
  navError,
  ms: Date.now() - started,
  screenshot: shot,
  at: new Date().toISOString(),
};
writeFileSync(join(outDir, `check-${stamp}.json`), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log(
  {
    rendered: "GO: the EC2 browser source can be the default.",
    challenged: "MAYBE: re-run with HEADED=1 under Xvfb/noVNC, clear it by hand once, then run again.",
    blocked: "NO-GO from this IP: plan on the laptop collector.",
    error: "Navigation failed: check DNS/outbound HTTPS, then retry.",
    unclear: "Look at the screenshot and send me the JSON.",
  }[verdict],
);
await ctx.close();
process.exit(verdict === "rendered" ? 0 : 1);
