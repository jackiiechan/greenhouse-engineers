# Greenhouse Engineers Dashboard — AI Setup Guide

This connects the in-app AI (identify plant, find ranges, growth plan) safely. Your
Anthropic API key lives **only** on a small free Cloudflare Worker — never in the
dashboard the students open. Total time: ~15 minutes, one-time.

## What you'll end up with
- **worker.js** → deployed to Cloudflare (holds your key as a secret)
- **greenhouse-engineers-dashboard.html** → opens on student laptops, calls your Worker
- Two secrets you create: your **API key** and a **class passphrase**

---

## Part 1 — Get an Anthropic API key
1. Go to **console.anthropic.com** → sign in.
2. **Billing** → add a payment method and a small amount of credit. (This is pay-per-use and separate from any free Claude chat. A class's worth of calls is typically a few dollars — see Costs below.)
3. **API Keys** → **Create Key** → copy it. Keep it private; treat it like a password.

## Part 2 — Deploy the Worker
You can do this in the browser, no install needed.
1. Go to **dash.cloudflare.com** → sign up / log in (free).
2. Left sidebar → **Workers & Pages** → **Create** → **Create Worker**.
3. Give it a name (e.g. `greenhouse-ai`) → **Deploy** (it deploys a placeholder).
4. Click **Edit code**. Delete the sample, paste in the entire contents of **worker.js**, then **Deploy**.
5. Copy your Worker URL — it looks like `https://greenhouse-ai.YOURNAME.workers.dev`.

## Part 3 — Add the two secrets
In your Worker → **Settings** → **Variables and Secrets** → add two **Secret** (encrypted) variables:

| Name | Value |
|------|-------|
| `ANTHROPIC_API_KEY` | the key you copied in Part 1 |
| `APP_TOKEN` | a class passphrase you invent, e.g. `greenhouse-2026-purple-fern` |

Click **Deploy** again so the secrets take effect.

## Part 4 — Point the dashboard at your Worker
Open **greenhouse-engineers-dashboard.html** in any text editor. Near the top of the
script you'll see a CONFIG block. Set both values:

```js
const PROXY_URL = "https://greenhouse-ai.YOURNAME.workers.dev"; // your Worker URL
const APP_TOKEN = "greenhouse-2026-purple-fern";                // EXACTLY matches the Worker secret
```

Save. That's it — the AI features now work wherever the file is opened (a student
laptop, or hosted on GitHub Pages).

---

## Test it
1. Open the dashboard → **Mystery Plant** tab.
2. Upload a plant photo → **Identify this plant**. You should get a name back.
3. **Find the healthy ranges** → **Generate growth plan** should both work.

If you get an error:
- **401 / Unauthorized** → `APP_TOKEN` in the HTML doesn't match the Worker secret exactly.
- **"Set PROXY_URL…"** → you didn't paste your Worker URL into the HTML.
- **500 missing key** → `ANTHROPIC_API_KEY` secret isn't set, or you didn't re-deploy after adding it.

---

## Costs & safety (read once)
- **It's pay-per-use.** Identify + ranges + plan for one plant is a handful of calls. For a 4–6 student cohort, expect a few dollars total. Set a low billing limit in the Anthropic console so it can never surprise you.
- **The passphrase stops casual abuse, not a determined student.** It's readable in the page source, so a motivated kid could find it. That's fine for a classroom — just:
  - keep a **low credit balance / billing cap** on the Anthropic account, and
  - **rotate** the API key and `APP_TOKEN` between cohorts (or if usage looks weird).
- **Never put the API key in the HTML or in GitHub.** Only the Worker holds it. The dashboard only ever holds the Worker URL and the passphrase.
- **Watch usage** in the Anthropic console during the workshop.

## What changed in the dashboard (vs. the version your group built)
- `callClaude()` now calls your Worker (with the `x-app-token` header) instead of calling Anthropic directly — which a browser blocks and which would have exposed your key.
- Data now saves to the browser's `localStorage`, so a student's week survives a refresh. (The previous `window.storage` call silently did nothing in a normal browser.)
