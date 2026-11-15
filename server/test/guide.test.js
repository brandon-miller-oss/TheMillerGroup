// Client guide, hazard lookup, and listing cost fields on the server. node server/test/guide.test.js
const assert = require("assert");
Object.assign(process.env, { SUPABASE_URL: "https://db.test", SUPABASE_SERVICE_ROLE_KEY: "svc", ANTHROPIC_API_KEY: "k", ALLOWED_ORIGINS: "https://site.test" });
const fs = require("fs"), path = require("path");
assert.equal(fs.readFileSync(path.join(__dirname, "../lib/deal-guide.js"), "utf8"), fs.readFileSync(path.join(__dirname, "../../search/deal-guide.js"), "utf8"), "server/lib/deal-guide.js matches the app copy");
const DG = require("../lib/deal-guide");
const DB = {
  "boards/u1/deal/d1": DG.shareable({ address: "2210 S Fillmore St", side: "buyer", status: "pending", price: 900000, commissionPct: 2.5, notes: "PRIVATE NOTE", review: { state: "submitted" },
    deadlines: [{ label: "Inspection objection deadline", date: "2026-11-20" }, { label: "Closing date", date: "2026-12-10" }, { label: "Appraisal deadline", date: "" }] },
    { name: "Brandon Miller", phone: "303-990-0702" }, [{ id: "x", title: "Inspection report", summary: "Furnace is old.", shared: true }]),
  "boards/u1/guide/q0": { dealId: "d1", q: "Earlier?", a: "Earlier answer.", at: "2026-11-01T00:00:00Z" }
};
let lastPrompt = "", aiReply = '{"answer":"Your inspection objection deadline is November 20.","forAgent":false}', femaUrl = "";
const writes = {};
global.fetch = async (url, o = {}) => {
  url = String(url);
  if (url.includes("hazards.fema.gov")) { femaUrl = url; return { ok: true, json: async () => ({ features: [{ attributes: { FLD_ZONE: "X", SFHA_TF: "F" } }, { attributes: { FLD_ZONE: "AE", SFHA_TF: "T", ZONE_SUBTY: "" } }] }) }; }
  if (url.includes("api.anthropic.com")) { lastPrompt = JSON.parse(o.body).messages[0].content; return { ok: true, json: async () => ({ stop_reason: "end_turn", content: [{ type: "text", text: aiReply }] }) }; }
  if (url.includes("/auth/v1/user")) { const t = (o.headers || {}).Authorization || ""; return t.endsWith("good") ? { ok: true, json: async () => ({ id: "u1" }) } : { ok: false, json: async () => ({}) }; }
  if (url.includes("/rest/v1/docs?")) { const q = decodeURIComponent(url.split("?")[1]);
    const m = /path=eq\.([^&]+)/.exec(q), p = /parent=eq\.([^&]+)/.exec(q);
    const rows = Object.entries({ ...DB, ...writes }).filter(([k]) => m ? k === m[1] : p ? k.replace(/\/[^/]+$/, "") === p[1] : false).map(([k, v]) => ({ path: k, data: v }));
    return { ok: true, json: async () => rows }; }
  if (url.endsWith("/rest/v1/docs") && o.method === "POST") { const b = JSON.parse(o.body); writes[b.path] = b.data; return { ok: true, json: async () => ({}) }; }
  throw new Error("Unexpected fetch " + url);
};
const call = (handler, { method = "POST", body = {}, query = {}, token = "good" } = {}) => new Promise(resolve => {
  const res = { headers: {}, statusCode: 200, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.statusCode = c; return this; }, json(b) { resolve({ status: this.statusCode, body: b, headers: this.headers }); }, end() { resolve({ status: this.statusCode }); } };
  handler({ method, body, query, headers: { origin: "https://site.test", authorization: "Bearer " + token, "x-forwarded-for": "9.9.9.9" } }, res);
});
(async () => {
  // Shareable copy keeps private fields out
  const s = DB["boards/u1/deal/d1"];
  assert.ok(!("commissionPct" in s) && !("notes" in s) && !("review" in s), "no commission, notes, or review in the client copy");
  assert.equal(s.deadlines.length, 2, "dates without a value are left out");
  const guide = require("../api/guide.js");
  let r = await call(guide, { body: { dealId: "d1", question: "When is my inspection deadline?" } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.ok(/November 20/.test(r.body.item.a));
  assert.ok(writes[`boards/u1/guide/${r.body.id}`], "Q&A saved where the agent sees it");
  assert.ok(lastPrompt.includes("2026-11-20") && lastPrompt.includes("Furnace is old.") && lastPrompt.includes("Earlier?"), "prompt has dates, documents, and history");
  assert.ok(!lastPrompt.includes("PRIVATE NOTE") && /Explain; don’t advise/.test(lastPrompt), "prompt has the no-advice rule and no private notes");
  r = await call(guide, { body: { dealId: "d1", question: "Hi" }, token: "bad" }); assert.equal(r.status, 401, "must be signed in");
  r = await call(guide, { body: { dealId: "nope", question: "When do we close?" } }); assert.equal(r.status, 404, "only the client's own shared deal");
  r = await call(guide, { body: { dealId: "../x", question: "When do we close?" } }); assert.equal(r.status, 400, "bad ids rejected");
  aiReply = "Not JSON at all"; r = await call(guide, { body: { dealId: "d1", question: "Can we back out?" } });
  assert.equal(r.status, 200); assert.equal(r.body.item.forAgent, true, "unparseable reply is flagged for the agent");
  for (let i = 0; i < 15; i++) await call(guide, { body: { dealId: "d1", question: "Question number " + i } });
  r = await call(guide, { body: { dealId: "d1", question: "One more?" } }); assert.equal(r.status, 429, "rate limited per client");
  // Local demo answer
  assert.ok(/Closing date is 2026-12-10/.test(DG.localAnswer(s, "when is closing?").answer));
  assert.equal(DG.localAnswer(s, "should I waive the appraisal?").forAgent, true);

  // Hazards
  const hz = require("../api/hazards.js");
  r = await call(hz, { method: "GET", query: { lat: "39.7", lng: "-104.97" } });
  assert.equal(r.status, 200); assert.equal(r.body.floodZone, "AE", "reports the high-risk zone when the point touches two"); assert.equal(r.body.sfha, true);
  assert.ok(/geometry=-104\.970000%2C39\.700000/.test(femaUrl) && /returnGeometry=false/.test(femaUrl), "asks FEMA for the point");
  r = await call(hz, { method: "GET", query: { lat: "34", lng: "-118" } }); assert.equal(r.status, 400, "Colorado only");

  // Listing cost fields pass through the IDX proxy
  process.env.BRIDGE_DATASET_ID = "ds"; process.env.BRIDGE_SERVER_TOKEN = "t";
  delete require.cache[require.resolve("../api/idx.js")];
  const idx = require("../api/idx.js");
  const out = idx.clean({ ListingKey: "a", TaxAnnualAmount: 5000, AssociationFee: 200, ListAgentEmail: "x" });
  assert.ok(out.TaxAnnualAmount === 5000 && out.AssociationFee === 200 && !out.ListAgentEmail, "tax and HOA pass; private fields don't");
  assert.ok(idx.buildQuery({}).get("$select").includes("TaxAnnualAmount") && !idx.buildQuery({}, false).get("$select").includes("TaxAnnualAmount"), "cost fields can be dropped on retry");
  console.log("All guide and hazard server tests passed");
})().catch(e => { console.error("FAIL", e.message); process.exit(1); });
