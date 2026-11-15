// The Miller Group — hazard lookup for "What it really costs".
// GET /api/hazards?lat=..&lng=..  ->  { floodZone, sfha }
// Asks FEMA's National Flood Hazard Layer which flood zone the point is in. Public data, no key needed.
// FEMA_NFHL_URL can point at a different NFHL query endpoint if FEMA moves it.
const { cors } = require("../lib/common");

const NFHL = process.env.FEMA_NFHL_URL || "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query";
const hits = new Map();
const limited = ip => { const now = Date.now(), w = (hits.get(ip) || []).filter(t => now - t < 60000); w.push(now); hits.set(ip, w); return w.length > 60; };

async function floodZone(lat, lng) {
  const p = new URLSearchParams({ geometry: `${lng},${lat}`, geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields: "FLD_ZONE,ZONE_SUBTY,SFHA_TF", returnGeometry: "false", f: "json" });
  const r = await fetch(`${NFHL}?${p}`, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`FEMA ${r.status}`);
  const j = await r.json();
  if (j.error) throw new Error("FEMA error");
  const feats = (j.features || []).map(f => f.attributes || {}).filter(a => a.FLD_ZONE);
  if (!feats.length) return { floodZone: "", sfha: false, mapped: false };
  // A point can touch more than one polygon; report the highest-risk one.
  const a = feats.find(x => x.SFHA_TF === "T") || feats[0];
  const zone = String(a.FLD_ZONE).trim();
  return { floodZone: zone === "AREA NOT INCLUDED" ? "" : zone, subtype: a.ZONE_SUBTY || "", sfha: a.SFHA_TF === "T", mapped: true };
}

module.exports = async function handler(req, res) {
  cors(req, res, "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Use GET" });
  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  if (limited(ip)) return res.status(429).json({ error: "Too many requests." });
  const lat = +(req.query || {}).lat, lng = +(req.query || {}).lng;
  // Colorado and a margin around it.
  if (!(lat > 36 && lat < 42 && lng > -110 && lng < -101)) return res.status(400).json({ error: "Location must be in Colorado." });
  try {
    const out = await floodZone(lat.toFixed(6), lng.toFixed(6));
    res.setHeader("Cache-Control", "public, s-maxage=604800, stale-while-revalidate=86400");
    return res.status(200).json({ ...out, source: "FEMA National Flood Hazard Layer" });
  } catch (e) {
    console.error("Hazard lookup failed", e.message);
    return res.status(502).json({ error: "Flood map lookup is unavailable right now." });
  }
};
module.exports.floodZone = floodZone;
