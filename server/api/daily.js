// The one daily job (8 AM Denver time; see vercel.json): follow-up emails, client reminders,
// scheduled newsletters, and on Mondays the Colorado news search for the broker's News desk.
const followups = require("./followups-cron");
const reminders = require("./client-reminders");
const { docs } = require("../lib/common");
const NL = require("../lib/newsletter");
const news = require("./news");
const claude = require("../lib/claude");
const TZ = process.env.TIME_ZONE || "America/Denver";
const todayIn = tz => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const fakeRes = () => { const r = { code: 0, body: null }; r.status = c => { r.code = c; return r; }; r.json = b => { r.body = b; return r; }; r.end = () => r; r.setHeader = () => r; r.send = b => { r.body = b; return r; }; return r; };
module.exports = async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: "Unauthorized" });
  const today = todayIn(TZ), out = { date: today };
  const a = fakeRes(); await followups(req, a); out.followups = a.body;
  const b = fakeRes(); await reminders(req, b); out.reminders = b.body;
  out.newsletters = { drafted: 0, sent: 0, errors: [] };
  if (new Date(today + "T12:00:00Z").getUTCDay() === 1 && claude.ready()) { try { out.news = { added: await news.findNews(today) }; } catch (e) { out.news = { error: e.message }; } }
  try {
    const settings = await docs(`path=like.${encodeURIComponent("agent/*/settings")}`);
    for (const row of settings) {
      try { const r = await NL.runScheduled(row.path.split("/")[1], row.data || {}, today); if (r) out.newsletters[r.status === "draft" ? "drafted" : "sent"]++; }
      catch (e) { out.newsletters.errors.push(e.message); }
    }
  } catch (e) { out.newsletters.errors.push(e.message); }
  return res.status(200).json(out);
};
