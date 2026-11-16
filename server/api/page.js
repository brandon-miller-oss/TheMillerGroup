// The Miller Group: server-rendered agent websites and landing pages (for search engines and fast first loads).
// /a/<agent link name>/<page>  ->  /api/page?a=<agent>&p=<page>
// Uses the same renderer as the agent builder (server/lib/site-render.js is a copy of search/site-render.js).
const SiteRender = require("../lib/site-render.js");
const URL_ = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
const KH = /^eyJ/.test(KEY || "") ? { apikey: KEY, Authorization: "Bearer " + KEY } : { apikey: KEY };
const SITE = (process.env.SITE_URL || "").replace(/\/$/, ""), FIRM = process.env.BUSINESS_NAME || "The Miller Group", LICENSE = process.env.LICENSE_TEXT || "";
const SLUG = /^[a-z0-9-]{1,40}$/;

async function get(q) {
  const r = await fetch(`${URL_}/rest/v1/docs?${q}`, { headers: KH });
  return r.ok ? r.json() : [];
}
const notFound = (res, msg) => res.status(404).setHeader("Content-Type", "text/html; charset=utf-8").send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Page not found</title><body style="font:16px system-ui;text-align:center;margin-top:20vh"><h1>Page not found</h1><p>${msg}</p><p><a href="${SITE || "/"}">Visit ${FIRM}</a></p>`);

async function load(slug, pslug) {
  const team = await get(`parent=eq.team&data->>slug=eq.${encodeURIComponent(slug)}&select=path,data&limit=1`);
  if (!team.length) return null;
  const uid = team[0].path.split("/")[1];
  const [pages, ok] = await Promise.all([get(`parent=eq.${encodeURIComponent("sites/" + uid + "/pages")}&select=path,data`), get(`path=eq.${encodeURIComponent("company/brandok/items/" + uid)}&select=data`)]);
  const live = pages.map(r => ({ id: r.path.split("/").pop(), ...r.data })).filter(x => x.published);
  const page = live.find(x => x.slug === (pslug || "home")) || (!pslug && live.find(x => x.kind === "website")) || null;
  if (!page) return null;
  const agent = SiteRender.agentContext(uid, team[0].data, ok[0] && ok[0].data, { firm: FIRM, siteUrl: SITE });
  return { uid, page, live, agent };
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") return res.status(405).end();
  if (!URL_ || !KEY) return res.status(500).send("Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.");
  const slug = String((req.query || {}).a || "").toLowerCase(), pslug = String((req.query || {}).p || "").toLowerCase();
  if (!SLUG.test(slug) || (pslug && !SLUG.test(pslug))) return notFound(res, "Check the link and try again.");
  try {
    const d = await load(slug, pslug);
    if (!d) return notFound(res, "This page isn’t published.");
    const base = `https://${req.headers.host}/a/${slug}`;
    const nav = d.page.kind === "website" ? d.live.filter(x => x.kind === "website").sort((a, b) => (a.order || 0) - (b.order || 0)).map(x => ({ title: x.navTitle || x.title, href: `${base}/${x.slug}`, current: x.id === d.page.id })) : [];
    const html = SiteRender.render({ ...d.page, theme: SiteRender.themeFrom(d.agent, d.page.theme) }, { agent: d.agent, firm: FIRM, license: LICENSE, siteUrl: SITE, supabaseUrl: URL_, anonKey: KEY, pageUrl: `${base}/${d.page.slug}`, nav });
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
    return res.status(200).send(html);
  } catch (e) { return res.status(502).send("Couldn’t load this page. Try again in a moment."); }
};
module.exports.load = load;
