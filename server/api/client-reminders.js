// Runs once a day at 8 AM Denver time (see vercel.json). For agents with client reminders on:
// - reminds clients of tomorrow's showings they were already sent, and
// - for transactions with "Remind the client" on, reminds them the day before key dates.
// Each reminder goes to the client's app inbox, email, and (with consent) text, and is logged once.
const { docs, putDoc, profile } = require("../lib/common");
const { sendOne } = require("./notify");
const NT = require("../lib/notify-templates");
const TZ = process.env.TIME_ZONE || "America/Denver";
const dayIn = (tz, add = 0) => { const d = new Date(Date.now() + add * 864e5); return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d); };
const newId = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const enc = encodeURIComponent;

async function runForAgent(uid, tomorrow, results, cache = {}) {
  const me = await profile(uid);
  const firm = process.env.BUSINESS_NAME || "The Miller Group";
  const agent = { name: me.name || "", phone: me.phone || "", firm, byline: "", business: "" };
  const [contactRows, tourRows, dealRows, noticeRows] = await Promise.all([
    docs(`parent=eq.${enc(`agent/${uid}/crm/contacts`)}`), docs(`parent=eq.${enc(`agent/${uid}/crm/tours`)}`),
    docs(`parent=eq.deals&data->>agentId=eq.${enc(uid)}`), docs(`parent=eq.${enc(`agent/${uid}/crm/notices`)}`)]);
  const contacts = Object.fromEntries(contactRows.map(r => [r.path.split("/").pop(), r.data]));
  const done = new Set(noticeRows.map(r => r.data && r.data.key).filter(Boolean));
  const addr = async key => { if (cache[key] !== undefined) return cache[key]; const ex = await docs(`path=eq.${enc("exclusives/" + key)}`).catch(() => []); cache[key] = ex[0] ? [ex[0].data.UnparsedAddress || ex[0].data.address, ex[0].data.City].filter(Boolean).join(", ") : ""; return cache[key]; };
  const jobs = [];
  for (const r of tourRows) {
    const t = r.data, id = r.path.split("/").pop();
    if (!t || t.date !== tomorrow || !t.notifiedSig || !t.contactId || !contacts[t.contactId] || !(t.stops || []).length) continue;
    const stops = []; for (const s of t.stops) stops.push({ address: s.address || await addr(s.listingKey) || "See your app for details", time: s.time || "" });
    jobs.push({ key: `reminder|tour|${id}|${t.date}`, contactId: t.contactId, event: "showing_reminder", data: { id, date: t.date, stops }, tourId: id });
  }
  for (const r of dealRows) {
    const d = r.data, id = r.path.split("/").pop();
    if (!d || !d.clientUpdates || !d.contactId || !contacts[d.contactId] || ["closed", "cancelled", "canceled"].includes(d.status)) continue;
    (d.deadlines || []).filter(x => x.date === tomorrow && !x.done && NT.CLIENT_DATES.includes(x.label))
      .forEach(x => jobs.push({ key: `reminder|deal|${id}|${x.label}|${x.date}`, contactId: d.contactId, event: "milestone", data: { label: x.label, date: x.date, address: d.address, soon: true }, dealId: id }));
  }
  for (const j of jobs) {
    if (done.has(j.key)) continue;
    const c = contacts[j.contactId], msg = NT.compose(j.event, { ...j.data, client: c.name, agent });
    const out = {};
    if (c.clientId) { try { await putDoc(`boards/${c.clientId}/inbox/${newId("n")}`, { event: j.event, title: msg.title, text: msg.text, ics: msg.ics || "", tourId: j.tourId || "", dealId: j.dealId || "", from: agent.name, at: new Date().toISOString(), read: false }); out.app = "Sent"; } catch (e) { out.app = e.message; } }
    try { Object.assign(out, await sendOne(uid, j.contactId, { channels: ["email", "sms"], subject: msg.subject, text: msg.text, sms: msg.sms, ics: msg.ics || "" })); } catch (e) { out.email = e.message; }
    await putDoc(`agent/${uid}/crm/notices/${newId("n")}`, { key: j.key, contactId: j.contactId, event: j.event, title: msg.title, subject: msg.subject, text: msg.text, results: out, tourId: j.tourId || "", dealId: j.dealId || "", at: new Date().toISOString(), auto: true });
    results.sent++;
  }
}

module.exports = async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: "Unauthorized" });
  const tomorrow = dayIn(TZ, 1), results = { for: tomorrow, agents: 0, sent: 0, errors: [] };
  try {
    const settings = await docs(`path=like.${enc("agent/*/settings")}`);
    for (const row of settings) {
      if (((row.data || {}).clientUpdates || {}).reminders === false) continue;
      results.agents++;
      try { await runForAgent(row.path.split("/")[1], tomorrow, results); } catch (e) { results.errors.push(e.message); }
    }
    return res.status(200).json(results);
  } catch (e) { return res.status(500).json({ ...results, error: e.message }); }
};
module.exports.runForAgent = runForAgent;
