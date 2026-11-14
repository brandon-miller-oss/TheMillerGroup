// Tests the daily follow-up job and the email function against fake Supabase and Resend.
process.env.SUPABASE_URL = "https://sb.test"; process.env.SUPABASE_SERVICE_ROLE_KEY = "svc";
process.env.RESEND_API_KEY = "re"; process.env.EMAIL_FROM = "updates@mg.test"; process.env.CRON_SECRET = "s3cret"; process.env.ALLOWED_ORIGINS = "https://site.test";
const assert = require("assert");
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const yr = Number(today.slice(0, 4)), mmdd = today.slice(5);
const rows = {
  "agent/sara/settings": { followups: { autoSend: true } },
  "agent/tom/settings": { followups: { autoSend: false } },
  "agent/sara/crm/contacts/c1": { name: "Bo Lee", email: "bo@x.com" },
  "agent/sara/crm/contacts/c2": { name: "Ana Ruiz", email: "ana@x.com", birthday: `1990-${mmdd}` },
  "agent/sara/crm/contacts/c3": { name: "No Mail", email: "no@x.com", birthday: `1980-${mmdd}`, doNotContact: true },
  "agent/tom/crm/contacts/t1": { name: "Tom Client", email: "tc@x.com", birthday: `1980-${mmdd}` },
  "deals/d1": { agentId: "sara", status: "closed", closeDate: `${yr - 2}-${mmdd}`, contactId: "c1", address: "5 Pine" },
  "team/sara": { name: "Sara Clark", email: "sara@mg.test" }
};
const sent = [];
const parent = p => p.split("/").slice(0, -1).join("/");
global.fetch = async (url, opts = {}) => {
  const u = new URL(url);
  if (u.host === "api.resend.com") { sent.push(JSON.parse(opts.body)); return { ok: true, json: async () => ({ id: "x" }) }; }
  if (u.pathname === "/rest/v1/docs" && opts.method === "POST") { const b = JSON.parse(opts.body); rows[b.path] = b.data; return { ok: true, json: async () => ({}) }; }
  if (u.pathname === "/auth/v1/user") return { ok: opts.headers.Authorization === "Bearer good", json: async () => ({ id: "sara" }) };
  if (u.pathname === "/rest/v1/rpc/is_agent") return { ok: true, json: async () => true };
  const q = u.searchParams; let list = Object.entries(rows);
  if (q.get("path")) { const v = q.get("path"); list = v.startsWith("like.") ? list.filter(([p]) => new RegExp("^" + v.slice(5).replace(/\*/g, "[^/]+") + "$").test(p)) : list.filter(([p]) => p === v.slice(3)); }
  if (q.get("parent")) list = list.filter(([p]) => parent(p) === q.get("parent").slice(3));
  if (q.get("data->>agentId")) list = list.filter(([, d]) => d.agentId === q.get("data->>agentId").slice(3));
  return { ok: true, json: async () => list.map(([path, data]) => ({ path, data })) };
};
const call = (h, req) => new Promise(resolve => { const res = { headers: {}, statusCode: 200, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.statusCode = c; return this; }, json(b) { resolve({ status: this.statusCode, body: b }); }, end() { resolve({ status: this.statusCode }); } }; h(req, res); });
(async () => {
  const cron = require("../api/followups-cron.js");
  assert.equal((await call(cron, { headers: {} })).status, 401, "cron needs the secret");
  let r = await call(cron, { headers: { authorization: "Bearer s3cret" } });
  assert.equal(r.status, 200); assert.equal(r.body.agents, 1, "only agents with auto send");
  assert.equal(sent.length, 2, "anniversary + birthday, skipping do-not-contact and Tom");
  assert.ok(sent.some(m => m.to[0] === "bo@x.com" && m.text.includes("2 years since you got the keys to 5 Pine")));
  assert.ok(sent.every(m => m.from === "Sara Clark <updates@mg.test>" && m.reply_to === "sara@mg.test"));
  assert.ok(Object.keys(rows).filter(p => p.startsWith("agent/sara/crm/emaillog/")).length === 2, "sends are logged");
  r = await call(cron, { headers: { authorization: "Bearer s3cret" } });
  assert.equal(sent.length, 2, "running twice doesn't resend");
  const email = require("../api/email.js");
  assert.equal((await call(email, { method: "POST", headers: { authorization: "Bearer bad" }, body: { to: "a@b.co", subject: "s", text: "t" } })).status, 403);
  r = await call(email, { method: "POST", headers: { authorization: "Bearer good", origin: "https://site.test" }, body: { to: "a@b.co", subject: "Hi", text: "Hello" } });
  assert.equal(r.status, 200); assert.equal(sent.length, 3);
  r = await call(email, { method: "POST", headers: { authorization: "Bearer good" }, body: { to: "not-an-email", subject: "Hi", text: "Hello" } });
  assert.equal(r.status, 502);
  console.log("All follow-up and email tests passed");
})().catch(e => { console.error(e); process.exit(1); });
