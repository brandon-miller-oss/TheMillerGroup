// Shared helpers for the server functions: Supabase access, agent check, email, templates.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // server only
const RESEND_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM;                 // an address on a domain verified in Resend
const EMAIL_FOOTER = process.env.EMAIL_FOOTER || "";       // brokerage name and mailing address
const ORIGINS = (process.env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);

function cors(req, res, methods = "POST, OPTIONS") {
  const origin = req.headers.origin;
  if (origin && ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Methods", methods);
  }
}

// Returns the caller's user id when Supabase says they are an agent or the broker.
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

// Service-role reads and writes on the docs table (bypass row rules; server only).
const svc = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };
async function docs(query) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/docs?select=path,data&${query}`, { headers: svc });
  if (!r.ok) throw new Error(`Supabase ${r.status}`);
  return r.json();
}
async function putDoc(path, data) {
  const parent = path.split("/").slice(0, -1).join("/");
  const r = await fetch(`${SUPABASE_URL}/rest/v1/docs`, {
    method: "POST", headers: { ...svc, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ path, parent, data, updated_at: new Date().toISOString() })
  });
  if (!r.ok) throw new Error(`Supabase write ${r.status}`);
}
async function profile(uid) {
  const rows = await docs(`path=eq.${encodeURIComponent("team/" + uid)}`);
  return (rows[0] && rows[0].data) || {};
}

const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;
async function sendEmail({ to, subject, text, fromName, replyTo }) {
  if (!RESEND_KEY || !EMAIL_FROM) throw new Error("Email isn’t set up on the server yet.");
  if (!EMAIL_RE.test(to || "")) throw new Error("That email address doesn’t look right.");
  const clean = s => String(s || "").replace(/[\r\n<>"]/g, " ").trim().slice(0, 80);
  const footer = `\n\n—\n${EMAIL_FOOTER ? EMAIL_FOOTER + "\n" : ""}If you’d rather not get these emails, just reply and let me know.`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: `${clean(fromName) || "The Miller Group"} <${EMAIL_FROM}>`, to: [to], subject: String(subject).slice(0, 200), text: String(text).slice(0, 20000) + footer, ...(EMAIL_RE.test(replyTo || "") ? { reply_to: replyTo } : {}) })
  });
  if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.message || `Email service returned ${r.status}`); }
  return true;
}

// Same defaults as the app (search/office.js).
const DEFAULT_TEMPLATES = {
  anniversary: { subject: "Happy home anniversary, {first_name}!", body: "Hi {first_name},\n\nIt’s been {years} since you got the keys to {address}. I hope it’s been a great home.\n\nIf you ever want to know what it’s worth today, or have questions about projects or refinancing, I’m always happy to help.\n\n{agent_name}" },
  birthday: { subject: "Happy birthday, {first_name}!", body: "Hi {first_name},\n\nWishing you a happy birthday and a great year ahead.\n\n{agent_name}" }
};
const fill = (s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => v[k] ?? "");

module.exports = { cors, agentId, docs, putDoc, profile, sendEmail, DEFAULT_TEMPLATES, fill, EMAIL_RE };
