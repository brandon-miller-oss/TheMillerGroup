// Newsletters on the server: audience, sending, unsubscribe, scheduling, news search, daily job. node server/test/newsletter.test.js
const assert = require("assert");
Object.assign(process.env, { SUPABASE_URL: "https://db.test", SUPABASE_SERVICE_ROLE_KEY: "svc", RESEND_API_KEY: "re", EMAIL_FROM: "news@miller.test", CRON_SECRET: "s3", UNSUBSCRIBE_SECRET: "u5", PUBLIC_API_URL: "https://tools.test", SITE_URL: "https://site.test", ANTHROPIC_API_KEY: "k", TIME_ZONE: "America/Denver", BUSINESS_ADDRESS: "" });
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const SR = require("../lib/site-render");
const brand = { name: "Alex Rivera Homes", primary: "#18302E", accent: "#C99B52" };
const DB = {
  "team/a1": { name: "Alex Rivera", email: "alex@miller.test", phone: "720-555-0150", slug: "alex", areas: "Highland, Golden", brand },
  "company/brandok/items/a1": { approved: true, sig: SR.brandSig(brand) },
  "company/settings": { marketStats: { median: 585000, dom: 29, monthsSupply: 4.4, rate: 6.2, area: "Denver metro", asOf: "October 2026", source: "REcolorado" } },
  "company/news/items/n1": { title: "Highland home prices hold steady", url: "https://news.test/1", source: "Test", date: today, summary: "s", status: "approved" },
  "company/news/items/n2": { title: "Suggested only", url: "https://news.test/2", date: today, summary: "s", status: "suggested" },
  "exclusives/x1": { agentId: "a1", ListingKey: "PX-1", StandardStatus: "Private Exclusive", ListPrice: 900000, UnparsedAddress: "12 Elm St", City: "Denver" },
  "agent/a1/settings": { newsletter: { auto: true, mode: "review", frequency: "weekly", weekday: new Date(today + "T12:00:00Z").getUTCDay(), audience: { all: true }, address: "123 Main St, Denver, CO 80202" } },
  "agent/a1/crm/contacts/c1": { name: "Jordan Reyes", email: "jordan@x.test", folders: ["Sphere"] },
  "agent/a1/crm/contacts/c2": { name: "Pat Lee", email: "pat@x.test", newsletterOptOut: true },
  "agent/a1/crm/contacts/c3": { name: "No Contact", email: "nc@x.test", doNotContact: true },
  "agent/a1/crm/contacts/c4": { name: "Dup", email: "JORDAN@x.test" },
  "agent/a1/crm/contacts/c5": { name: "Sam <b>", email: "sam@x.test", role: "seller" }
};
const batches = [], single = [];
global.fetch = async (url, o = {}) => {
  url = String(url);
  if (url.endsWith("/emails/batch")) { batches.push(JSON.parse(o.body)); return { ok: true, json: async () => ({}) }; }
  if (url.includes("api.resend.com/emails")) { single.push(JSON.parse(o.body)); return { ok: true, json: async () => ({}) }; }
  if (url.includes("api.anthropic.com")) { const b = JSON.parse(o.body); const isNews = !!b.tools;
    return { ok: true, json: async () => ({ stop_reason: "end_turn", content: [{ type: "text", text: isNews ? JSON.stringify([{ title: "Colorado lawmakers weigh housing bill", source: "Colorado Sun", url: "https://coloradosun.test/a", date: today, summary: "Short original summary.", tags: ["Colorado"] }, { title: "Dup", url: "https://news.test/1", summary: "x" }, { title: "Bad", url: "http://insecure.test", summary: "x" }]) : '{"subject":"Highland update","preheader":"p","intro":"Hi {{first_name}},\\n\\nHello."}' }] }) }; }
  if (url.includes("/auth/v1/user")) return { ok: true, json: async () => ({ id: "a1" }) };
  if (url.includes("/rpc/is_agent")) return { ok: true, json: async () => true };
  if (url.includes("/rpc/is_admin")) return { ok: true, json: async () => true };
  if (url.includes("/rest/v1/docs") && o.method === "POST") { const b = JSON.parse(o.body); DB[b.path] = b.data; return { ok: true, json: async () => ({}) }; }
  if (url.includes("/rest/v1/docs")) {
    const q = new URL(url).searchParams; let rows = Object.entries(DB).map(([path, data]) => ({ path, data }));
    for (const [k, v] of q) { if (k === "select") continue; const [op, ...rest] = v.split("."); const val = decodeURIComponent(rest.join("."));
      rows = rows.filter(r => { const f = k === "parent" ? r.path.replace(/\/[^/]+$/, "") : k === "path" ? r.path : k.startsWith("data->>") ? String((r.data || {})[k.slice(7)] ?? "") : ""; return op === "eq" ? f === val : op === "like" ? new RegExp("^" + val.replace(/\*/g, "[^/]*") + "$").test(f) : true; }); }
    return { ok: true, json: async () => rows };
  }
  if (url.includes("bridgedataoutput")) return { ok: false };
  throw new Error("unexpected fetch " + url);
};
const NL = require("../lib/newsletter"), api = require("../api/newsletter"), unsub = require("../api/unsubscribe"), daily = require("../api/daily"), news = require("../api/news");
const res = () => { const r = { code: 0, body: null, headers: {} }; r.status = c => { r.code = c; return r; }; r.json = b => { r.body = b; return r; }; r.send = b => { r.body = b; return r; }; r.end = () => r; r.setHeader = (k, v) => { r.headers[k] = v; return r; }; return r; };
(async () => {
  const list = await NL.recipients("a1", { all: true });
  assert.deepEqual(list.map(c => c.id).sort(), ["c1", "c5"]); console.log("PASS audience skips unsubscribed, do-not-contact, and duplicate emails");
  assert.deepEqual((await NL.recipients("a1", { all: false, folders: ["sphere"] })).map(c => c.id), ["c1"]);
  assert.deepEqual((await NL.recipients("a1", { all: false, roles: ["seller"] })).map(c => c.id), ["c5"]); console.log("PASS audience by folder or role");
  // Build
  const issue = await NL.buildIssue("a1", DB["agent/a1/settings"], today);
  assert(issue.news.length === 1 && issue.news[0].url === "https://news.test/1"); assert(issue.listings[0].address === "12 Elm St, Denver" && issue.listings[0].url.includes("#home=PX-1"));
  assert(issue.agent.display === "Alex Rivera Homes" && issue.agent.byline === "Brokered by The Miller Group"); assert.equal(issue.subject, "Highland update");
  console.log("PASS issue built from approved news, the agent's listings, market stats, approved brand, and AI copy");
  // Send via API
  let r = res(); await api({ method: "POST", headers: { authorization: "Bearer t" }, body: { action: "send", issue: { ...issue, address: "fake", license: "fake" }, audience: { all: true } } }, r);
  assert.equal(r.code, 200); assert.equal(r.body.sent, 2);
  const msgs = batches.flat(), j = msgs.find(m => m.to[0] === "jordan@x.test"), s = msgs.find(m => m.to[0] === "sam@x.test");
  assert(j.html.includes("Hi Jordan,") && j.html.includes("123 Main St, Denver") && !j.html.includes("fake"), "personalized + server address");
  assert(/^<https:\/\/tools\.test\/api\/unsubscribe\?t=/.test(j.headers["List-Unsubscribe"]) && j.headers["List-Unsubscribe-Post"] === "List-Unsubscribe=One-Click");
  assert(s.html.includes("Hi Sam,") && j.reply_to === "alex@miller.test" && j.from.startsWith("Alex Rivera <news@"));
  assert(Object.keys(DB).some(k => k.startsWith("agent/a1/crm/newsletters/") && DB[k].status === "sent"));
  console.log("PASS sends personalized emails with the server's address, one-click unsubscribe headers, and logs the issue");
  // Unsubscribe
  const t = j.headers["List-Unsubscribe"].match(/t=([^>]+)/)[1];
  r = res(); await unsub({ method: "GET", query: { t } }, r); assert(r.body.includes("<form method=\"post\"") && !DB["agent/a1/crm/contacts/c1"].newsletterOptOut); console.log("PASS unsubscribe link asks to confirm (link scanners can't unsubscribe people)");
  r = res(); await unsub({ method: "POST", query: { t } }, r); assert(DB["agent/a1/crm/contacts/c1"].newsletterOptOut === true); console.log("PASS one-click unsubscribe records it");
  r = res(); await unsub({ method: "POST", query: { t: t.slice(0, -2) + "xx" } }, r); assert.equal(r.code, 400); console.log("PASS tampered links are rejected");
  // Scheduling
  assert(NL.due({ auto: true, frequency: "weekly", weekday: new Date(today + "T12:00:00Z").getUTCDay() }, today) && !NL.due({ auto: false }, today) && !NL.due({ auto: true, frequency: "weekly", weekday: new Date(today + "T12:00:00Z").getUTCDay(), lastIssueDate: today }, today));
  console.log("PASS schedule logic");
  // News search
  const added = await news.findNews(today); assert.equal(added, 1); assert(Object.values(DB).some(x => x.title === "Colorado lawmakers weigh housing bill" && x.status === "suggested" && x.by === "ai"));
  console.log("PASS news search adds new https stories as suggestions for the broker, skipping duplicates");
  // Daily job: review mode drafts and emails the agent
  single.length = 0; batches.length = 0;
  r = res(); await daily({ headers: { authorization: "Bearer s3" } }, r);
  assert.equal(r.code, 200); assert.equal(r.body.newsletters.drafted, 1);
  assert(Object.values(DB).some(x => x && x.status === "draft") && single.some(m => m.to[0] === "alex@miller.test" && /ready to review/.test(m.subject)) && !batches.length);
  assert.equal(DB["agent/a1/settings"].newsletter.lastIssueDate, today);
  console.log("PASS daily job drafts the scheduled issue and emails the agent to review (review mode)");
  r = res(); await daily({ headers: { authorization: "Bearer s3" } }, r); assert.equal(r.body.newsletters.drafted, 0); console.log("PASS only one issue per scheduled day");
  DB["agent/a1/settings"].newsletter = { ...DB["agent/a1/settings"].newsletter, mode: "send", lastIssueDate: "" };
  r = res(); await daily({ headers: { authorization: "Bearer s3" } }, r); assert.equal(r.body.newsletters.sent, 1); assert(batches.flat().length >= 1); console.log("PASS automatic mode sends it");
  delete DB["agent/a1/settings"].newsletter.address; process.env.BUSINESS_ADDRESS = "";
  r = res(); await api({ method: "POST", headers: { authorization: "Bearer t" }, body: { action: "test", issue } }, r); assert.equal(r.code, 400); assert(/mailing address/.test(r.body.error)); console.log("PASS no mailing address, no send");
  const fs = require("fs"), path = require("path"); assert.equal(fs.readFileSync(path.join(__dirname, "../lib/newsletter-render.js"), "utf8"), fs.readFileSync(path.join(__dirname, "../../search/newsletter-render.js"), "utf8")); console.log("PASS server newsletter renderer matches the app’s");
  console.log("All newsletter server tests passed");
})().catch(e => { console.error("FAIL", e.message, e.stack); process.exit(1); });
