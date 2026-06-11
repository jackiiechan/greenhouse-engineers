/* ============================================================================
   Greenhouse Engineers — Anthropic API proxy (Cloudflare Worker)

   WHY THIS EXISTS
   A student's dashboard runs in a browser and must NOT contain your API key.
   This Worker sits in the middle: the dashboard calls THIS Worker, the Worker
   adds your secret key and forwards the request to Anthropic, then returns the
   answer. Your key lives only here, as an encrypted Worker secret.

   SET TWO SECRETS AFTER DEPLOY (see DEPLOY_GUIDE.md):
     ANTHROPIC_API_KEY  = your real Anthropic API key   (never shared)
     APP_TOKEN          = a class passphrase             (matches the dashboard)

   The dashboard sends APP_TOKEN in the "x-app-token" header. Requests without
   the right token are rejected, so random internet traffic can't spend your
   tokens. (A determined student could read the passphrase from the page — this
   stops casual abuse, not a motivated attacker. Watch your usage dashboard and
   rotate the key/token if needed.)
   ============================================================================ */

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MAX_TOKENS_CAP = 2000;          // hard ceiling to limit per-call cost
const MAX_BODY_BYTES = 6 * 1024 * 1024; // ~6 MB, enough for a photo + prompt

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-app-token",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");

    // Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405, origin);
    }

    // Make sure the server is configured
    if (!env.ANTHROPIC_API_KEY) {
      return json({ error: "Server missing ANTHROPIC_API_KEY secret" }, 500, origin);
    }

    // Gate on the shared class passphrase
    if (!env.APP_TOKEN || request.headers.get("x-app-token") !== env.APP_TOKEN) {
      return json({ error: "Unauthorized" }, 401, origin);
    }

    // Read + validate body
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      return json({ error: "Request too large" }, 413, origin);
    }
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch (e) {
      return json({ error: "Invalid JSON body" }, 400, origin);
    }
    if (!Array.isArray(payload.messages)) {
      return json({ error: "Body must include a messages array" }, 400, origin);
    }

    // Build a sanitized request — never trust the client for limits
    const body = {
      model: typeof payload.model === "string" ? payload.model : "claude-sonnet-4-20250514",
      max_tokens: Math.min(Number(payload.max_tokens) || 1024, MAX_TOKENS_CAP),
      messages: payload.messages,
    };

    // Forward to Anthropic with the secret key attached here on the server
    let upstream;
    try {
      upstream = await fetch(ANTHROPIC_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body: JSON.stringify(body),
      });
    } catch (e) {
      return json({ error: "Upstream request failed" }, 502, origin);
    }

    // Pass Anthropic's response straight back (with CORS so the browser accepts it)
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  },
};
