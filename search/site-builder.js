/* =========================================================================
   The Miller Group: AI website and landing page builder for agents.
   - Websites (multi-page) and landing pages for ads: listing spotlights,
     home valuation, buyer guides, open houses, neighborhood guides, events.
   - Pick a template and the page fills itself from the agent's profile,
     brand, listings, and market stats. AI can write or rewrite the whole page
     or one section from a short description.
   - Every section is editable: reorder, hide, duplicate, add, delete; theme
     fonts, corners, light or dark; SEO title, description, keyword, share
     image, and a live SEO score.
   - Publishing puts the page at /p/?a=<agent>&p=<page> (and /a/<agent>/<page>
     on the server for search engines). Form leads land in the agent's
     contacts (folder "Website leads") and the brokerage lead list.
   Pages are stored at sites/<agent id>/pages/<page id>.
   ========================================================================= */
(function () {
  const SB = window.SiteBuilder = { pages: {}, edit: null, sel: null, view: "desktop", tab: "content", msg: "", busy: false, watching: false, prompt: "" };
  const C = window.MG_CONFIG || {};
  const R = () => window.SiteRender;
  const now = () => new Date().toISOString();
  const uid = () => Store.crmOwner;
  const newId = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const slugify = s => String(s || "").toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 60) || "page";
  const clip = (s, n) => String(s == null ? "" : s).slice(0, n);
  const deep = o => JSON.parse(JSON.stringify(o));

  const TEMPLATES = [
    ["website", "website", "My website", "A complete agent website: hero, about, listings, services, reviews, areas, and contact"],
    ["selling", "website", "Selling page", "How you sell homes, with a home value form"],
    ["buying", "website", "Buying page", "Your buyer process, loan basics, and a consultation form"],
    ["listing", "landing", "Listing spotlight", "One home, big photos, details, and a showing form. Built for ads."],
    ["valuation", "landing", "What’s my home worth?", "Home value lead capture for seller ads and farming"],
    ["openhouse", "landing", "Open house RSVP", "Date, time, the home, and an RSVP form"],
    ["buyerguide", "landing", "Free buyer guide", "First-time buyer lead magnet with Q&A"],
    ["neighborhood", "landing", "Neighborhood guide", "An area page that ranks in search: overview, homes, Q&A"],
    ["event", "landing", "Event or seminar", "Client events, homebuyer classes, and workshops"],
    ["blank", "landing", "Blank page", "Start from scratch"]
  ];

  /* ------------------------------ Data ------------------------------ */
  const path = id => `sites/${uid()}/pages/${id}`;
  SB.watch = function () {
    if (SB.watching || !Store.db || Store.demo || !uid()) return; SB.watching = true;
    Store.db.collection(`sites/${uid()}/pages`).onSnapshot(sn => { const m = {}; sn.docs.forEach(d => { m[d.id] = d.data(); }); SB.pages = m; if (agentPanel && agentPanel.startsWith("sites")) renderAgent(); }, () => {});
  };
  function save(id, page) {
    if (page) { page.updatedAt = now(); page.agentId = uid(); SB.pages[id] = page; } else delete SB.pages[id];
    if (Store.db && !Store.demo && uid()) { const ref = Store.db.doc(path(id)); (page ? ref.set(page) : ref.delete()).catch(() => { SB.msg = "Couldn’t save. Check your connection."; renderAgent(); }); }
  }
  const pages = () => Object.entries(SB.pages).filter(([, p]) => p).map(([id, p]) => ({ id, ...p })).sort((a, b) => (a.kind === b.kind ? (a.order || 0) - (b.order || 0) || (b.updatedAt || "").localeCompare(a.updatedAt || "") : a.kind === "website" ? -1 : 1));
  const cur = () => SB.edit ? SB.pages[SB.edit] : null;

  /* ------------------------------ Context ------------------------------ */
  const agent = () => window.AgentBrand ? AgentBrand.current(Store.crmOwner) : { id: uid(), name: IDX.BROKER.name, phone: IDX.BROKER.phone, email: "", title: "Broker", display: "The Miller Group", byline: "", firm: "The Miller Group", brand: null, link: IDX.APP_URL };
  const profile = () => Store.site || {};
  const market = () => window.Presentation ? Presentation._t.market() : {};
  const pool = () => typeof marketingPool === "function" ? marketingPool() : [];
  const snap = l => l ? { key: l.key, address: l.address, price: l.price, beds: l.beds, baths: l.baths, sqft: l.sqft, hood: l.hood, city: l.city, status: l.status, year: l.year, photo: (l.photos || [])[0] || "", photos: (l.photos || []).slice(0, 12), remarks: l.remarks || "", office: l.office || "", exclusive: !!l.exclusive } : null;
  const mine = () => { const a = agent(); return pool().filter(l => l.exclusive || /miller/i.test(l.office || "") || (l.agent && a.name && l.agent === a.name)); };
  function listingItems(s) {
    let items = s.source === "area" && s.area ? pool().filter(l => [l.hood, l.city].join(" ").toLowerCase().includes(String(s.area).toLowerCase())) : mine();
    if (!items.length && s.source !== "area") items = pool();
    return items.filter(l => l.status !== "Closed").slice(0, Math.max(1, Math.min(12, +s.max || 6))).map(snap);
  }
  const allPhotos = () => { const out = []; const p = cur(); (p && p.sections || []).forEach(s => { if (s.home) (s.home.photos || []).forEach(u => out.push(u)); }); pool().slice(0, 30).forEach(l => (l.photos || []).slice(0, 3).forEach(u => out.push(u))); return [...new Set(out)].slice(0, 40); };
  const money = n => n ? "$" + Math.round(n).toLocaleString("en-US") : "";

  /* ------------------------------ Templates (no AI needed) ------------------------------ */
  function build(tpl, opts = {}) {
    const a = agent(), p = profile(), m = market(), l = opts.key ? pool().find(x => x.key === opts.key) : null, h = snap(l), first = String(a.name || "").split(" ")[0];
    const areas = String(p.areas || (p.presStats && p.presStats.areas) || "Denver metro").split(/,|;| and /).map(x => x.trim()).filter(Boolean).slice(0, 4);
    const quotes = (p.testimonials || []).filter(q => q && q.quote).map(q => ({ quote: q.quote, name: [q.name, q.place].filter(Boolean).join(", ") }));
    const bio = p.presBio || p.bio || `I help buyers and sellers across ${areas.join(", ")} with clear advice, strong marketing, and steady communication from the first call to closing day.`;
    const statsItems = [p.presStats && p.presStats.homes ? { value: p.presStats.homes, label: "Homes sold" } : null, p.presStats && p.presStats.years ? { value: "Since " + p.presStats.years, label: "Serving Colorado" } : null,
      m.median ? { value: money(m.median), label: `Metro median price (${m.asOf || "latest"})` } : null, m.dom ? { value: m.dom + " days", label: "Metro median days on market" } : null].filter(Boolean).slice(0, 4);
    const S = (type, o) => ({ id: newId("s"), type, ...o });
    const form = (purpose, heading, body, button, thanks) => S("form", { eyebrow: "Let’s talk", heading, body, purpose, button, thankYou: thanks || `Thank you! ${first} will be in touch shortly.`, fields: { phone: true, address: purpose === "valuation", message: purpose !== "rsvp", guests: purpose === "rsvp" } });
    const services = S("services", { heading: "How I can help", items: [
      { title: "Selling your home", body: "Pricing from real comparable sales, a pre-listing walk-through, professional photos, and a marketing plan built for your home." },
      { title: "Buying a home", body: "A clear road to closed: financing options, smart offer strategy, and every contract deadline tracked for you." },
      { title: "Investing", body: "Rental and value-add analysis, 1031 exchange timing, and introductions to trusted local partners." }] });
    const areasSec = S("neighborhoods", { heading: "Neighborhoods I know well", body: "Every area has its own pace, prices, and personality. Here’s where I spend most of my time.", items: areas.map(n => ({ name: n, body: `Homes, market trends, and local favorites in ${n}. Ask me what’s selling right now.` })) });
    const mkt = statsItems.length ? S("stats", { heading: "", items: statsItems }) : null;
    const reviews = quotes.length ? S("testimonials", { heading: "What clients say", items: quotes.slice(0, 3) }) : null;
    const base = { kind: tpl === "website" || tpl === "selling" || tpl === "buying" ? "website" : "landing", template: tpl, theme: { font: "editorial", radius: "soft", mode: "light" }, published: false, createdAt: now() };
    const hoodName = opts.area || areas[0] || "Denver";
    let page;
    switch (tpl) {
      case "website": page = { title: "Home", navTitle: "Home", slug: "home", order: 0, sections: [
        S("hero", { eyebrow: a.brand ? a.byline : a.firm, headline: a.brand && a.tagline ? a.tagline : `Real estate in ${areas.slice(0, 2).join(" and ")}, done right`, sub: `I’m ${a.name}. I help people buy and sell homes with honest advice, sharp pricing, and marketing that gets results.`, cta: "Let’s talk", cta2: "Search homes", image: (mine()[0] || {}).photos?.[0] || "", imageAlt: "A home in " + (areas[0] || "Denver") }),
        S("about", { heading: `Meet ${a.name}`, body: bio, photo: a.photo }), mkt, services, S("listings", { heading: "Featured homes", source: "mine", max: 6 }), reviews, areasSec,
        S("faq", { heading: "Questions and answers", items: [{ q: "How much is my home worth?", a: "It depends on recent nearby sales, condition, and timing. I’ll put together a free, no-pressure market analysis using real comparable sales." }, { q: "How do I get started buying?", a: "Start with a quick call. We’ll talk about your goals, get you connected with a lender, and set up a home search that sends new matches the moment they list." }, { q: "How are agents paid?", a: "Compensation is negotiable and agreed to in writing before we start. I’ll explain your options clearly." }] }),
        form("contact", "Ready when you are", "Tell me a little about what you’re looking for, and I’ll reach out within one business day.", "Send")] }; break;
      case "selling": page = { title: "Selling", navTitle: "Sell", slug: "sell", order: 1, sections: [
        S("hero", { style: "split", eyebrow: "Selling", headline: "Sell with a plan, not a guess", sub: "Pricing grounded in real sales, a home that shows its best, and marketing that reaches the right buyers.", cta: "Get my home’s value", image: (mine()[0] || {}).photos?.[0] || "", imageAlt: "Home for sale" }),
        S("services", { heading: "My selling process", items: [{ title: "1. Price it right", body: "A comparative market analysis with adjustments you can see, and a clear recommended range." }, { title: "2. Prepare and present", body: "A pre-listing walk-through, trusted vendors, and professional photography." }, { title: "3. Market and negotiate", body: "MLS, syndication, social, and email exposure, then steady negotiation through inspection, appraisal, and closing." }] }),
        mkt, reviews, form("valuation", "What’s your home worth?", "Share your address and I’ll send a free market analysis based on recent sales nearby. No pressure, no obligation.", "Get my home value")] }; break;
      case "buying": page = { title: "Buying", navTitle: "Buy", slug: "buy", order: 2, sections: [
        S("hero", { style: "split", eyebrow: "Buying", headline: "Find the right home, then win it", sub: "From pre-approval to keys in hand, I’ll guide every step and track every deadline.", cta: "Book a buyer consultation", cta2: "Search homes", image: (mine()[1] || mine()[0] || {}).photos?.[0] || "", imageAlt: "Home for sale" }),
        S("services", { heading: "How we’ll work together", items: [{ title: "Get pre-approved", body: "I’ll connect you with at least three trusted lenders. Compare and choose freely." }, { title: "Tour and compare", body: "A focused search, instant alerts, and honest takes on every home we see." }, { title: "Win the right offer", body: "Offer strategy built on what the seller cares about, not just price." }] }),
        S("faq", { heading: "First-time buyer questions", items: [{ q: "How much do I need for a down payment?", a: "Some loans allow as little as 3 to 3.5% down, and VA and USDA loans may require none. Colorado also has down payment assistance programs. A lender confirms what you qualify for." }, { q: "How long does it take?", a: "Most purchases close about 30 days after an accepted offer, depending on the loan and contract deadlines." }] }),
        form("contact", "Let’s plan your search", "Tell me where and when you’d like to move, and I’ll set up a quick consultation.", "Book a consultation")] }; break;
      case "listing": page = { title: h ? h.address : "Listing spotlight", slug: slugify(h ? h.address : "listing"), sections: [
        S("hero", { eyebrow: h && h.status === "Coming Soon" ? "Coming soon" : "Now available", headline: h ? h.address : "Your next home", sub: h ? [money(h.price), [h.beds && h.beds + " beds", h.baths && h.baths + " baths", h.sqft && Number(h.sqft).toLocaleString() + " sq ft"].filter(Boolean).join(" · "), h.hood].filter(Boolean).join("  ·  ") : "", cta: "Schedule a showing", image: h ? h.photo : "", imageAlt: h ? `Front of ${h.address}` : "" }),
        S("featured", { home: h, cta: "Schedule a showing" }), h && h.photos.length > 1 ? S("gallery", { heading: "Photos", images: h.photos.slice(1, 10), alts: h.photos.slice(1, 10).map((_, i) => `${h.address} photo ${i + 2}`) }) : null,
        form("showing", "See it in person", `Pick a time that works and ${first} will confirm your private showing.`, "Request a showing")] }; break;
      case "valuation": page = { title: "What’s my home worth?", slug: "home-value", sections: [
        S("hero", { style: "split", eyebrow: "Free home value", headline: `What’s your ${hoodName} home worth today?`, sub: "Get a free market analysis based on real recent sales near you, not an automated guess.", cta: "Get my home value", image: (mine()[0] || {}).photos?.[0] || "", imageAlt: "A home in " + hoodName }),
        S("services", { heading: "What you’ll get", items: [{ title: "Real comparable sales", body: "The homes most like yours that sold recently, with adjustments you can see." }, { title: "A suggested price range", body: "Where your home is likely to sell in today’s market, and why." }, { title: "Your options", body: "Selling now, later, or not at all. Clear numbers to decide on your timing." }] }),
        mkt, reviews, form("valuation", "Request your free home value", "Add your address and the best way to reach you. You’ll hear back within one business day.", "Get my home value", "Thank you! Your home value report is on its way within one business day.")] }; break;
      case "openhouse": page = { title: h ? `Open house: ${h.address}` : "Open house", slug: slugify("open-house-" + (h ? h.address : "")), sections: [
        S("hero", { eyebrow: "Open house", headline: h ? h.address : "Open house", sub: opts.when || "Saturday, 11 AM to 2 PM", cta: "RSVP", image: h ? h.photo : "", imageAlt: h ? `Front of ${h.address}` : "" }),
        S("featured", { home: h, event: opts.when || "Saturday, 11 AM to 2 PM", cta: "RSVP" }), form("rsvp", "Save your spot", "RSVP and we’ll send a reminder plus the disclosures before you visit.", "RSVP", "You’re on the list! See you there.")] }; break;
      case "buyerguide": page = { title: "Free first-time buyer guide", slug: "buyer-guide", sections: [
        S("hero", { style: "split", eyebrow: "Free guide", headline: "Your road to your first home", sub: "A plain-English guide to budgets, loan options, Colorado down payment assistance, offers, and closing.", cta: "Send me the guide", image: (mine()[0] || {}).photos?.[0] || "", imageAlt: "A first home" }),
        S("services", { heading: "Inside the guide", items: [{ title: "Budget and buying power", body: "What your payment really includes, and how to plan cash to close." }, { title: "Loan options", body: "FHA, conventional, VA, USDA, and how to compare them." }, { title: "Down payment assistance", body: "Colorado programs to ask a lender about." }, { title: "Offers and deadlines", body: "How offers win and what happens after you’re under contract." }] }),
        S("faq", { heading: "Quick answers", items: [{ q: "Do I need 20% down?", a: "No. Many loans allow much less, and some none. A lender confirms what fits you." }, { q: "When should I talk to an agent?", a: "Early. A quick call helps you avoid surprises and plan your timing." }] }),
        form("guide", "Get the free guide", "Tell me where to send it. No spam, ever.", "Send me the guide", "Thanks! Your guide is on its way.")] }; break;
      case "neighborhood": page = { title: `${hoodName} homes and neighborhood guide`, slug: slugify(hoodName + "-guide"), sections: [
        S("hero", { eyebrow: "Neighborhood guide", headline: `Living in ${hoodName}`, sub: `Homes, prices, and what to know about ${hoodName}, from a local agent.`, cta: "Ask me about " + hoodName, image: (pool().find(l => (l.hood || "") === hoodName) || {}).photos?.[0] || "", imageAlt: "Homes in " + hoodName }),
        S("text", { heading: `${hoodName} at a glance`, body: `[Describe the feel of ${hoodName}: streets, home styles, parks, shops, and getting around. Keep it to facts about the place, not who should live there.]` }),
        mkt, S("listings", { heading: `Homes for sale in ${hoodName}`, source: "area", area: hoodName, max: 6 }),
        S("faq", { heading: `${hoodName} questions`, items: [{ q: `What do homes cost in ${hoodName}?`, a: "Prices vary by street, size, and condition. Ask me for a current snapshot of recent sales." }, { q: `Is now a good time to buy in ${hoodName}?`, a: "It depends on your goals and timing. I’ll walk you through current inventory and pricing." }] }),
        form("contact", `Thinking about ${hoodName}?`, "Tell me what you’re looking for and I’ll send what’s on the market now.", "Send")] }; break;
      case "event": page = { title: "You’re invited", slug: "event", sections: [
        S("hero", { eyebrow: "You’re invited", headline: opts.title || "Homebuyer seminar", sub: opts.when || "Thursday, 6 to 7:30 PM · Free", cta: "Save my seat" }),
        S("text", { heading: "What to expect", body: "- A plain-English walk-through of the process\n- Loan options and Colorado assistance programs\n- Time for your questions" }),
        form("rsvp", "Save your seat", "Space is limited. RSVP and we’ll send the details.", "RSVP", "You’re registered! Watch your email for details.")] }; break;
      default: page = { title: "New page", slug: "new-page", sections: [S("hero", { headline: "Your headline here", sub: "A short line about what this page offers.", cta: "Get in touch" }), form("contact", "Get in touch", "", "Send")] };
    }
    page.sections = page.sections.filter(Boolean);
    page.sections.forEach(s => { if (s.type === "listings") s.items = listingItems(s); });
    const kw = tpl === "neighborhood" ? `${hoodName} homes for sale` : tpl === "valuation" ? `${hoodName} home value` : tpl === "listing" && h ? `${h.address}` : tpl === "buyerguide" ? "first-time home buyer Colorado" : tpl === "website" ? `${areas[0] || "Denver"} real estate agent` : "";
    page.seo = { keyword: kw, title: clip(seoTitle(page.title, a, kw), 60), description: clip(seoDesc(tpl, a, h, hoodName), 160), image: "", noindex: false };
    return { ...base, ...page };
  }
  function seoTitle(title, a, kw) { const t = kw && !title.toLowerCase().includes(kw.toLowerCase()) ? `${title}: ${kw}` : title; return `${t} | ${a.display}`.length <= 60 ? `${t} | ${a.display}` : t; }
  function seoDesc(tpl, a, h, hood) {
    const d = { website: `${a.name} helps buyers and sellers across ${hood} with honest advice, smart pricing, and strong marketing. Search homes or get your free home value.`,
      listing: h ? `${h.address}: ${[h.beds && h.beds + " beds", h.baths && h.baths + " baths", h.sqft && Number(h.sqft).toLocaleString() + " sq ft"].filter(Boolean).join(", ")} in ${h.hood || h.city || "Denver"}. See photos, details, and book a showing.` : "",
      valuation: `Find out what your ${hood} home is worth with a free market analysis from ${a.name}, based on real recent sales near you.`,
      neighborhood: `Thinking about ${hood}? See homes for sale, prices, and local insight from ${a.name}, ${a.display}.`,
      buyerguide: `Free first-time buyer guide: budgets, loan options, Colorado down payment assistance, offers, and closing, from ${a.name}.`,
      selling: `Selling in ${hood}? See how ${a.name} prices, prepares, and markets homes, and get a free home value.`,
      buying: `Buying in ${hood}? ${a.name} guides you from pre-approval to closing. Book a free buyer consultation.` };
    return d[tpl] || `${a.name}, ${a.display}. Real estate in ${hood}.`;
  }

  /* ------------------------------ AI ------------------------------ */
  const ALLOWED = { hero: ["eyebrow", "headline", "sub", "cta", "cta2", "imageAlt", "style"], about: ["eyebrow", "heading", "body"], listings: ["eyebrow", "heading", "body"], featured: ["eyebrow", "heading", "body", "event", "cta"],
    services: ["eyebrow", "heading", "items"], stats: ["heading", "items"], testimonials: ["eyebrow", "heading"], neighborhoods: ["eyebrow", "heading", "body", "items"], gallery: ["heading"], video: ["heading"], text: ["eyebrow", "heading", "body"],
    faq: ["heading", "items"], cta: ["heading", "body", "cta"], form: ["eyebrow", "heading", "body", "button", "thankYou"] };
  // Keep only fields the AI is allowed to write; images, listings, and testimonials never come from the AI.
  function mergeAI(sec, ai) {
    if (!ai || typeof ai !== "object") return sec;
    const out = { ...sec };
    (ALLOWED[sec.type] || []).forEach(k => {
      if (!(k in ai)) return;
      if (k === "items") { if (sec.type !== "stats" && Array.isArray(ai.items)) out.items = ai.items.filter(i => i && typeof i === "object").slice(0, 8).map(i => sec.type === "faq" ? { q: clip(i.q, 200), a: clip(i.a, 1200) } : sec.type === "neighborhoods" ? { name: clip(i.name, 80), body: clip(i.body, 600), image: "" } : { title: clip(i.title, 100), body: clip(i.body, 600) }); }
      else if (k === "style") { if (["photo", "split"].includes(ai.style)) out.style = ai.style; }
      else out[k] = clip(ai[k], k === "body" ? 4000 : 300);
    });
    return out;
  }
  function facts() {
    const a = agent(), p = profile(), m = market(), pg = cur();
    const homes = (pg.sections || []).filter(s => s.home).map(s => s.home).map(h => ({ address: h.address, price: h.price, beds: h.beds, baths: h.baths, sqft: h.sqft, year_built: h.year, neighborhood: h.hood, city: h.city, description: h.remarks, listing_brokerage: h.exclusive ? "" : h.office }));
    return { agent: { name: a.name, title: a.title, business_name: a.brand ? a.display : "", brokerage: a.firm, phone: a.phone, areas: p.areas || (p.presStats || {}).areas || "", bio: p.presBio || p.bio || "", languages: p.languages || "", stats: p.presStats || {} },
      market: m.median ? { area: m.area, as_of: m.asOf, median_price: m.median, days_on_market: m.dom, months_supply: m.monthsSupply, source: m.source } : null, homes, page_type: pg.template, page_title: pg.title };
  }
  const RULES = `Rules:
- Follow U.S. Fair Housing advertising rules: describe homes, features, and places, never the people who should live there. No references to race, color, religion, sex, disability, familial status, national origin, or other protected classes, and no steering words (for example "perfect for families", "exclusive neighborhood", "walking distance to church", "bachelor pad").
- Use only facts given. Never invent numbers, sales results, awards, reviews, school ratings, or features. Where a fact is needed but missing, write a [bracketed note] for the agent.
- Don't promise results or values. Agent compensation is negotiable; never imply a fixed rate.
- Plain, warm, confident, specific. Short paragraphs. No emoji, no hype words like "stunning" more than once, no exclamation-heavy copy.
- Don't name the brokerage in the copy; the page adds "${(agent().byline || "The Miller Group")}" automatically.`;
  async function aiPage(instruction) {
    const sample = await window.claude?.use?.("sample");
    if (!sample) { SB.msg = "AI writing isn’t connected here yet. Templates fill in the page; edit any section directly."; renderAgent(); return; }
    const pg = cur(); SB.busy = true; SB.msg = ""; renderAgent();
    const shape = pg.sections.map(s => ({ id: s.id, type: s.type, ...Object.fromEntries((ALLOWED[s.type] || []).filter(k => s[k] != null).map(k => [k, s[k]])) }));
    try {
      const out = await sample.json(`You are a senior real estate marketer and conversion copywriter writing a web page for a Denver-area agent.
Page facts: ${JSON.stringify(facts())}
Current page (keep the same sections, ids, and types; rewrite their text): ${JSON.stringify(shape)}
The agent asks: ${instruction || "Write strong, specific copy for every section that turns visitors into leads."}
${RULES}
- SEO: pick one realistic local focus keyword, use it naturally in the main headline, the SEO title (30 to 60 characters), and the meta description (120 to 160 characters).
Return only JSON: {"title": short page title, "seo": {"keyword": "...", "title": "...", "description": "..."}, "sections": [{"id": same id, ...rewritten fields}]}`, { maxTokens: 6000 });
      if (out && Array.isArray(out.sections)) {
        pg.sections = pg.sections.map(s => mergeAI(s, out.sections.find(x => x && x.id === s.id)));
        if (out.title) pg.title = clip(out.title, 80);
        if (out.seo) pg.seo = { ...pg.seo, keyword: clip(out.seo.keyword, 80), title: clip(out.seo.title, 70), description: clip(out.seo.description, 170) };
        save(SB.edit, pg); SB.msg = "Page rewritten. Read it through, fill any [bracketed notes], and make it sound like you.";
      } else SB.msg = "The AI didn’t return a page. Try again.";
    } catch (e) { SB.msg = e && e.code === "not_granted" ? "AI writing was turned off for this page." : "The AI didn’t come through. Try again."; }
    SB.busy = false; renderAgent();
  }
  async function aiSection(i, instruction) {
    const sample = await window.claude?.use?.("sample"), pg = cur(), s = pg.sections[i];
    if (!sample) { SB.msg = "AI writing isn’t connected here yet."; renderAgent(); return; }
    SB.busy = true; renderAgent();
    try {
      const out = await sample.json(`Rewrite one section of a real estate agent's web page.
Page facts: ${JSON.stringify(facts())}
Section (${s.type}): ${JSON.stringify(Object.fromEntries((ALLOWED[s.type] || []).filter(k => s[k] != null).map(k => [k, s[k]])))}
Instruction: ${instruction || "Make it more compelling and specific."}
${RULES}
Return only JSON with the same fields.`, { maxTokens: 2500 });
      pg.sections[i] = mergeAI(s, out); save(SB.edit, pg); SB.msg = "Section updated.";
    } catch (e) { SB.msg = "The AI didn’t come through. Try again."; }
    SB.busy = false; renderAgent();
  }
  async function aiSEO() {
    const sample = await window.claude?.use?.("sample"), pg = cur();
    if (!sample) { const a = agent(); pg.seo = { ...pg.seo, title: clip(seoTitle(pg.title, a, pg.seo.keyword), 60), description: clip(seoDesc(pg.template, a, (pg.sections.find(s => s.home) || {}).home, (profile().areas || "Denver").split(",")[0]), 160) }; save(SB.edit, pg); SB.msg = "SEO filled from the page. Connect AI for tailored suggestions."; renderAgent(); return; }
    SB.busy = true; renderAgent();
    try {
      const out = await sample.json(`You are a local SEO specialist for real estate in the Denver metro. Page facts: ${JSON.stringify(facts())}. Page text: ${JSON.stringify(pg.sections.map(s => [s.headline, s.heading, s.sub, s.body].filter(Boolean).join(" ")).join(" ").slice(0, 3000))}
Suggest the best focus keyword (realistic search phrase, local), an SEO title of 30 to 60 characters containing it, a meta description of 120 to 160 characters containing it with a call to action, and 8 related keyword ideas. Fair Housing rules apply.
Return only JSON: {"keyword": "...", "title": "...", "description": "...", "ideas": ["..."]}`, { maxTokens: 1200 });
      pg.seo = { ...pg.seo, keyword: clip(out.keyword, 80), title: clip(out.title, 70), description: clip(out.description, 170) }; SB.ideas = (out.ideas || []).slice(0, 10).map(x => clip(x, 80)); save(SB.edit, pg); SB.msg = "SEO updated.";
    } catch (e) { SB.msg = "The AI didn’t come through. Try again."; }
    SB.busy = false; renderAgent();
  }

  /* ------------------------------ Rendering helpers ------------------------------ */
  function ctx(preview) {
    const a = agent(), site = (C.SITE_URL || "").replace(/\/$/, "");
    const live = pages().filter(p => p.kind === "website" && (p.published || preview));
    return { agent: { ...a, link: a.link }, firm: a.firm, license: C.LICENSE_TEXT && !/\[add/i.test(C.LICENSE_TEXT) ? C.LICENSE_TEXT : "", siteUrl: site, supabaseUrl: C.SUPABASE_URL, anonKey: C.SUPABASE_ANON_KEY, preview,
      nav: cur() && cur().kind === "website" ? live.map(p => ({ title: p.navTitle || p.title, href: "#", current: p.id === SB.edit })) : [] };
  }
  const themed = p => ({ ...p, theme: R().themeFrom(agent(), agent().brand ? { ...p.theme, primary: "", accent: "" } : p.theme) });
  function pageUrl(p) {
    const slug = (Store.site || {}).slug; if (!slug) return "";
    if (C.AGENT_PAGES_URL) return `${C.AGENT_PAGES_URL.replace(/\/$/, "")}/${slug}/${p.slug}`;
    return `${(C.SITE_URL || "").replace(/\/$/, "")}/p/?a=${encodeURIComponent(slug)}&p=${encodeURIComponent(p.slug)}`;
  }
  SB.previewHTML = (id, preview = true) => R().render(themed({ id, ...SB.pages[id] }), ctx(preview));

  /* ------------------------------ UI ------------------------------ */
  const FIELD = {
    hero: [["eyebrow", "Small line above the headline"], ["headline", "Headline"], ["sub", "Supporting line", "area"], ["cta", "Button"], ["cta2", "Second button (search homes)"], ["image", "Background photo", "image"], ["imageAlt", "Photo description (for search and screen readers)"], ["style", "Layout", "select", [["photo", "Full photo"], ["split", "Side by side"]]]],
    about: [["eyebrow", "Small line"], ["heading", "Heading"], ["body", "Bio", "area"], ["photo", "Photo (blank uses your headshot)", "image"]],
    listings: [["eyebrow", "Small line"], ["heading", "Heading"], ["body", "Intro", "area"], ["source", "Which homes", "select", [["mine", "My listings and off-market"], ["area", "Homes in an area"]]], ["area", "Area (for “Homes in an area”)"], ["max", "How many", "number"]],
    featured: [["key", "Listing", "listing"], ["eyebrow", "Small line"], ["heading", "Heading (blank uses the address)"], ["body", "Description (blank uses the listing remarks)", "area"], ["event", "Open house or event line"], ["cta", "Button"]],
    services: [["eyebrow", "Small line"], ["heading", "Heading"], ["items", "Items", "list", [["title", "Title"], ["body", "Text", "area"]]]],
    stats: [["heading", "Heading"], ["items", "Numbers", "list", [["value", "Number"], ["label", "Label"]]]],
    testimonials: [["eyebrow", "Small line"], ["heading", "Heading"], ["items", "Reviews (real clients only, with permission)", "list", [["quote", "Quote", "area"], ["name", "Name"]]]],
    neighborhoods: [["eyebrow", "Small line"], ["heading", "Heading"], ["body", "Intro", "area"], ["items", "Areas", "list", [["name", "Name"], ["body", "Text", "area"], ["image", "Photo link"]]]],
    gallery: [["heading", "Heading"], ["images", "Photos", "images"]],
    video: [["heading", "Heading"], ["url", "YouTube or Vimeo link"]],
    text: [["eyebrow", "Small line"], ["heading", "Heading"], ["body", "Text (use - for bullets, **bold**)", "area"]],
    faq: [["heading", "Heading"], ["items", "Questions", "list", [["q", "Question"], ["a", "Answer", "area"]]]],
    cta: [["heading", "Heading"], ["body", "Text", "area"], ["cta", "Button"]],
    form: [["eyebrow", "Small line"], ["heading", "Heading"], ["body", "Text", "area"], ["purpose", "Purpose", "select", [["contact", "Contact"], ["valuation", "Home value"], ["showing", "Showing request"], ["rsvp", "RSVP"], ["guide", "Guide download"]]], ["button", "Button"], ["thankYou", "Thank-you message"], ["fields", "Fields", "fields"]]
  };
  SB.html = function () {
    if (SB.edit && SB.pages[SB.edit]) return editorHTML();
    SB.edit = null;
    const ps = pages(), leads = leadCounts(), slug = (Store.site || {}).slug;
    return `<p class="addr">Build a website and landing pages for your ads in minutes. Pick a template and it fills itself from your profile, brand, listings, and market stats; then edit anything${window.claude ? ", or let AI rewrite it" : ""}. Leads from your forms land in your contacts.</p>
      ${!slug ? `<p class="note-c">Pick your link name in <button class="remove" data-panel="settings">Settings</button> so your pages have an address.</p>` : ""}
      <h3 class="agent-h">Start something new</h3><div class="sb-tpls">${TEMPLATES.map(([k, kind, t, d]) => `<button class="sb-tpl" data-sb-new="${k}"><span class="tag2">${kind === "website" ? "Website" : "Landing page"}</span><strong>${esc(t)}</strong><span>${esc(d)}</span></button>`).join("")}</div>
      <h3 class="agent-h">My pages</h3>${ps.length ? ps.map(p => `<div class="pcard"><div class="pcard-top"><div><strong>${esc(p.title)}</strong><p>${p.kind === "website" ? "Website page" : "Landing page"} · ${p.published ? "Live" : "Draft"} · ${when(p.updatedAt)}${leads[p.title] ? ` · ${leads[p.title]} lead${leads[p.title] > 1 ? "s" : ""}` : ""}</p></div><span class="pill ${p.published ? "ok" : ""}">${p.published ? "Live" : "Draft"}</span></div>
        <div class="links"><button data-sb-edit="${p.id}">Edit</button>${p.published && pageUrl(p) ? `<a href="${esc(pageUrl(p))}" target="_blank" rel="noopener">View live</a>` : ""}<button data-sb-dup="${p.id}">Duplicate</button><button data-sb-del="${p.id}">Delete</button></div></div>`).join("") : `<div class="empty"><strong>No pages yet</strong>Start with “My website” or a landing page above.</div>`}`;
  };
  function leadCounts() { const m = {}; Object.values(Store.crm.contacts || {}).forEach(c => { if (c && /^Website: /.test(c.source || "")) { const t = c.source.slice(9); m[t] = (m[t] || 0) + 1; } }); return m; }
  function fieldHTML(s, i, [k, label, kind, opts]) {
    const id = `sbf_${i}_${k}`, v = s[k];
    if (kind === "area") return `<label for="${id}">${esc(label)}</label><textarea id="${id}" rows="4" data-sb-f="${i}|${k}">${esc(v || "")}</textarea>`;
    if (kind === "select") return `<label for="${id}">${esc(label)}</label><select id="${id}" data-sb-f="${i}|${k}">${opts.map(([o, t]) => `<option value="${o}" ${(v || opts[0][0]) === o ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>`;
    if (kind === "number") return `<label for="${id}">${esc(label)}</label><input id="${id}" type="number" min="1" max="12" data-sb-f="${i}|${k}" value="${esc(v || 6)}">`;
    if (kind === "listing") { const cur0 = s.home ? s.home.key : ""; return `<label for="${id}">${esc(label)}</label><select id="${id}" data-sb-listing="${i}"><option value="">Choose a listing</option>${pool().map(l => `<option value="${esc(l.key)}" ${l.key === cur0 ? "selected" : ""}>${esc(l.address)} · ${short(l.price)}${l.exclusive ? " · Off-market" : ""}</option>`).join("")}</select>${s.home && !s.home.exclusive && s.home.office && !/miller/i.test(s.home.office) ? `<p class="note-c">This is another brokerage’s listing. You need their permission to advertise it, and their photos usually can’t be used.</p>` : ""}`; }
    if (kind === "image") { const ph = allPhotos(); return `<label for="${id}">${esc(label)}</label><input id="${id}" type="url" placeholder="https://… or pick below" data-sb-f="${i}|${k}" value="${esc(v && !String(v).startsWith("data:") ? v : "")}">${v && String(v).startsWith("data:") ? `<p class="addr">Using an uploaded photo. <button class="remove" data-sb-clearimg="${i}|${k}">Remove</button></p>` : ""}
      <div class="sb-ph">${ph.slice(0, 12).map(u => `<button type="button" class="${u === v ? "on" : ""}" data-sb-img="${i}|${k}|${esc(u)}" aria-label="Use this photo"><img src="${esc(u)}" alt="" loading="lazy"></button>`).join("")}<label class="sb-up">Upload<input type="file" accept="image/jpeg,image/png,image/webp" data-sb-upload="${i}|${k}" hidden></label></div>`; }
    if (kind === "images") { const ph = allPhotos(), sel = s.images || []; return `<label>${esc(label)}</label><div class="sb-ph">${[...new Set([...sel, ...ph])].slice(0, 24).map(u => `<button type="button" class="${sel.includes(u) ? "on" : ""}" data-sb-gal="${i}|${esc(u)}" aria-pressed="${sel.includes(u)}"><img src="${esc(u)}" alt="" loading="lazy">${sel.includes(u) ? `<b>${sel.indexOf(u) + 1}</b>` : ""}</button>`).join("") || `<p class="addr">Listing photos appear here.</p>`}</div>`; }
    if (kind === "fields") { const f = s.fields || {}; return `<label>${esc(label)}</label><div class="complist">${[["phone", "Phone"], ["address", "Address"], ["message", "Message"], ["guests", "Number of guests"]].map(([fk, ft]) => `<label><input type="checkbox" data-sb-fld="${i}|${fk}" ${f[fk] ? "checked" : ""}><span>${ft}</span></label>`).join("")}</div><p class="addr">Name and email are always asked. The consent line for calls, texts, and email is added automatically.</p>`; }
    if (kind === "list") return `<label>${esc(label)}</label>${(v || []).map((it, j) => `<div class="sb-item">${opts.map(([ik, il, ikind]) => ikind === "area" ? `<textarea rows="2" aria-label="${esc(il)}" placeholder="${esc(il)}" data-sb-it="${i}|${k}|${j}|${ik}">${esc(it[ik] || "")}</textarea>` : `<input aria-label="${esc(il)}" placeholder="${esc(il)}" data-sb-it="${i}|${k}|${j}|${ik}" value="${esc(it[ik] || "")}">`).join("")}<button class="remove" data-sb-itdel="${i}|${k}|${j}">Remove</button></div>`).join("")}<button class="btn ghost" type="button" data-sb-itadd="${i}|${k}">Add</button>`;
    return `<label for="${id}">${esc(label)}</label><input id="${id}" data-sb-f="${i}|${k}" value="${esc(v || "")}">`;
  }
  function editorHTML() {
    const p = cur(), a = agent(), seo = R().seoCheck(p, ctx(true)), url = pageUrl(p), names = Object.fromEntries(R().SECTION_TYPES);
    const sel = SB.sel != null ? p.sections[SB.sel] : null, th = p.theme || {};
    const tab = (k, t) => `<button role="tab" aria-selected="${SB.tab === k}" class="${SB.tab === k ? "on" : ""}" data-sb-tab="${k}">${t}</button>`;
    let side = "";
    if (SB.tab === "content") {
      side = `<div class="sb-ai"><label for="sbPrompt">${window.claude ? "Tell AI what you want" : "AI page writer"}</label><textarea id="sbPrompt" rows="2" data-sb-prompt placeholder="e.g. Luxury tone for Cherry Creek sellers. Emphasize my marketing and Spanish-language service.">${esc(SB.prompt)}</textarea>
        <div class="quick"><button class="btn gold" data-sb-ai ${SB.busy ? "disabled" : ""}>${SB.busy ? "Writing…" : "Write the whole page"}</button>${["Shorter and punchier", "More luxury", "Warmer and personal", "Add urgency"].map(x => `<button class="chip" data-sb-aiq="${esc(x)}" ${SB.busy ? "disabled" : ""}>${esc(x)}</button>`).join("")}</div></div>
        <h3 class="agent-h">Sections</h3><ol class="sb-secs">${p.sections.map((s, i) => `<li class="${SB.sel === i ? "on" : ""} ${s.hidden ? "off" : ""}"><button class="sb-name" data-sb-sel="${i}">${esc(names[s.type] || s.type)}<span>${esc(clip(s.headline || s.heading || (s.home && s.home.address) || "", 40))}</span></button>
          <span class="sb-acts"><button data-sb-mv="${i}|-1" aria-label="Move up" ${i ? "" : "disabled"}>↑</button><button data-sb-mv="${i}|1" aria-label="Move down" ${i < p.sections.length - 1 ? "" : "disabled"}>↓</button><button data-sb-hide="${i}" aria-label="${s.hidden ? "Show" : "Hide"}">${s.hidden ? "Show" : "Hide"}</button><button data-sb-copy="${i}" aria-label="Duplicate">Copy</button><button data-sb-rm="${i}" aria-label="Delete">×</button></span></li>`).join("")}</ol>
        <div class="row2"><select id="sbAdd" aria-label="Add a section">${R().SECTION_TYPES.map(([k, t]) => `<option value="${k}">${esc(t)}</option>`).join("")}</select><button class="btn ghost" data-sb-add>Add section</button></div>
        ${sel ? `<div class="tourform sb-edit"><h3 class="agent-h">${esc(names[sel.type])}</h3>${(FIELD[sel.type] || []).map(f => fieldHTML(sel, SB.sel, f)).join("")}
          ${window.claude && ALLOWED[sel.type] && ALLOWED[sel.type].length ? `<div class="quick"><button class="btn ghost" data-sb-aisec="${SB.sel}" ${SB.busy ? "disabled" : ""}>Rewrite this section with AI</button></div>` : ""}</div>` : `<p class="addr">Pick a section to edit it.</p>`}`;
    } else if (SB.tab === "design") {
      side = `<div class="tourform"><label for="sbFont">Fonts</label><select id="sbFont" data-sb-th="font">${[["editorial", "Editorial (Fraunces + Figtree)"], ["classic", "Classic (Cormorant + Inter)"], ["modern", "Modern (Montserrat + Inter)"], ["friendly", "Friendly (DM Serif + DM Sans)"]].map(([k, t]) => `<option value="${k}" ${(th.font || "editorial") === k ? "selected" : ""}>${t}</option>`).join("")}</select>
        <div class="row2"><div><label for="sbRad">Corners</label><select id="sbRad" data-sb-th="radius"><option value="soft" ${th.radius !== "sharp" ? "selected" : ""}>Soft</option><option value="sharp" ${th.radius === "sharp" ? "selected" : ""}>Sharp</option></select></div><div><label for="sbMode">Background</label><select id="sbMode" data-sb-th="mode"><option value="light" ${th.mode !== "dark" ? "selected" : ""}>Light</option><option value="dark" ${th.mode === "dark" ? "selected" : ""}>Dark</option></select></div></div>
        ${a.brand ? `<p class="addr">Colors come from your approved brand (${esc(a.display)}). <button class="remove" data-panel="agent-brand">My brand</button></p>` : `<div class="row2"><div><label for="sbP">Main color</label><input id="sbP" type="color" data-sb-th="primary" value="${esc(th.primary || "#141A26")}"></div><div><label for="sbA">Accent color</label><input id="sbA" type="color" data-sb-th="accent" value="${esc(th.accent || "#B8935A")}"></div></div>`}
        <label for="sbTitle">Page name</label><input id="sbTitle" data-sb-pg="title" value="${esc(p.title)}">${p.kind === "website" ? `<label for="sbNav">Menu label</label><input id="sbNav" data-sb-pg="navTitle" value="${esc(p.navTitle || "")}">` : ""}
        <label for="sbSlug">Page address</label><input id="sbSlug" data-sb-pg="slug" value="${esc(p.slug)}"><p class="addr">${url ? esc(url) : "Set your link name in Settings to see the address."}</p></div>`;
    } else {
      side = `<div class="sb-score"><b style="--s:${seo.score}">${seo.score}</b><span>SEO score</span></div><ul class="sb-checks">${seo.checks.map(([t, ok]) => `<li class="${ok ? "ok" : ""}">${ok ? "✓" : "•"} ${esc(t)}</li>`).join("")}</ul>
        <div class="tourform"><label for="sbKw">Focus keyword</label><input id="sbKw" data-sb-seo="keyword" value="${esc(p.seo.keyword || "")}" placeholder="e.g. Highland homes for sale">
        <label for="sbSt">Search title <span class="addr">${(p.seo.title || "").length}/60</span></label><input id="sbSt" maxlength="70" data-sb-seo="title" value="${esc(p.seo.title || "")}">
        <label for="sbSd">Meta description <span class="addr">${(p.seo.description || "").length}/160</span></label><textarea id="sbSd" rows="3" maxlength="170" data-sb-seo="description">${esc(p.seo.description || "")}</textarea>
        <label for="sbSi">Share image link (Facebook, LinkedIn, texts)</label><input id="sbSi" type="url" data-sb-seo="image" value="${esc(p.seo.image || "")}" placeholder="Blank uses the hero photo">
        <label class="check"><input type="checkbox" data-sb-noindex ${p.seo.noindex ? "checked" : ""}> Hide from search engines (good for ad-only pages)</label>
        <div class="quick"><button class="btn gold" data-sb-seoai ${SB.busy ? "disabled" : ""}>${window.claude ? "Optimize with AI" : "Fill from the page"}</button></div>
        ${SB.ideas && SB.ideas.length ? `<p class="addr">Keyword ideas: ${SB.ideas.map(esc).join(" · ")}</p>` : ""}
        <div class="sb-serp"><span>${esc(url || "your page address")}</span><b>${esc(p.seo.title || p.title)}</b><p>${esc(p.seo.description || "Add a meta description.")}</p></div>
        <p class="addr">Search engines read the server version of your page at ${C.AGENT_PAGES_URL ? esc(C.AGENT_PAGES_URL) + "/…" : "/a/&lt;you&gt;/&lt;page&gt; once the server is connected"}, with structured data for you, the brokerage${p.sections.some(s => s.type === "faq") ? ", and your Q&amp;A" : ""}.</p></div>`;
    }
    return `<button class="back" data-sb-back>‹ Websites and landing pages</button>
      <div class="colhead"><h2>${esc(p.title)}</h2><span class="pill ${p.published ? "ok" : ""}">${p.published ? "Live" : "Draft"}</span></div>
      <div class="quick"><button class="btn ${p.published ? "ghost" : "gold"}" data-sb-pub>${p.published ? "Unpublish" : "Publish"}</button>${p.published && url ? `<a class="btn ghost" href="${esc(url)}" target="_blank" rel="noopener">View live</a><button class="btn ghost" data-sb-copylink>Copy link</button>` : ""}<button class="btn ghost" data-sb-dl>Download HTML</button></div>
      ${SB.msg ? `<p class="msg" role="status">${esc(SB.msg)}</p>` : ""}
      <div class="sb-wrap"><div class="sb-side"><div class="mk-tabs" role="tablist">${tab("content", "Content")}${tab("design", "Design")}${tab("seo", `SEO · ${seo.score}`)}</div>${side}</div>
      <div class="sb-prev"><div class="sb-pbar"><span>Preview</span><span class="ps-sides"><button class="${SB.view === "desktop" ? "on" : ""}" data-sb-view="desktop">Desktop</button><button class="${SB.view === "phone" ? "on" : ""}" data-sb-view="phone">Phone</button></span></div>
        <iframe class="sb-frame ${SB.view}" title="Page preview" sandbox="allow-scripts" srcdoc="${esc(SB.previewHTML(SB.edit))}"></iframe></div></div>
      <p class="addr">Every page shows ${a.brand ? esc(a.display) + ", " + esc(a.byline) + "," : esc(a.firm)} in the header and footer, Equal Housing Opportunity, and listing brokerage credits, as Colorado and IDX rules require.</p>`;
  }

  if (!document.getElementById("sbStyles")) {
    const st = document.createElement("style"); st.id = "sbStyles";
    st.textContent = `.sb-tpls{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin-bottom:8px}.sb-tpl{text-align:left;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px 14px;color:var(--ink)}.sb-tpl:hover{border-color:var(--gold)}
.sb-tpl strong{display:block;margin:4px 0 2px}.sb-tpl span{font-size:12.5px;color:var(--ink-2)}.sb-tpl .tag2{display:inline-block;font-size:11px;font-weight:600;color:var(--gold-strong);text-transform:uppercase;letter-spacing:.06em}
.pill{font-size:12px;font-weight:600;border-radius:999px;padding:3px 10px;background:var(--surface-2);color:var(--ink-2)}.pill.ok{background:color-mix(in srgb,var(--love) 18%,var(--surface));color:var(--ink)}
.sb-wrap{display:grid;grid-template-columns:minmax(0,380px) minmax(0,1fr);gap:16px;align-items:start;margin-top:10px}@media (max-width:900px){.sb-wrap{grid-template-columns:1fr}}
.sb-ai{background:var(--surface);border:1px solid var(--line);border-left:4px solid var(--gold);border-radius:12px;padding:12px}.sb-ai textarea{width:100%;margin:6px 0}.chip{border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:999px;padding:6px 10px;font-size:12.5px}
.sb-secs{list-style:none;padding:0;margin:0 0 10px}.sb-secs li{display:flex;align-items:center;gap:6px;border:1px solid var(--line);border-radius:10px;padding:6px 8px;margin-bottom:6px;background:var(--surface)}.sb-secs li.on{border-color:var(--gold)}.sb-secs li.off{opacity:.55}
.sb-name{flex:1;text-align:left;background:none;border:0;color:var(--ink);font-weight:600;padding:4px;min-width:0}.sb-name span{display:block;font-weight:400;font-size:12px;color:var(--ink-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sb-acts{display:flex;gap:2px}.sb-acts button{background:none;border:1px solid transparent;border-radius:6px;color:var(--ink-2);font-size:12px;padding:4px 6px;min-width:28px}.sb-acts button:hover{border-color:var(--line)}
.sb-edit{margin-top:10px}.sb-item{border:1px solid var(--line);border-radius:10px;padding:8px;margin-bottom:8px;display:grid;gap:6px}.sb-ph{display:grid;grid-template-columns:repeat(auto-fill,minmax(64px,1fr));gap:6px;margin:6px 0}.sb-ph button{position:relative;padding:0;border:2px solid var(--line);border-radius:8px;overflow:hidden;aspect-ratio:4/3;background:var(--surface-2)}.sb-ph button.on{border-color:var(--gold)}.sb-ph img{width:100%;height:100%;object-fit:cover}.sb-ph b{position:absolute;top:3px;left:3px;background:var(--gold);color:#fff;font-size:11px;border-radius:50%;width:18px;height:18px;display:grid;place-items:center}
.sb-up{display:grid;place-items:center;border:2px dashed var(--line);border-radius:8px;font-size:12px;color:var(--ink-2);cursor:pointer;aspect-ratio:4/3}
.sb-prev{position:sticky;top:10px}.sb-pbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;font-size:13px;color:var(--ink-2)}.sb-frame{width:100%;height:min(78vh,760px);border:1px solid var(--line);border-radius:12px;background:#fff;display:block;margin-inline:auto}.sb-frame.phone{width:390px;max-width:100%}
.sb-score{display:flex;align-items:center;gap:12px;margin:4px 0 10px}.sb-score b{width:64px;height:64px;border-radius:50%;display:grid;place-items:center;font:700 22px var(--serif);background:conic-gradient(var(--gold) calc(var(--s) * 1%),var(--surface-2) 0)}
.sb-checks{list-style:none;padding:0;margin:0 0 12px;font-size:13px}.sb-checks li{padding:3px 0;color:var(--ink-2)}.sb-checks li.ok{color:var(--ink)}
.sb-serp{border:1px solid var(--line);border-radius:10px;padding:12px;background:var(--surface);margin:10px 0}.sb-serp span{font-size:12px;color:var(--ink-2);word-break:break-all}.sb-serp b{display:block;color:#1a0dab;font-size:17px;font-weight:500;margin:2px 0}.sb-serp p{font-size:13px;margin:0;color:var(--ink-2)}`;
    document.head.appendChild(st);
  }

  /* ------------------------------ Events ------------------------------ */
  const edit = fn => { const p = cur(); if (!p) return; fn(p); save(SB.edit, p); };
  let typing = null;
  const soft = () => { clearTimeout(typing); typing = setTimeout(() => { const f = document.querySelector(".sb-frame"); if (f && SB.edit) f.srcdoc = SB.previewHTML(SB.edit); }, 350); };
  document.addEventListener("input", e => {
    const d = e.target.dataset || {};
    if (d.sbPrompt !== undefined) { SB.prompt = e.target.value; return; }
    if (d.sbF) { const [i, k] = d.sbF.split("|"); edit(p => { p.sections[+i][k] = k === "max" ? +e.target.value || 6 : e.target.value; if (k === "max" || k === "area") p.sections[+i].items = listingItems(p.sections[+i]); }); soft(); }
    else if (d.sbIt) { const [i, k, j, ik] = d.sbIt.split("|"); edit(p => { p.sections[+i][k][+j][ik] = e.target.value; }); soft(); }
    else if (d.sbSeo) { edit(p => { p.seo[d.sbSeo] = e.target.value; }); }
    else if (d.sbPg) { edit(p => { p[d.sbPg] = d.sbPg === "slug" ? slugify(e.target.value) : e.target.value; }); soft(); }
  });
  document.addEventListener("change", async e => {
    const d = e.target.dataset || {};
    if (d.sbF && e.target.tagName === "SELECT") { const [i, k] = d.sbF.split("|"); edit(p => { p.sections[+i][k] = e.target.value; if (k === "source") p.sections[+i].items = listingItems(p.sections[+i]); }); renderAgent(); }
    else if (d.sbSeo) renderAgent();
    else if (d.sbPg) { if (d.sbPg === "slug") { const p = cur(), clash = pages().some(x => x.id !== SB.edit && x.slug === p.slug); if (clash) { edit(x => { x.slug = x.slug + "-2"; }); SB.msg = "That address was taken, so I added -2."; } } renderAgent(); }
    else if (d.sbTh) { edit(p => { p.theme = { ...(p.theme || {}), [d.sbTh]: e.target.value }; }); renderAgent(); }
    else if (d.sbNoindex !== undefined) { edit(p => { p.seo.noindex = e.target.checked; }); renderAgent(); }
    else if (d.sbFld) { const [i, k] = d.sbFld.split("|"); edit(p => { p.sections[+i].fields = { ...(p.sections[+i].fields || {}), [k]: e.target.checked }; }); renderAgent(); }
    else if (d.sbListing) { const i = +d.sbListing, l = pool().find(x => x.key === e.target.value); edit(p => { p.sections[i].home = snap(l); }); renderAgent(); }
    else if (d.sbUpload) {
      const [i, k] = d.sbUpload.split("|"), f = e.target.files[0]; if (!f) return;
      const src = await shrink(f); if (!src) { SB.msg = "That photo couldn’t be used. Try a JPG or PNG."; renderAgent(); return; }
      const uploads = JSON.stringify(cur()).match(/data:image\//g) || []; if (uploads.length >= 6) { SB.msg = "Up to 6 uploaded photos per page. Use photo links for more."; renderAgent(); return; }
      edit(p => { p.sections[+i][k] = src; }); renderAgent();
    }
  });
  function shrink(file) { return new Promise(res => { if (!/^image\//.test(file.type) || file.size > 15e6) return res(null); const r = new FileReader(); r.onload = () => { const img = new Image(); img.onload = () => { try { const s = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement("canvas"); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL("image/jpeg", 0.78)); } catch (err) { res(null); } }; img.onerror = () => res(null); img.src = r.result; }; r.onerror = () => res(null); r.readAsDataURL(file); }); }
  document.addEventListener("click", async e => {
    const el = e.target.closest("[data-sb-new],[data-sb-edit],[data-sb-dup],[data-sb-del],[data-sb-back],[data-sb-tab],[data-sb-sel],[data-sb-mv],[data-sb-hide],[data-sb-copy],[data-sb-rm],[data-sb-add],[data-sb-ai],[data-sb-aiq],[data-sb-aisec],[data-sb-seoai],[data-sb-pub],[data-sb-dl],[data-sb-copylink],[data-sb-view],[data-sb-img],[data-sb-clearimg],[data-sb-gal],[data-sb-itadd],[data-sb-itdel]"); if (!el) return; const d = el.dataset;
    const go = () => { renderAgent(); };
    if (d.sbNew !== undefined) { const l = (typeof mk !== "undefined" && mk.key) ? mk.key : (mine()[0] || pool()[0] || {}).key; const id = newId("pg"); const p = build(d.sbNew, { key: l }); if (pages().some(x => x.slug === p.slug)) p.slug += "-" + Math.random().toString(36).slice(2, 5); save(id, p); SB.edit = id; SB.sel = 0; SB.tab = "content"; SB.msg = window.claude ? "Your page is filled in from your profile and listings. Edit any section, or tell AI what you want." : "Your page is filled in from your profile and listings. Edit any section."; agentPanel = "sites"; go(); window.scrollTo(0, 0); }
    else if (d.sbEdit !== undefined) { SB.edit = d.sbEdit; SB.sel = 0; SB.msg = ""; go(); window.scrollTo(0, 0); }
    else if (d.sbDup !== undefined) { const src = deep(SB.pages[d.sbDup]); src.title += " (copy)"; src.slug += "-copy"; src.published = false; save(newId("pg"), src); go(); }
    else if (d.sbDel !== undefined) { if (confirm("Delete this page? If it’s live, its link will stop working.")) { save(d.sbDel, null); go(); } }
    else if (d.sbBack !== undefined) { SB.edit = null; SB.msg = ""; go(); }
    else if (d.sbTab !== undefined) { SB.tab = d.sbTab; go(); }
    else if (d.sbSel !== undefined) { SB.sel = +d.sbSel; go(); }
    else if (d.sbMv !== undefined) { const [i, dir] = d.sbMv.split("|").map(Number); edit(p => { const j = i + dir; if (j < 0 || j >= p.sections.length) return; [p.sections[i], p.sections[j]] = [p.sections[j], p.sections[i]]; SB.sel = j; }); go(); }
    else if (d.sbHide !== undefined) { edit(p => { p.sections[+d.sbHide].hidden = !p.sections[+d.sbHide].hidden; }); go(); }
    else if (d.sbCopy !== undefined) { edit(p => { const s = deep(p.sections[+d.sbCopy]); s.id = newId("s"); p.sections.splice(+d.sbCopy + 1, 0, s); SB.sel = +d.sbCopy + 1; }); go(); }
    else if (d.sbRm !== undefined) { if (confirm("Remove this section?")) { edit(p => { p.sections.splice(+d.sbRm, 1); SB.sel = null; }); go(); } }
    else if (d.sbAdd !== undefined) { const t = document.getElementById("sbAdd").value; edit(p => { const tmp = build(p.template === "blank" ? "website" : p.template); const pre = tmp.sections.find(s => s.type === t) || build("website").sections.find(s => s.type === t); const s = pre ? { ...deep(pre), id: newId("s") } : { id: newId("s"), type: t, heading: "", items: [] }; if (t === "featured" && !s.home) s.home = snap(mine()[0] || pool()[0]); if (t === "listings") s.items = listingItems(s); const at = p.sections.findIndex(x => x.type === "form"); p.sections.splice(at >= 0 ? at : p.sections.length, 0, s); SB.sel = at >= 0 ? at : p.sections.length - 1; }); go(); }
    else if (d.sbAi !== undefined) aiPage(SB.prompt);
    else if (d.sbAiq !== undefined) aiPage(d.sbAiq + (SB.prompt ? ". " + SB.prompt : ""));
    else if (d.sbAisec !== undefined) aiSection(+d.sbAisec, SB.prompt);
    else if (d.sbSeoai !== undefined) aiSEO();
    else if (d.sbPub !== undefined) {
      const p = cur();
      if (!p.published) {
        const issues = [];
        if (!(Store.site || {}).slug) issues.push("Pick your link name in Settings first.");
        if (!p.slug) issues.push("Give the page an address.");
        if (pages().some(x => x.id !== SB.edit && x.slug === p.slug)) issues.push("Another page already uses this address.");
        if (issues.length) { SB.msg = issues.join(" "); go(); return; }
        edit(x => { x.published = true; x.publishedAt = now(); x.sections.forEach(s => { if (s.type === "listings") s.items = listingItems(s); }); });
        SB.msg = Store.demo ? "Published (demo: pages go live once the database is connected)." : "Published. Share the link in your ads, posts, and emails.";
      } else { edit(x => { x.published = false; }); SB.msg = "Unpublished. The link no longer works."; }
      go();
    }
    else if (d.sbCopylink !== undefined) { try { await navigator.clipboard.writeText(pageUrl(cur())); SB.msg = "Link copied."; } catch (err) { prompt("Copy this link", pageUrl(cur())); } go(); }
    else if (d.sbDl !== undefined) { const p = cur(), html = R().render(themed({ id: SB.edit, ...p }), { ...ctx(false), pageUrl: pageUrl(p) }), blob = new Blob([html], { type: "text/html" }), u = URL.createObjectURL(blob), a = document.createElement("a"); a.href = u; a.download = (p.slug || "page") + ".html"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 3000); SB.msg = "Downloaded. Forms work once the page is published here."; go(); }
    else if (d.sbView !== undefined) { SB.view = d.sbView; go(); }
    else if (d.sbImg !== undefined) { const [i, k, ...u] = d.sbImg.split("|"); edit(p => { p.sections[+i][k] = u.join("|"); }); go(); }
    else if (d.sbClearimg !== undefined) { const [i, k] = d.sbClearimg.split("|"); edit(p => { p.sections[+i][k] = ""; }); go(); }
    else if (d.sbGal !== undefined) { const [i, ...u] = d.sbGal.split("|"), url = u.join("|"); edit(p => { const s = p.sections[+i], imgs = s.images || []; const at = imgs.indexOf(url); s.images = at >= 0 ? imgs.filter(x => x !== url) : [...imgs, url]; s.alts = s.images.map((_, j) => (s.heading || "Photo") + " " + (j + 1)); }); go(); }
    else if (d.sbItadd !== undefined) { const [i, k] = d.sbItadd.split("|"); edit(p => { p.sections[+i][k] = [...(p.sections[+i][k] || []), {}]; }); go(); }
    else if (d.sbItdel !== undefined) { const [i, k, j] = d.sbItdel.split("|"); edit(p => { p.sections[+i][k].splice(+j, 1); }); go(); }
  });

  SB.seedDemo = function () {
    if (Object.keys(SB.pages).length) return;
    const id = "dpg1", p = build("website"); p.published = true; p.publishedAt = now(); SB.pages[id] = { ...p, updatedAt: now(), agentId: uid() };
    const v = build("valuation"); SB.pages.dpg2 = { ...v, updatedAt: now(), agentId: uid() };
  };
  SB._t = { build, mergeAI, TEMPLATES, pageUrl, listingItems };
  if (typeof Store !== "undefined") { if (Store.demo) SB.seedDemo(); else if (Store.isAgent) SB.watch(); }
})();
