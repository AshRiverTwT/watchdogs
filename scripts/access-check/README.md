# BMS access check (slice 0)

Run once on the EC2 instance (and optionally on your laptop to compare).
It needs only Node 20+ and Playwright, not the rest of the repo.

```bash
cd scripts/access-check
npm install
npx playwright install --with-deps chromium
node check.mjs
# optional: a specific buytickets page
node check.mjs "https://in.bookmyshow.com/buytickets/<movie-slug>-hyderabad/movie-hyd-ET00XXXXXX-MT/20261115"
```

To test the headed path the live adapter will use:

```bash
sudo apt-get install -y xvfb
HEADED=1 xvfb-run -a node check.mjs
```

Output: a JSON report on stdout plus `out/check-*.json` and a screenshot.
Verdicts: `rendered` (go), `challenged` (human clears it once via noVNC),
`blocked` (use the laptop collector), `error`, `unclear`.
Send back the JSON (and the screenshot if the verdict is not `rendered`).
