// Server-rendered agent pages and sitemap: node server/test/pages.test.js
const assert = require("assert"), fs = require("fs"), path = require("path");
process.env.SUPABASE_URL = "https://db.test"; process.env.SUPABASE_ANON_KEY = "anon"; process.env.SITE_URL = "https://site.test"; process.env.LICENSE_TEXT = "Colorado brokerage license: EC0000000";
const R = require("../lib/site-render.js");
const brand = { name: "Alex Rivera Homes", primary: "#18302E", accent: "#C99B52" };
const DB = [
  { path: "team/u1", data: { name: "Alex Rivera", slug: "alex", phone: "720-555-0150", brand } },
  { path: "company/brandok/items/u1", data: { approved: true, sig: R.brandSig(brand) } },
  { path: "sites/u1/pages/p1", data: { kind: "website", slug: "home", title: "Home", published: true, seo: { title: "Highland real estate agent | Alex Rivera Homes", description: "d" }, sections: [{ type: "hero", headline: "Real estate in Highland" }, { type: "form", heading: "Talk", purpose: "contact" }] }, updated_at: "2026-11-15T10:00:00Z" },
  { path: "sites/u1/pages/p2", data: { kind: "landing", slug: "draft", title: "Draft", published: false, sections: [] } },
  { path: "sites/u1/pages/p3", data: { kind: "landing", slug: "ads", title: "Ad page", published: true, seo: { noindex: true }, sections: [{ type: "hero", headline: "Ad" }] } }
];
let calls = [];
global.fetch = async url => { calls.push(url); const q = new URL(url).searchParams; let rows = DB.slice();
  for (const [k, v] of q) { if (k === "select" || k === "limit") continue; const [op, ...rest] = v.split("."); const val = decodeURIComponent(rest.join("."));
    rows = rows.filter(r => { const field = k === "parent" ? r.path.replace(/\/[^/]+$/, "") : k === "path" ? r.path : k.startsWith("data->>") ? String(r.data[k.slice(7)] ?? "") : ""; return op === "eq" ? field === val : op === "like" ? new RegExp("^" + val.replace(/\*/g, ".*") + "$").test(field) : true; }); }
  return { ok: true, json: async () => rows }; };
const res = () => { const r = { code: 0, headers: {}, body: "" }; r.status = c => { r.code = c; return r; }; r.setHeader = (k, v) => { r.headers[k] = v; return r; }; r.send = b => { r.body = b; return r; }; r.end = () => r; return r; };
const page = require("../api/page.js"), sitemap = require("../api/sitemap.js");
(async () => {
  let r = res(); await page({ method: "GET", query: { a: "alex", p: "home" }, headers: { host: "tools.test" } }, r);
  assert.equal(r.code, 200); assert(r.body.includes("<title>Highland real estate agent | Alex Rivera Homes</title>"), "title");
  assert(r.body.includes('rel="canonical" href="https://tools.test/a/alex/home"'), "canonical");
  assert(r.body.includes("Alex Rivera Homes") && r.body.includes("Brokered by The Miller Group"), "approved brand + brokerage");
  assert(r.body.includes("EC0000000") && r.body.includes("Equal Housing Opportunity"), "license + EHO");
  assert(r.body.includes("submit_agent_lead") && r.body.includes('"agent":"u1"'), "lead form wired");
  assert(!r.body.includes('content="noindex"'), "indexable"); console.log("PASS published page renders for search engines");
  r = res(); await page({ method: "GET", query: { a: "alex", p: "draft" }, headers: { host: "tools.test" } }, r); assert.equal(r.code, 404); console.log("PASS drafts are not served");
  r = res(); await page({ method: "GET", query: { a: "../x" }, headers: { host: "tools.test" } }, r); assert.equal(r.code, 404); console.log("PASS bad links are rejected");
  r = res(); await page({ method: "GET", query: { a: "alex", p: "ads" }, headers: { host: "tools.test" } }, r); assert(r.body.includes('content="noindex"')); console.log("PASS hidden pages carry noindex");
  DB[1].data.sig = "changed"; r = res(); await page({ method: "GET", query: { a: "alex" }, headers: { host: "tools.test" } }, r);
  assert(!r.body.includes("Brokered by") && r.body.includes("The Miller Group")); console.log("PASS unapproved brand falls back to The Miller Group"); DB[1].data.sig = R.brandSig(brand);
  r = res(); await sitemap({ method: "GET", headers: { host: "tools.test" } }, r);
  assert(r.body.includes("https://tools.test/a/alex/home") && !r.body.includes("/draft") && !r.body.includes("/ads")); console.log("PASS sitemap lists only live, indexable pages");
  assert.equal(fs.readFileSync(path.join(__dirname, "../lib/site-render.js"), "utf8"), fs.readFileSync(path.join(__dirname, "../../search/site-render.js"), "utf8")); console.log("PASS server renderer matches the app’s renderer");
  console.log("All agent page server tests passed");
})().catch(e => { console.error("FAIL", e.message); process.exit(1); });
