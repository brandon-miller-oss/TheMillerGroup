// Sends one follow-up email for a signed-in agent, from the brokerage address with the agent as reply-to.
const { cors, agentId, profile, sendEmail } = require("../lib/common");

const sent = new Map();
function limited(id) {
  const now = Date.now(), list = (sent.get(id) || []).filter(t => now - t < 3600000);
  list.push(now); sent.set(id, list);
  return list.length > 60;
}

module.exports = async function handler(req, res) {
  cors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const uid = await agentId(token).catch(() => null);
  if (!uid) return res.status(403).json({ error: "Only signed-in agents can send email." });
  if (limited(uid)) return res.status(429).json({ error: "That’s a lot of email in an hour. Try again later." });
  const { to, subject, text, attachments } = req.body || {};
  if (!to || !subject || !text) return res.status(400).json({ error: "Add a recipient, subject, and message." });
  // Only PDFs (the CMA report), at most 3, about 3 MB total.
  let files = [];
  if (Array.isArray(attachments) && attachments.length) {
    files = attachments.slice(0, 3).map(a => ({ filename: String(a.filename || "report.pdf").replace(/[^\w.\- ]+/g, "_").slice(0, 120), content: String(a.content || "") }));
    const total = files.reduce((t, f) => t + f.content.length, 0);
    if (files.some(f => !/\.pdf$/i.test(f.filename) || !/^[A-Za-z0-9+/=]+$/.test(f.content) || !f.content.startsWith("JVBER"))) return res.status(400).json({ error: "Only PDF attachments can be sent." });
    if (total > 4000000) return res.status(413).json({ error: "That attachment is too large to email." });
  }
  try {
    const p = await profile(uid);
    await sendEmail({ to, subject, text, fromName: p.name, replyTo: p.email, attachments: files });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(502).json({ error: e.message || "That didn’t send." });
  }
};
