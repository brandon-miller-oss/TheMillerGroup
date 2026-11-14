// The Miller Group — IDX proxy (Vercel serverless function)
// Browser -> /api/idx?<OData params>  ->  Bridge Interactive RESO Web API (REcolorado)
// The Bridge server token never reaches the browser.

const BASE = process.env.BRIDGE_BASE_URL || "https://api.bridgedataoutput.com/api/v2/OData";
const DATASET = process.env.BRIDGE_DATASET_ID;      // REcolorado dataset id from your Bridge application
const TOKEN = process.env.BRIDGE_SERVER_TOKEN;      // server token from Bridge (keep secret)
const RESOURCE = process.env.BRIDGE_RESOURCE || "Property";
const ORIGINS = (process.env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
const MAX_TOP = 50;

// Only these fields leave the proxy, so non-IDX data can't leak to the page.
const FIELDS = ["ListingKey","ListingId","StandardStatus","ListPrice","BedroomsTotal","BathroomsTotalInteger","LivingArea","LotSizeAcres","YearBuilt","PropertySubType","UnparsedAddress","City","StateOrProvince","PostalCode","SubdivisionName","Latitude","Longitude","PublicRemarks","ListOfficeName","ListAgentFullName","OnMarketDate","ModificationTimestamp"];
const MEDIA_FIELDS = ["MediaURL","MediaCategory","Order"];
const ORDER_OK = /^(OnMarketDate|ListPrice|LivingArea|ModificationTimestamp)( (asc|desc))?$/;
const KEY_OK = /^[A-Za-z0-9_\-]{1,64}$/;

// Light per-instance rate limit (60 requests/minute per IP).
const hits = new Map();
function limited(ip) {
  const now = Date.now(), win = hits.get(ip) || [];
  const recent = win.filter(t => now - t < 60000);
  recent.push(now); hits.set(ip, recent);
  return recent.length > 60;
}

function cors(req, res) {
  const origin = req.headers.origin;
  if (origin && ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
}

function buildQuery(q) {
  const p = new URLSearchParams();
  if (q.key) {
    if (!KEY_OK.test(q.key)) throw new Error("Invalid listing key");
    p.set("$filter", `ListingKey eq '${q.key}'`);
    p.set("$top", "1");
  } else {
    const filter = String(q.$filter || "");
    if (filter.length > 1500) throw new Error("Filter too long");
    if (/\$|;|\b(any|all)\(/i.test(filter)) throw new Error("Unsupported filter");
    if (filter) p.set("$filter", filter);
    const top = Math.min(Math.max(parseInt(q.$top, 10) || 25, 1), MAX_TOP);
    p.set("$top", String(top));
    const skip = Math.max(parseInt(q.$skip, 10) || 0, 0);
    if (skip) p.set("$skip", String(Math.min(skip, 2000)));
    if (q.$orderby && ORDER_OK.test(q.$orderby)) p.set("$orderby", q.$orderby);
  }
  p.set("$select", [...FIELDS, "Media"].join(","));
  return p;
}

function clean(r) {
  const out = {};
  for (const f of FIELDS) if (r[f] !== undefined) out[f] = r[f];
  out.Media = (r.Media || [])
    .filter(m => m && m.MediaURL && (!m.MediaCategory || m.MediaCategory === "Photo"))
    .slice(0, 40)
    .map(m => Object.fromEntries(MEDIA_FIELDS.map(k => [k, m[k] ?? (k === "MediaCategory" ? "Photo" : undefined)])));
  return out;
}

module.exports = async function handler(req, res) {
  cors(req, res);
  if (req.method === "OPTIONS") { res.setHeader("Access-Control-Allow-Methods", "GET"); return res.status(204).end(); }
  if (req.method !== "GET") return res.status(405).json({ error: "Use GET" });
  if (!DATASET || !TOKEN) return res.status(500).json({ error: "IDX proxy is not configured. Set BRIDGE_DATASET_ID and BRIDGE_SERVER_TOKEN." });

  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  if (limited(ip)) return res.status(429).json({ error: "Too many requests. Try again in a minute." });

  let params;
  try { params = buildQuery(req.query || {}); }
  catch (e) { return res.status(400).json({ error: e.message }); }

  const url = `${BASE}/${encodeURIComponent(DATASET)}/${RESOURCE}?${params}`;
  try {
    const upstream = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/json" } });
    if (!upstream.ok) {
      const detail = (await upstream.text()).slice(0, 300);
      console.error("Bridge error", upstream.status, detail);
      return res.status(502).json({ error: `Listing service returned ${upstream.status}` });
    }
    const json = await upstream.json();
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json({ value: (json.value || []).map(clean), fetchedAt: new Date().toISOString() });
  } catch (e) {
    console.error("Proxy failure", e);
    return res.status(502).json({ error: "Couldn’t reach the listing service." });
  }
};

module.exports.buildQuery = buildQuery;
module.exports.clean = clean;
