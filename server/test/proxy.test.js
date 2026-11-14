// Runs the proxy against a fake Bridge response. No network or credentials needed.
process.env.BRIDGE_DATASET_ID = "test_ds";
process.env.BRIDGE_SERVER_TOKEN = "secret";
process.env.ALLOWED_ORIGINS = "https://themillergroup.com";
const assert = require("assert");
const handler = require("../api/idx.js");

let lastUrl = "", lastHeaders = {};
global.fetch = async (url, opts) => {
  lastUrl = url; lastHeaders = opts.headers;
  return { ok: true, json: async () => ({ value: [{
    ListingKey: "abc", ListPrice: 900000, ListAgentEmail: "private@x.com", BuyerAgencyCompensation: "2.5%",
    Media: [{ MediaURL: "https://cdn/x.jpg", MediaCategory: "Photo", Order: 1, MediaKey: "m1" }, { MediaURL: "https://cdn/f.pdf", MediaCategory: "Document" }]
  }] }) };
};

function call(query, headers = {}) {
  return new Promise(resolve => {
    const res = { headers: {}, statusCode: 200,
      setHeader(k, v){ this.headers[k] = v; }, status(c){ this.statusCode = c; return this; },
      json(b){ resolve({ status: this.statusCode, body: b, headers: this.headers }); }, end(){ resolve({ status: this.statusCode }); } };
    handler({ method: "GET", query, headers: { origin: "https://themillergroup.com", "x-forwarded-for": "1.2.3.4", ...headers } }, res);
  });
}

(async () => {
  let r = await call({ $filter: "ListPrice le 900000", $top: "500", $orderby: "ListPrice asc" });
  assert.equal(r.status, 200);
  const u = new URL(lastUrl);
  assert.equal(u.pathname, "/api/v2/OData/test_ds/Property");
  assert.equal(u.searchParams.get("$top"), "50", "caps $top");
  assert.equal(u.searchParams.get("$orderby"), "ListPrice asc");
  assert.equal(lastHeaders.Authorization, "Bearer secret");
  assert.ok(!("ListAgentEmail" in r.body.value[0]), "drops non-allowlisted fields");
  assert.ok(!("BuyerAgencyCompensation" in r.body.value[0]), "drops compensation fields");
  assert.equal(r.body.value[0].Media.length, 1, "photos only");
  assert.equal(r.headers["Access-Control-Allow-Origin"], "https://themillergroup.com");

  r = await call({ key: "abc" });
  assert.equal(new URL(lastUrl).searchParams.get("$filter"), "ListingKey eq 'abc'");

  r = await call({ key: "x' or 1 eq 1" });
  assert.equal(r.status, 400, "rejects unsafe keys");

  r = await call({ $orderby: "ListAgentEmail desc" });
  assert.equal(new URL(lastUrl).searchParams.get("$orderby"), null, "ignores unknown sort");

  r = await call({ $filter: "x".repeat(2000) });
  assert.equal(r.status, 400, "rejects long filters");

  console.log("All proxy tests passed");
})().catch(e => { console.error(e); process.exit(1); });
