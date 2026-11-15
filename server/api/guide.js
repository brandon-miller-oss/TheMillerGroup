// The Miller Group — the client's transaction guide.
// POST { dealId, question } with the client's sign-in token.
// Reads only the client's own shared copy (boards/<client>/deal/<id>), asks Claude to explain,
// saves the question and answer to boards/<client>/guide/<id> where their agent sees it.
const { cors, userId, docs, putDoc } = require("../lib/common");
const AI = require("../lib/claude");
const DG = require("../lib/deal-guide");

const ID_OK = /^[A-Za-z0-9_\-]{1,64}$/;
const hits = new Map();
// 15 questions an hour per client.
const limited = id => { const now = Date.now(), w = (hits.get(id) || []).filter(t => now - t < 3600000); w.push(now); hits.set(id, w); return w.length > 15; };

async function answer(uid, dealId, question, today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Denver" })) {
  const rows = await docs(`path=eq.${encodeURIComponent(`boards/${uid}/deal/${dealId}`)}`);
  const shared = rows[0] && rows[0].data;
  if (!shared) { const e = new Error("That transaction isn’t shared with you."); e.status = 404; throw e; }
  const past = (await docs(`parent=eq.${encodeURIComponent(`boards/${uid}/guide`)}`)).map(r => r.data).filter(x => x && x.dealId === dealId).sort((a, b) => (a.at || "").localeCompare(b.at || ""));
  const reply = await AI.ask(DG.prompt(shared, question, past, today), { maxTokens: 700 });
  let out; try { out = AI.json(reply); } catch (e) { out = { answer: String(reply || "").trim(), forAgent: true }; }
  const a = String(out.answer || "").trim().slice(0, 2000) || `I couldn’t answer that one, so I’ve flagged it for ${shared.agent && shared.agent.name || "your agent"}.`;
  const item = { dealId, q: question, a, forAgent: !!out.forAgent || !out.answer, at: new Date().toISOString() };
  const id = "q" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  await putDoc(`boards/${uid}/guide/${id}`, item);
  return { id, item };
}

module.exports = async function handler(req, res) {
  cors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
  if (!AI.ready()) return res.status(500).json({ error: "The guide isn’t set up yet." });
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const uid = await userId(token).catch(() => null);
  if (!uid) return res.status(401).json({ error: "Sign in to ask the guide." });
  const b = req.body || {}, dealId = String(b.dealId || ""), question = String(b.question || "").trim();
  if (!ID_OK.test(dealId) || question.length < 3) return res.status(400).json({ error: "Ask a question about your transaction." });
  if (question.length > 1500) return res.status(400).json({ error: "Keep it under 1,500 characters." });
  if (limited(uid)) return res.status(429).json({ error: "That’s a lot of questions for one hour. Your agent can help directly." });
  try { return res.status(200).json(await answer(uid, dealId, question)); }
  catch (e) { console.error("Guide failed", e.message); return res.status(e.status || 502).json({ error: e.status ? e.message : "The guide didn’t answer. Try again in a minute." }); }
};
module.exports.answer = answer;
