// Weekly Colorado real estate news for the broker's News desk. Claude searches the web and writes
// short original summaries with links; items arrive as "suggested" until the broker approves them.
const { cors, agentId, isBroker, docs, putDoc } = require("../lib/common");
const claude = require("../lib/claude");
const newId = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
async function findNews(today) {
  const existing = await docs(`parent=eq.${encodeURIComponent("company/news/items")}`), seen = new Set(existing.map(r => (r.data || {}).url));
  const text = await claude.ask(`Find the most important Colorado residential real estate news from the past 14 days (today is ${today}): Denver metro and Front Range market reports, mortgage rates, Colorado housing laws and policy, new developments, property taxes, and anything Colorado homeowners, buyers, or sellers should know.
Prefer reputable sources (Colorado Association of REALTORS, DMAR, REcolorado, Colorado Division of Real Estate, Denver Post, Colorado Sun, BusinessDen, Denver Business Journal, Freddie Mac, local government sites).
Return 6 to 8 items as JSON only: [{"title": headline in your own words (under 90 characters), "source": publication name, "url": the article URL, "date": "YYYY-MM-DD", "summary": 1 or 2 sentences in your own words (under 45 words), never copied text, factual and neutral, "tags": ["Denver", "rates", ...]}]`, { search: true, maxUses: 8, maxTokens: 4000 });
  const items = claude.json(text);
  let added = 0;
  for (const x of (Array.isArray(items) ? items : []).slice(0, 10)) {
    if (!x || !/^https:\/\//.test(x.url || "") || seen.has(x.url) || !x.title || !x.summary) continue;
    await putDoc(`company/news/items/${newId("nw")}`, { title: String(x.title).slice(0, 140), source: String(x.source || "").slice(0, 80), url: String(x.url).slice(0, 500), date: /^\d{4}-\d{2}-\d{2}$/.test(x.date || "") ? x.date : today, summary: String(x.summary).slice(0, 400), tags: (x.tags || []).slice(0, 6).map(t => String(t).slice(0, 30)), status: "suggested", addedAt: new Date().toISOString(), by: "ai" });
    seen.add(x.url); added++;
  }
  return added;
}
module.exports = async function handler(req, res) {
  cors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const uid = await agentId(token).catch(() => null);
  if (!uid || !(await isBroker(token).catch(() => false))) return res.status(403).json({ error: "Only the broker can run the news search." });
  if (!claude.ready()) return res.status(500).json({ error: "AI isn’t set up on the server." });
  try { const today = new Date().toISOString().slice(0, 10); return res.status(200).json({ added: await findNews(today) }); }
  catch (e) { return res.status(502).json({ error: e.message || "The news search didn’t finish." }); }
};
module.exports.findNews = findNews;
