// Runs once a day (see vercel.json). For agents who turned on automatic follow-ups,
// sends today's home-anniversary and birthday emails and logs each one so it isn't sent twice.
const { docs, putDoc, profile, sendEmail, DEFAULT_TEMPLATES, fill, EMAIL_RE } = require("../lib/common");
const TZ = process.env.TIME_ZONE || "America/Denver";

const todayIn = tz => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const newId = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

async function runForAgent(uid, settings, today, results) {
  const f = settings.followups || {};
  const year = Number(today.slice(0, 4)), mmdd = today.slice(5);
  const enc = encodeURIComponent;
  const [contactRows, logRows, dealRows] = await Promise.all([
    docs(`parent=eq.${enc(`agent/${uid}/crm/contacts`)}`),
    docs(`parent=eq.${enc(`agent/${uid}/crm/emaillog`)}`),
    docs(`parent=eq.deals&data->>agentId=eq.${enc(uid)}`)
  ]);
  const contacts = Object.fromEntries(contactRows.map(r => [r.path.split("/").pop(), r.data]));
  const logged = new Set(logRows.map(r => `${r.data.contactId}|${r.data.kind}|${r.data.year}`));
  const me = await profile(uid);
  const tpl = k => ({ ...DEFAULT_TEMPLATES[k], ...((f.templates || {})[k] || {}) });
  const due = [];
  if (f.anniversary !== false) dealRows.map(r => r.data).filter(d => d.status === "closed" && d.closeDate && d.contactId && d.closeDate.slice(5, 10) === mmdd).forEach(d => {
    const years = year - Number(d.closeDate.slice(0, 4));
    if (years >= 1) due.push({ kind: "anniversary", id: d.contactId, vars: { years: `${years} ${years === 1 ? "year" : "years"}`, address: d.address || "your home" } });
  });
  if (f.birthday !== false) Object.entries(contacts).filter(([, c]) => c.birthday && c.birthday.slice(5, 10) === mmdd).forEach(([id]) => due.push({ kind: "birthday", id, vars: {} }));
  for (const x of due) {
    const c = contacts[x.id];
    if (!c || c.doNotContact || !EMAIL_RE.test(c.email || "") || logged.has(`${x.id}|${x.kind}|${year}`)) continue;
    const t = tpl(x.kind), v = { first_name: String(c.name || "").split(/\s+/)[0], agent_name: me.name || "", ...x.vars };
    const subject = fill(t.subject, v);
    try {
      await sendEmail({ to: c.email, subject, text: fill(t.body, v), fromName: me.name, replyTo: me.email });
      logged.add(`${x.id}|${x.kind}|${year}`);
      await putDoc(`agent/${uid}/crm/emaillog/${newId("l")}`, { contactId: x.id, kind: x.kind, year, to: c.email, subject, sentAt: new Date().toISOString(), auto: true });
      await putDoc(`agent/${uid}/crm/contacts/${x.id}`, { ...c, lastContacted: new Date().toISOString() });
      results.sent++;
    } catch (e) { results.errors.push(`${uid}: ${e.message}`); }
  }
}

module.exports = async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: "Unauthorized" });
  const today = todayIn(TZ), results = { date: today, agents: 0, sent: 0, errors: [] };
  try {
    const settings = await docs(`path=like.${encodeURIComponent("agent/*/settings")}`);
    for (const row of settings) {
      if (!(row.data.followups || {}).autoSend) continue;
      results.agents++;
      await runForAgent(row.path.split("/")[1], row.data, today, results);
    }
    return res.status(200).json(results);
  } catch (e) {
    return res.status(500).json({ ...results, error: e.message });
  }
};
module.exports.runForAgent = runForAgent;
