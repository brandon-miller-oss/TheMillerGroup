// The Miller Group — AI endpoint for agents (Vercel serverless function).
// Verifies the caller is a signed-in agent or the broker, then calls the Claude API.
// The page runs the tools itself and sends results back on the next call.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // server only, never in the browser
const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const MAX_BODY = 250000;
const ORIGINS = (process.env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);

const calls = new Map();
function limited(id) {
  const now = Date.now(), list = (calls.get(id) || []).filter(t => now - t < 60000);
  list.push(now); calls.set(id, list);
  return list.length > 30;
}

// Asks Supabase, as the caller, whether they are an agent (public.is_agent covers agents and the broker).
async function agentId(token) {
  if (!token) return null;
  const u = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey: SERVICE_KEY } });
  if (!u.ok) return null;
  const { id } = await u.json();
  if (!id) return null;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_agent`, {
    method: "POST", headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: "{}"
  });
  return r.ok && (await r.json()) === true ? id : null;
}

module.exports = async function handler(req, res) {
  const origin = req.headers.origin;
  if (origin && ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  }
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
  if (!SUPABASE_URL || !SERVICE_KEY || !API_KEY) return res.status(500).json({ error: "AI endpoint is not configured." });

  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const id = await agentId(token).catch(() => null);
  if (!id) return res.status(403).json({ error: "Only signed-in agents can use the assistant." });
  if (limited(id)) return res.status(429).json({ error: "Too many requests. Try again in a minute." });

  const body = req.body || {};
  if (JSON.stringify(body).length > MAX_BODY) return res.status(413).json({ error: "Request too large." });
  const messages = Array.isArray(body.messages) ? body.messages.slice(-60) : [];
  const tools = Array.isArray(body.tools) ? body.tools.slice(0, 20) : [];
  if (!messages.length) return res.status(400).json({ error: "No messages." });

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: 2000, messages, ...(tools.length ? { tools } : {}) })
    });
    const json = await r.json();
    if (!r.ok) {
      console.error("Claude API error", r.status, JSON.stringify(json).slice(0, 300));
      return res.status(502).json({ error: "The assistant is unavailable right now." });
    }
    return res.status(200).json({ content: json.content, stop_reason: json.stop_reason });
  } catch (e) {
    console.error("AI proxy failure", e);
    return res.status(502).json({ error: "The assistant is unavailable right now." });
  }
};
