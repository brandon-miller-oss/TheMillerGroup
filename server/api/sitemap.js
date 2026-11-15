// Sitemap of every published, indexable agent page: /sitemap-agents.xml
const URL_ = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_ANON_KEY;
const x = s => String(s).replace(/[<>&'"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]);
module.exports = async function handler(req, res) {
  if (!URL_ || !KEY) return res.status(500).send("Set SUPABASE_URL and SUPABASE_ANON_KEY.");
  const get = q => fetch(`${URL_}/rest/v1/docs?${q}`, { headers: { apikey: KEY, Authorization: "Bearer " + KEY } }).then(r => r.ok ? r.json() : []);
  try {
    const [team, pages] = await Promise.all([get("parent=eq.team&select=path,data"), get("path=like.sites/*/pages/*&select=path,data,updated_at")]);
    const slugOf = Object.fromEntries(team.map(t => [t.path.split("/")[1], t.data && t.data.slug]));
    const base = `https://${req.headers.host}/a`;
    const urls = pages.filter(p => p.data && p.data.published && !(p.data.seo && p.data.seo.noindex) && slugOf[p.path.split("/")[1]])
      .map(p => `<url><loc>${x(`${base}/${slugOf[p.path.split("/")[1]]}/${p.data.slug}`)}</loc><lastmod>${x(String(p.updated_at || "").slice(0, 10))}</lastmod></url>`);
    res.setHeader("Content-Type", "application/xml; charset=utf-8"); res.setHeader("Cache-Control", "public, s-maxage=3600");
    return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>`);
  } catch (e) { return res.status(502).send("Sitemap unavailable."); }
};
