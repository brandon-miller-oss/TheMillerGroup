// Client updates on the server: email/text sending rules and the daily reminder job. node server/test/notify.test.js
const assert = require("assert");
Object.assign(process.env, { SUPABASE_URL: "https://db.test", SUPABASE_SERVICE_ROLE_KEY: "svc", RESEND_API_KEY: "re", EMAIL_FROM: "updates@miller.test", TWILIO_ACCOUNT_SID: "AC1", TWILIO_AUTH_TOKEN: "tok", TWILIO_FROM: "+13035550000", CRON_SECRET: "s3", TIME_ZONE: "America/Denver" });
const tomorrow = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() + 864e5));
const DB = {
  "team/a1": { name: "Alex Rivera", email: "alex@miller.test", phone: "720-555-0150" },
  "agent/a1/settings": { clientUpdates: { reminders: true } },
  "agent/a1/crm/contacts/c1": { name: "Jordan Reyes", email: "jordan@x.test", phone: "303-555-0142", clientId: "u9", notify: { email: true } },
  "agent/a1/crm/contacts/c2": { name: "Pat Lee", email: "pat@x.test", phone: "303-555-0199", notify: { sms: true, smsConsentAt: "2026-11-01T00:00:00Z" } },
  "agent/a1/crm/contacts/c3": { name: "No Contact", email: "nc@x.test", doNotContact: true },
  "boards/u9/prefs/notify": { sms: true, smsConsentAt: "2026-11-02T00:00:00Z", phone: "720-555-0177", email: true },
  "agent/a1/crm/tours/t1": { date: tomorrow, contactId: "c1", notifiedSig: "x", stops: [{ listingKey: "S-1", time: "10:00", address: "1186 S Larkmoor St, Denver", note: "lockbox 4321" }] },
  "agent/a1/crm/tours/t2": { date: tomorrow, contactId: "c2", stops: [{ listingKey: "S-2", time: "11:00", address: "9 Elm St" }] },
  "deals/d1": { agentId: "a1", address: "2210 S Fillmore St", status: "pending", contactId: "c2", clientUpdates: true, deadlines: [{ label: "Inspection objection deadline", date: tomorrow }, { label: "Earnest money due", date: tomorrow }] }
};
const sent = { email: [], sms: [] };
global.fetch = async (url, o = {}) => {
  url = String(url);
  if (url.includes("api.resend.com")) { sent.email.push(JSON.parse(o.body)); return { ok: true, json: async () => ({}) }; }
  if (url.includes("api.twilio.com")) { sent.sms.push(Object.fromEntries(new URLSearchParams(String(o.body)))); return { ok: true, json: async () => ({}) }; }
  if (url.includes("/auth/v1/user")) return { ok: true, json: async () => ({ id: "a1" }) };
  if (url.includes("/rpc/is_agent")) return { ok: true, json: async () => true };
  if (url.includes("/rest/v1/docs") && o.method === "POST") { const b = JSON.parse(o.body); DB[b.path] = b.data; return { ok: true, json: async () => ({}) }; }
  if (url.includes("/rest/v1/docs")) {
    const q = new URL(url).searchParams; let rows = Object.entries(DB).map(([path, data]) => ({ path, data }));
    for (const [k, v] of q) { if (k === "select") continue; const [op, ...rest] = v.split("."); const val = decodeURIComponent(rest.join("."));
      rows = rows.filter(r => { const f = k === "parent" ? r.path.replace(/\/[^/]+$/, "") : k === "path" ? r.path : k.startsWith("data->>") ? String((r.data || {})[k.slice(7)] ?? "") : ""; return op === "eq" ? f === val : op === "like" ? new RegExp("^" + val.replace(/\*/g, "[^/]*") + "$").test(f) : true; }); }
    return { ok: true, json: async () => rows };
  }
  throw new Error("unexpected fetch " + url);
};
const sms = require("../lib/sms"); const realQuiet = sms.quietHours;
const notify = require("../api/notify.js"), reminders = require("../api/client-reminders.js");
const res = () => { const r = { code: 0, body: null }; r.status = c => { r.code = c; return r; }; r.json = b => { r.body = b; return r; }; r.end = () => r; r.setHeader = () => r; return r; };
(async () => {
  const awake = !realQuiet();
  let r = res(); await notify({ method: "POST", headers: { authorization: "Bearer t" }, body: { contactId: "c1", channels: ["email", "sms"], subject: "Your showings", text: "Hi", sms: "Hi. Reply STOP to opt out.", ics: "BEGIN:VCALENDAR\r\nEND:VCALENDAR" } }, r);
  assert.equal(r.code, 200); assert.equal(r.body.email, "Sent");
  assert.equal(sent.email[0].to[0], "jordan@x.test"); assert.equal(sent.email[0].reply_to, "alex@miller.test"); assert.equal(sent.email[0].attachments[0].filename, "showings.ics");
  console.log("PASS email goes to the contact on file (not a browser-chosen address), with the calendar file");
  if (awake) { assert.equal(r.body.sms, "Sent"); assert.equal(sent.sms[0].To, "+17205550177"); console.log("PASS text uses the consent and number the client gave in the app"); }
  else { assert(/8 AM and 9 PM/.test(r.body.sms)); console.log("PASS texts are held outside 8 AM to 9 PM (quiet hours now)"); }
  r = res(); await notify({ method: "POST", headers: { authorization: "Bearer t" }, body: { contactId: "c3", channels: ["email", "sms"], subject: "s", text: "t" } }, r);
  assert(/do not contact/.test(r.body.email) && /do not contact/.test(r.body.sms)); console.log("PASS do-not-contact is respected");
  delete DB["boards/u9/prefs/notify"]; r = res(); await notify({ method: "POST", headers: { authorization: "Bearer t" }, body: { contactId: "c1", channels: ["sms"], subject: "s", text: "t" } }, r);
  assert(/no text consent/.test(r.body.sms)); console.log("PASS no consent, no text");
  r = res(); await notify({ method: "POST", headers: { authorization: "Bearer t" }, body: { contactId: "../x", channels: ["email"], subject: "s", text: "t" } }, r); assert.equal(r.code, 400); console.log("PASS bad contact ids are rejected");
  assert.equal(sms.e164("(303) 555-0142"), "+13035550142"); assert.equal(sms.e164("555"), ""); console.log("PASS phone numbers are normalized");
  // Daily reminders
  sent.email.length = 0;
  r = res(); await reminders({ headers: { authorization: "Bearer s3" } }, r);
  assert.equal(r.code, 200);
  const subjects = sent.email.map(e => e.subject);
  assert(subjects.includes("Tomorrow: your showings"), "tour reminder"); assert(sent.email.find(e => e.subject === "Tomorrow: your showings").to[0] === "jordan@x.test");
  assert(!sent.email.some(e => e.to[0] === "pat@x.test" && e.subject.startsWith("Tomorrow")), "tours never sent to the client are not reminded");
  assert(subjects.some(s => /Inspection objection deadline is tomorrow/.test(s)) && !subjects.some(s => /Earnest/.test(s)), "deal reminder for client dates only");
  assert(!sent.email.some(e => /lockbox/.test(e.text)), "no private notes");
  assert(Object.keys(DB).some(k => k.startsWith("boards/u9/inbox/")), "app inbox");
  console.log("PASS day-before reminders for showings and key deal dates, to email and the app, without private notes");
  const n = sent.email.length; r = res(); await reminders({ headers: { authorization: "Bearer s3" } }, r); assert.equal(sent.email.length, n); console.log("PASS each reminder is sent only once");
  r = res(); await reminders({ headers: { authorization: "Bearer nope" } }, r); assert.equal(r.code, 401); console.log("PASS reminder job needs the cron secret");
  const fs = require("fs"), path = require("path"); assert.equal(fs.readFileSync(path.join(__dirname, "../lib/notify-templates.js"), "utf8"), fs.readFileSync(path.join(__dirname, "../../search/notify-templates.js"), "utf8")); console.log("PASS server message templates match the app’s");
  console.log("All client update server tests passed");
})().catch(e => { console.error("FAIL", e.message); process.exit(1); });
