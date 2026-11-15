// Agent newsletters: send a test to yourself, or send an issue to your contact list.
const { cors, agentId, docs } = require("../lib/common");
const NL = require("../lib/newsletter");
const sends = new Map();
const limited = id => { const now = Date.now(), l = (sends.get(id) || []).filter(t => now - t < 3600000); l.push(now); sends.set(id, l); return l.length > 10; };
const clean = v => JSON.parse(JSON.stringify(v || {}));
module.exports = async function handler(req, res) {
  cors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
  const uid = await agentId((req.headers.authorization || "").replace(/^Bearer\s+/i, "")).catch(() => null);
  if (!uid) return res.status(403).json({ error: "Only signed-in agents can send newsletters." });
  const b = req.body || {};
  if (!["test", "send", "count"].includes(b.action)) return res.status(400).json({ error: "Unknown action." });
  try {
    if (b.action === "count") return res.status(200).json({ recipients: (await NL.recipients(uid, b.audience)).length });
    if (limited(uid)) return res.status(429).json({ error: "Too many sends this hour." });
    const s = await docs(`path=eq.${encodeURIComponent(`agent/${uid}/settings`)}`), address = ((((s[0] || {}).data || {}).newsletter) || {}).address || "";
    const issue = clean(b.issue); delete issue.address; delete issue.license;    // the footer comes from the server
    const out = await NL.sendIssue(uid, issue, b.audience, { test: b.action === "test", address, issueId: /^[A-Za-z0-9_-]{1,60}$/.test(b.issueId || "") ? b.issueId : "" });
    return res.status(200).json(out);
  } catch (e) { return res.status(e.status || 502).json({ error: e.message || "That didn’t send." }); }
};
