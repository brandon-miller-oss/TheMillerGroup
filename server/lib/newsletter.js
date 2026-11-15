// Agent newsletters: audience, issue assembly, sending, and unsubscribe tokens.
const crypto = require("crypto");
const { docs, putDoc, profile, sendEmail, sendBatch, fromLine, EMAIL_RE } = require("./common");
const NR = require("./newsletter-render");
const SR = require("./site-render");
const claude = require("./claude");
const SITE = (process.env.SITE_URL || "").replace(/\/$/, ""), FIRM = process.env.BUSINESS_NAME || "The Miller Group";
const ADDRESS = process.env.BUSINESS_ADDRESS || "", LICENSE = process.env.LICENSE_TEXT || "";
const SECRET = process.env.UNSUBSCRIBE_SECRET || process.env.CRON_SECRET || "";
const API = (process.env.PUBLIC_API_URL || "").replace(/\/$/, "");      // e.g. https://miller-tools.vercel.app
const MAX_RECIPIENTS = Number(process.env.NEWSLETTER_MAX || 2000);
const enc = encodeURIComponent;
const newId = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/* Unsubscribe links: signed so nobody can unsubscribe someone else. */
const b64 = s => Buffer.from(s).toString("base64url");
function token(uid, cid) { const body = b64(`${uid}|${cid}`); return `${body}.${crypto.createHmac("sha256", SECRET).update(body).digest("base64url").slice(0, 32)}`; }
function verify(t) {
  const [body, sig] = String(t || "").split("."); if (!body || !sig || !SECRET) return null;
  const want = crypto.createHmac("sha256", SECRET).update(body).digest("base64url").slice(0, 32);
  if (sig.length !== want.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null;
  const [uid, cid] = Buffer.from(body, "base64url").toString().split("|"); return uid && cid ? { uid, cid } : null;
}
const unsubUrl = (uid, cid) => `${API}/api/unsubscribe?t=${token(uid, cid)}`;

/* Who gets it: contacts with an email, not marked do-not-contact or unsubscribed, in the chosen folders or roles. */
function match(c, aud) {
  if (!c || !EMAIL_RE.test(c.email || "") || c.doNotContact || c.newsletterOptOut) return false;
  if (!aud || aud.all) return true;
  const f = (c.folders || []).map(x => String(x).toLowerCase());
  if ((aud.folders || []).some(x => f.includes(String(x).toLowerCase()))) return true;
  if ((aud.roles || []).includes(c.role) || ((aud.roles || []).includes("buyer") && c.role === "both") || ((aud.roles || []).includes("seller") && c.role === "both")) return true;
  return false;
}
async function recipients(uid, aud) {
  const rows = await docs(`parent=eq.${enc(`agent/${uid}/crm/contacts`)}`);
  const seen = new Set();
  return rows.map(r => ({ id: r.path.split("/").pop(), ...r.data })).filter(c => match(c, aud)).filter(c => { const k = c.email.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
}

/* Assemble an issue from live data (used by the daily job). */
async function bridgeListings(mlsId) {
  const T = process.env.BRIDGE_SERVER_TOKEN, D = process.env.BRIDGE_DATASET_ID, B = process.env.BRIDGE_BASE_URL || "https://api.bridgedataoutput.com/api/v2/OData";
  if (!T || !D || !/^[A-Za-z0-9_-]{1,40}$/.test(mlsId || "")) return [];
  try {
    const q = new URLSearchParams({ $filter: `ListAgentMlsId eq '${mlsId}' and (StandardStatus eq 'Active' or StandardStatus eq 'Coming Soon')`, $top: "6", $select: "ListingKey,StandardStatus,ListPrice,BedroomsTotal,BathroomsTotalInteger,LivingArea,UnparsedAddress,City,SubdivisionName", $expand: "Media($select=MediaURL,Order;$orderby=Order;$top=1)" });
    const r = await fetch(`${B}/${D}/Property?${q}`, { headers: { Authorization: `Bearer ${T}` } }); if (!r.ok) return [];
    const j = await r.json();
    return (j.value || []).map(p => ({ key: p.ListingKey, status: p.StandardStatus, price: p.ListPrice, beds: p.BedroomsTotal, baths: p.BathroomsTotalInteger, sqft: p.LivingArea, address: [p.UnparsedAddress, p.City].filter(Boolean).join(", "), hood: p.SubdivisionName || "", photo: ((p.Media || [])[0] || {}).MediaURL || "" }));
  } catch (e) { return []; }
}
async function buildIssue(uid, settings, today) {
  const n = settings.newsletter || {}, sections = { market: true, news: true, listings: true, openhouses: true, events: true, ...(n.sections || {}) };
  const me = await profile(uid);
  const [ok, company, newsRows, exRows, ohRows] = await Promise.all([
    docs(`path=eq.${enc("company/brandok/items/" + uid)}`), docs(`path=eq.${enc("company/settings")}`), docs(`parent=eq.${enc("company/news/items")}`),
    docs(`parent=eq.exclusives&data->>agentId=eq.${enc(uid)}`), docs(`parent=eq.openhouses&data->>agentId=eq.${enc(uid)}`)]);
  const agent = SR.agentContext(uid, me, ok[0] && ok[0].data, { firm: FIRM, siteUrl: SITE });
  const brand = agent.brand || {};
  const link = k => SITE ? `${SITE}/search/${me.slug ? "?agent=" + enc(me.slug) : ""}#home=${enc(k)}` : "";
  const areas = String(me.areas || (me.presStats || {}).areas || "Denver").split(/,|;| and /).map(x => x.trim()).filter(Boolean);
  const m = ((company[0] || {}).data || {}).marketStats || null;
  const news = sections.news ? NR.pickNews(newsRows.map(r => r.data).filter(x => x && x.status === "approved" && (Date.parse(today) - Date.parse(x.date || x.addedAt || 0)) / 864e5 <= 21), areas, n.newsCount || 3) : [];
  const ex = exRows.map(r => r.data).filter(x => x && !/closed|sold|withdrawn/i.test(x.StandardStatus || "")).map(x => ({ key: x.ListingKey, status: x.StandardStatus, price: x.ListPrice, beds: x.BedroomsTotal, baths: x.BathroomsTotalInteger, sqft: x.LivingArea, address: [x.UnparsedAddress, x.City].filter(Boolean).join(", "), hood: x.SubdivisionName || "", photo: ((x.Media || [])[0] || {}).MediaURL || "" }));
  const listings = sections.listings ? [...ex, ...(await bridgeListings(me.mlsId || n.mlsId))].slice(0, 6).map(h => ({ ...h, url: link(h.key) })) : [];
  const byKey = Object.fromEntries(listings.map(h => [h.key, h]));
  const soon = d => d >= today && (Date.parse(d) - Date.parse(today)) / 864e5 <= 21;
  const openHouses = sections.openhouses ? ohRows.map(r => r.data).filter(o => o && o.date && soon(o.date)).sort((a, b) => a.date.localeCompare(b.date)).map(o => ({ date: o.date, start: o.start, end: o.end, address: o.address || (byKey[o.listingKey] || {}).address || "", price: (byKey[o.listingKey] || {}).price, url: link(o.listingKey) })).filter(o => o.address) : [];
  const events = sections.events ? (n.events || []).filter(x => x && x.title && x.date && x.date >= today).slice(0, 4) : [];
  const monthLabel = new Date(today + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const market = sections.market && m && m.median ? { ...m, note: n.marketNote || "" } : null;
  let intro = `Hi {{first_name}},\n\nHere’s what’s happening in Colorado real estate this ${n.frequency === "monthly" ? "month" : "week"}${listings.length ? ", plus my latest listings" : ""}${openHouses.length ? " and open houses" : ""}. If you or someone you know is thinking about a move, I’m always happy to help.`;
  let subject = `${monthLabel.split(" ")[0]} in Colorado real estate | ${agent.brand ? agent.display : me.name || FIRM}`.slice(0, 60), preheader = news[0] ? news[0].title : "Market numbers, news, and homes";
  if (claude.ready()) {
    try {
      const out = claude.json(await claude.ask(`Write the subject line, preview text, and a short personal intro for a real estate agent's ${n.frequency || "monthly"} client newsletter.
Agent: ${me.name}${agent.brand ? `, ${agent.display}` : ""}. Areas: ${areas.join(", ")}. Voice: ${n.voice || "warm and personal"}.
This issue includes: ${JSON.stringify({ market: market && { median: market.median, dom: market.dom, monthsSupply: market.monthsSupply, rate: market.rate, asOf: market.asOf }, news: news.map(x => x.title), listings: listings.map(h => h.address), openHouses: openHouses.map(o => o.date + " " + o.address), events: events.map(x => x.title) })}
Rules: start the intro with "Hi {{first_name}}," then 2 short paragraphs (under 90 words total). Use only the facts given; no invented numbers or claims. Fair Housing advertising rules apply. No emoji. Subject under 60 characters, preview under 90.
Return only JSON: {"subject":"...","preheader":"...","intro":"..."}`, { maxTokens: 800 }));
      if (out.intro && /\{\{first_name\}\}/.test(out.intro)) intro = String(out.intro).slice(0, 1200);
      if (out.subject) subject = String(out.subject).slice(0, 120); if (out.preheader) preheader = String(out.preheader).slice(0, 140);
    } catch (e) { /* template copy is fine */ }
  }
  return { subject, preheader, intro, monthLabel, market, news, listings, openHouses, events, cta: SITE ? { label: "Search homes", url: `${SITE}/search/${me.slug ? "?agent=" + enc(me.slug) : ""}` } : null,
    agent: { name: me.name || "", title: me.title || "", phone: me.phone || "", email: me.email || "", photo: me.photoUrl || "", display: agent.display, byline: agent.byline, firm: FIRM, primary: brand.primary, accent: brand.accent, logoDark: /^https:/.test(brand.logoDark || "") ? brand.logoDark : "" } };
}

/* Send an issue. The footer (brokerage, address, unsubscribe) is always added here, never trusted from the browser. */
async function sendIssue(uid, issue, aud, { test = false, address = "", issueId = "" } = {}) {
  const me = await profile(uid), mailing = ADDRESS || address;
  if (!mailing) throw Object.assign(new Error("Add the brokerage mailing address in newsletter settings first (required by CAN-SPAM)."), { status: 400 });
  if (!API || !SECRET) throw Object.assign(new Error("Set PUBLIC_API_URL and UNSUBSCRIBE_SECRET on the server first."), { status: 500 });
  const out = NR.render({ ...issue, address: mailing, license: LICENSE });
  const list = test ? [{ id: "test", name: me.name, email: me.email }] : await recipients(uid, aud);
  if (test && !EMAIL_RE.test(me.email || "")) throw Object.assign(new Error("Add your email to your profile to get a test."), { status: 400 });
  if (!list.length) throw Object.assign(new Error("No contacts match this audience."), { status: 400 });
  if (list.length > MAX_RECIPIENTS) throw Object.assign(new Error(`That’s ${list.length} people. The limit is ${MAX_RECIPIENTS} per issue.`), { status: 400 });
  let sent = 0, failed = 0;
  for (let i = 0; i < list.length; i += 100) {
    const chunk = list.slice(i, i + 100).map(c => { const v = { first_name: String(c.name || "").trim().split(/\s+/)[0] || "there", unsubscribe_url: test ? `${API}/api/unsubscribe?t=test` : unsubUrl(uid, c.id) };
      return { from: fromLine(me.name), to: [c.email], subject: (test ? "[Test] " : "") + out.subject, html: NR.personalize(out.html, v, true), text: NR.personalize(out.text, v), ...(EMAIL_RE.test(me.email || "") ? { reply_to: me.email } : {}),
        headers: { "List-Unsubscribe": `<${v.unsubscribe_url}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } }; });
    try { await sendBatch(chunk); sent += chunk.length; } catch (e) { failed += chunk.length; }
  }
  if (!test) await putDoc(`agent/${uid}/crm/newsletters/${issueId || newId("nl")}`, { ...issue, status: failed && !sent ? "failed" : "sent", sentAt: new Date().toISOString(), recipients: list.length, sent, failed, audience: aud || null });
  return { recipients: list.length, sent, failed };
}

/* Is a scheduled issue due today? */
function due(n, today) {
  if (!n || !n.auto) return false;
  const d = new Date(today + "T12:00:00Z"), last = n.lastIssueDate || "";
  if (last === today) return false;
  if (n.frequency === "monthly") return d.getUTCDate() === Number(n.monthday || 1);
  if (d.getUTCDay() !== Number(n.weekday ?? 2)) return false;
  if (n.frequency === "biweekly" && last) return (Date.parse(today) - Date.parse(last)) / 864e5 >= 13;
  return true;
}
async function runScheduled(uid, settings, today) {
  const n = settings.newsletter || {};
  if (!due(n, today)) return null;
  const issue = await buildIssue(uid, settings, today), id = newId("nl");
  let result;
  if (n.mode === "send") result = { status: "sent", ...(await sendIssue(uid, issue, n.audience, { address: n.address, issueId: id })) };
  else {
    await putDoc(`agent/${uid}/crm/newsletters/${id}`, { ...issue, status: "draft", createdAt: new Date().toISOString(), audience: n.audience || null, scheduledFor: today });
    const me = await profile(uid);
    if (EMAIL_RE.test(me.email || "")) await sendEmail({ to: me.email, subject: `Your newsletter is ready to review: ${issue.subject}`, text: `Hi ${String(me.name || "").split(" ")[0]},\n\nThis ${n.frequency || "week"}'s newsletter is drafted with the latest Colorado news${issue.listings.length ? ", your listings" : ""}${issue.openHouses.length ? ", and your open houses" : ""}.\n\nReview and send it: ${SITE}/search/#agent (Newsletters)\n`, fromName: FIRM }).catch(() => {});
    result = { status: "draft" };
  }
  await putDoc(`agent/${uid}/settings`, { ...settings, newsletter: { ...n, lastIssueDate: today } });
  return result;
}
module.exports = { token, verify, unsubUrl, recipients, match, buildIssue, sendIssue, due, runScheduled };
