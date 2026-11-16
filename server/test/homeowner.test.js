// Monthly homeowner reminders and their unsubscribe link. node server/test/homeowner.test.js
const assert = require("assert");
Object.assign(process.env, { SUPABASE_URL: "https://db.test", SUPABASE_SERVICE_ROLE_KEY: "svc", RESEND_API_KEY: "re", EMAIL_FROM: "hi@miller.test", UNSUBSCRIBE_SECRET: "u5", PUBLIC_API_URL: "https://tools.test", BUSINESS_ADDRESS: "123 Main St, Denver, CO 80202" });
const fs = require("fs"), path = require("path");
assert.equal(fs.readFileSync(path.join(__dirname, "../lib/home-care.js"), "utf8"), fs.readFileSync(path.join(__dirname, "../../search/home-care.js"), "utf8"), "server/lib/home-care.js matches the app copy");
const DB = {
  "boards/u1/home/h1": { address: "1440 N Gaylord St", firstName: "Marcus", email: "marcus@x.test", type: "Single Family Residence", remind: true, agent: { name: "Brandon Miller", email: "b@miller.test", phone: "303-990-0702" } },
  "boards/u2/home/h2": { address: "77 Oak St", firstName: "Ana", email: "ana@x.test", type: "Condominium", remind: true, lang: "es", agent: { name: "Alex Rivera" } },
  "boards/u3/home/h3": { address: "Off", email: "off@x.test", remind: false },
  "boards/u4/home/h4": { address: "No email", remind: true }
};
const batches = [], writes = {};
global.fetch = async (url, o = {}) => {
  url = String(url);
  if (url.endsWith("/emails/batch")) { batches.push(JSON.parse(o.body)); return { ok: true, json: async () => ({}) }; }
  if (url.includes("/rest/v1/docs?")) { const q = decodeURIComponent(url.split("?")[1]); const all = { ...DB, ...writes };
    let rows; const eq = /path=eq\.([^&]+)/.exec(q), like = /path=like\.([^&]+)/.exec(q);
    if (eq) rows = all[eq[1]] ? [{ path: eq[1], data: all[eq[1]] }] : [];
    else { const re = new RegExp("^" + like[1].replace(/\*/g, "[^/]+") + "$"); rows = Object.entries(all).filter(([k]) => re.test(k)).map(([k, v]) => ({ path: k, data: v })); }
    return { ok: true, json: async () => rows }; }
  if (url.endsWith("/rest/v1/docs") && o.method === "POST") { const b = JSON.parse(o.body); writes[b.path] = b.data; return { ok: true, json: async () => ({}) }; }
  throw new Error("Unexpected " + url);
};
(async () => {
  const HR = require("../api/home-reminders.js");
  let r = await HR.run("2027-05-01");
  assert.equal(r.sent, 2, JSON.stringify(r)); assert.equal(r.skipped, 2);
  const msgs = batches[0], en = msgs.find(m => m.to[0] === "marcus@x.test"), es = msgs.find(m => m.to[0] === "ana@x.test");
  assert.ok(/Hi Marcus/.test(en.text) && /sprinklers/i.test(en.text) && /reassessment year/.test(en.text), "English checklist with the protest window");
  assert.ok(/123 Main St/.test(en.text) && /Unsubscribe: https:\/\/tools\.test\/api\/unsubscribe\?t=/.test(en.text) && en.headers["List-Unsubscribe-Post"], "address, unsubscribe link, one-click header");
  assert.equal(en.reply_to, "b@miller.test");
  assert.ok(/Hola Ana/.test(es.text) && /revaluación/.test(es.text) && !/aspersores/.test(es.text), "Spanish, and no sprinkler tasks for a condo");
  assert.equal(writes["boards/u1/home/h1"].lastReminder, "2027-05");
  r = await HR.run("2027-05-01"); assert.equal(r.sent, 0, "never twice in a month");
  // Unsubscribe
  const tkn = /t=([\w.-]+)/.exec(en.text)[1];
  const unsub = require("../api/unsubscribe.js");
  const call = (method) => new Promise(res => { const o = { headers: {}, statusCode: 200, setHeader() {}, status(c) { this.statusCode = c; return this; }, send(b) { res({ status: this.statusCode, body: b }); }, end() { res({ status: this.statusCode }); } }; unsub({ method, query: { t: tkn }, headers: {} }, o); });
  let u = await call("GET"); assert.ok(/monthly home reminders/.test(u.body), "confirm page names home reminders");
  u = await call("POST"); assert.ok(/won’t get monthly home reminders/.test(u.body)); assert.equal(writes["boards/u1/home/h1"].remind, false);
  // No address, no send
  delete require.cache[require.resolve("../api/home-reminders.js")]; process.env.BUSINESS_ADDRESS = "";
  r = await require("../api/home-reminders.js").run("2027-06-01"); assert.equal(r.sent, 0); assert.ok(/BUSINESS_ADDRESS/.test(r.errors[0]));
  console.log("All homeowner server tests passed");
})().catch(e => { console.error("FAIL", e.message); process.exit(1); });
