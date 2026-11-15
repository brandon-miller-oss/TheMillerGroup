// Sends one client update by email and/or text for a signed-in agent.
// The server looks up the contact itself (the browser never chooses the recipient)
// and checks do-not-contact, email preferences, and text consent.
const { cors, agentId, docs, profile, sendEmail, EMAIL_RE } = require("../lib/common");
const { sendSMS } = require("../lib/sms");

const sent = new Map();
function limited(id) { const now = Date.now(), list = (sent.get(id) || []).filter(t => now - t < 3600000); list.push(now); sent.set(id, list); return list.length > 120; }
const ID = /^[A-Za-z0-9_-]{1,80}$/;

// Text consent comes from the agent's record, or from the client turning texts on in the app.
async function consent(uid, c) {
  const n = c.notify || {};
  if (n.sms && n.smsConsentAt) return { ok: true, phone: c.phone };
  if (c.clientId && ID.test(c.clientId)) {
    const rows = await docs(`path=eq.${encodeURIComponent(`boards/${c.clientId}/prefs/notify`)}`).catch(() => []);
    const p = rows[0] && rows[0].data;
    if (p && p.sms && p.smsConsentAt && p.phone) return { ok: true, phone: p.phone };
  }
  return { ok: false };
}

async function sendOne(uid, contactId, { channels, subject, text, sms, ics }) {
  const rows = await docs(`path=eq.${encodeURIComponent(`agent/${uid}/crm/contacts/${contactId}`)}`);
  const c = rows[0] && rows[0].data; if (!c) throw Object.assign(new Error("That contact wasn’t found."), { status: 404 });
  const out = {}, me = await profile(uid);
  if (channels.includes("email")) {
    let prefs = null; if (c.clientId && ID.test(c.clientId)) { const r = await docs(`path=eq.${encodeURIComponent(`boards/${c.clientId}/prefs/notify`)}`).catch(() => []); prefs = r[0] && r[0].data; }
    if (c.doNotContact) out.email = "Not sent: do not contact";
    else if (!EMAIL_RE.test(c.email || "")) out.email = "Not sent: no email on file";
    else if ((c.notify || {}).email === false || (prefs && prefs.email === false)) out.email = "Not sent: client turned off email updates";
    else {
      const attachments = ics && /^BEGIN:VCALENDAR/.test(ics) && ics.length < 20000 ? [{ filename: "showings.ics", content: Buffer.from(ics).toString("base64") }] : [];
      try { await sendEmail({ to: c.email, subject, text, fromName: me.name, replyTo: me.email, attachments }); out.email = "Sent"; } catch (e) { out.email = e.message; }
    }
  }
  if (channels.includes("sms")) {
    const k = c.doNotContact ? { ok: false } : await consent(uid, c);
    if (c.doNotContact) out.sms = "Not sent: do not contact";
    else if (!k.ok) out.sms = "Not sent: no text consent on file";
    else { try { await sendSMS(k.phone, sms); out.sms = "Sent"; } catch (e) { out.sms = e.message; } }
  }
  return out;
}

module.exports = async function handler(req, res) {
  cors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
  const uid = await agentId((req.headers.authorization || "").replace(/^Bearer\s+/i, "")).catch(() => null);
  if (!uid) return res.status(403).json({ error: "Only signed-in agents can send client updates." });
  if (limited(uid)) return res.status(429).json({ error: "That’s a lot of updates in an hour. Try again later." });
  const b = req.body || {}, channels = (Array.isArray(b.channels) ? b.channels : []).filter(x => x === "email" || x === "sms");
  if (!ID.test(b.contactId || "") || !channels.length || !b.text || !b.subject) return res.status(400).json({ error: "Missing the client, message, or channel." });
  try {
    const out = await sendOne(uid, b.contactId, { channels, subject: String(b.subject).slice(0, 200), text: String(b.text).slice(0, 8000), sms: String(b.sms || b.text).slice(0, 640), ics: String(b.ics || "") });
    return res.status(200).json(out);
  } catch (e) { return res.status(e.status || 502).json({ error: e.message || "That didn’t send." }); }
};
module.exports.sendOne = sendOne;
