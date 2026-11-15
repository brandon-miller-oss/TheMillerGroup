/* =========================================================================
   The Miller Group: AI marketing assistant.
   Everything an agent would hire a marketer for, in seconds:
   - Listing launch: MLS remarks, social posts, LinkedIn, Meta and Google
     ads, email blast, text, reel script, plus one-tap landing page, flyer,
     and social graphic.
   - Social calendar: a 2 or 4 week posting plan with captions and hashtags.
   - Ads: Meta (Housing special ad category) and Google search ads by goal.
   - Email: market updates, just sold, welcome, check-ins, holidays.
   - SEO blog: an optimized article with title, meta, headings, and keyword
     ideas, which can become a page on the agent's website.
   - Fair Housing check: flags risky words on everything it writes, and on
     anything pasted in.
   Works without AI (templates from real listing and market facts); with AI
   connected it writes custom copy in the agent's voice.
   ========================================================================= */
(function () {
  const MA = window.MarketingAI = { tool: "launch", key: "", out: null, busy: false, msg: "", opts: { weeks: 2, goal: "seller", area: "", emailType: "market", topic: "", tone: "warm", openHouse: "", budget: "" }, check: "" };
  const money = n => n ? "$" + Math.round(n).toLocaleString("en-US") : "";
  const clip = (s, n) => String(s == null ? "" : s).slice(0, n);
  const pool = () => typeof marketingPool === "function" ? marketingPool() : [];
  const agent = () => window.AgentBrand ? AgentBrand.current(Store.crmOwner) : { name: IDX.BROKER.name, phone: IDX.BROKER.phone, display: "The Miller Group", firm: "The Miller Group", byline: "", brand: null, link: IDX.APP_URL };
  const market = () => window.Presentation ? Presentation._t.market() : {};
  const prof = () => Store.site || {};
  const areas = () => String(prof().areas || (prof().presStats || {}).areas || "Denver").split(/,|;| and /).map(x => x.trim()).filter(Boolean);

  const TOOLS = [["launch", "Listing launch"], ["social", "Social calendar"], ["ads", "Ads"], ["email", "Email"], ["blog", "SEO blog"], ["check", "Fair Housing check"]];
  // Output slots per tool: [id, label, character limit or 0]
  const SLOTS = {
    launch: [["headline", "MLS headline", 60], ["remarks", "MLS public remarks", 1000], ["ig1", "Instagram / Facebook: just listed", 2200], ["ig2", "Instagram / Facebook: feature spotlight", 2200], ["ig3", "Instagram / Facebook: open house or last chance", 2200], ["hashtags", "Hashtags", 0],
      ["linkedin", "LinkedIn", 3000], ["metaPrimary", "Meta ad: primary text", 125], ["metaHeadline", "Meta ad: headline", 40], ["metaDesc", "Meta ad: description", 30], ["gHeadlines", "Google ad: headlines (one per line, 30 each)", 0], ["gDescs", "Google ad: descriptions (one per line, 90 each)", 0],
      ["emailSubject", "Email subject", 50], ["emailPreview", "Email preview text", 90], ["emailBody", "Email body", 0], ["sms", "Text message", 160], ["reel", "Reel / TikTok script (30 seconds)", 0]],
    ads: [["v1Primary", "Meta ad A: primary text", 125], ["v1Headline", "Meta ad A: headline", 40], ["v2Primary", "Meta ad B: primary text", 125], ["v2Headline", "Meta ad B: headline", 40], ["v3Primary", "Meta ad C: primary text", 125], ["v3Headline", "Meta ad C: headline", 40],
      ["gHeadlines", "Google ad: headlines (one per line, 30 each)", 0], ["gDescs", "Google ad: descriptions (one per line, 90 each)", 0], ["setup", "Setup notes", 0]],
    email: [["subject", "Subject line", 50], ["preview", "Preview text", 90], ["body", "Email", 0], ["sms", "Matching text message", 160]],
    blog: [["title", "Article title (H1)", 70], ["seoTitle", "Search title", 60], ["meta", "Meta description", 160], ["keyword", "Focus keyword", 0], ["ideas", "Related keywords", 0], ["body", "Article", 0]]
  };

  /* ------------------------------ Fair Housing check ------------------------------ */
  // [pattern, why, suggestion]. Describe the property, not the people.
  const FH = [
    [/\b(perfect|ideal|great) for (a )?(young )?(famil(y|ies)|kids|children|couples?|singles?|newlyweds|retirees|empty[- ]nesters|seniors|students|professionals)\b/i, "Says who the home is for (familial status, age).", "Describe the space: “flexible floor plan with room to grow.”"],
    [/\bfamily[- ](friendly|oriented|neighborhood|community)\b/i, "Familial status.", "Name features instead: “near Wash Park and the Platte trail.”"],
    [/\b(no (kids|children|students|section 8|vouchers?|wheelchairs?)|adults? only|adult (community|living)|child[- ]?free)\b/i, "Excludes protected groups. Colorado also bans source-of-income discrimination.", "Remove it. (55+ communities have specific legal exemptions; ask your broker.)"],
    [/\b(bachelor pad|man cave|mother[- ]in[- ]law)\b/i, "Implies who should live there.", "Try “bonus room” or “accessory dwelling unit.”"],
    [/\b(empty[- ]nesters?|young professionals?|retirees|newlyweds|mature (adults|buyers|couple))\b/i, "Targets by age or familial status.", "Describe the home’s features and location."],
    [/\b(christian|catholic|jewish|muslim|mormon|hindu|buddhist)\b/i, "Religion.", "Remove religious descriptors of people or the area."],
    [/\b(church|synagogue|mosque|temple|parish)\b/i, "Naming places of worship can read as steering.", "Use neutral landmarks: parks, trails, shops, transit."],
    [/\b(exclusive|restricted|private) (neighborhood|community|enclave|area)\b/i, "Can imply some people aren’t welcome.", "Try “quiet tree-lined street” or name the neighborhood."],
    [/\b(integrated|segregated|ethnic|diverse (neighborhood|area)|traditional neighborhood)\b/i, "Describes residents by race or national origin.", "Describe the place, not the people."],
    [/\b(safe|safest|low[- ]crime|crime[- ]free|good) (neighborhood|area|streets)\b/i, "Safety and crime claims are a steering risk.", "Point buyers to public crime maps and let them decide."],
    [/\b(good|great|best|top[- ]rated|excellent) schools?\b/i, "School quality claims can steer.", "Name the district factually: “in the Denver Public Schools boundary (verify).”"],
    [/\b(handicapped?|crippled|able[- ]bodied|physically fit|mentally (ill|handicapped))\b/i, "Outdated or exclusionary disability language.", "Describe accessibility features: “step-free entry,” “wide doorways.”"],
    [/\b(his and hers|female only|male only|men only|women only|gentlemen)\b/i, "Sex.", "Try “dual closets” or “dual vanities.”"],
    [/\b(english[- ]speaking|english only|no foreigners|americans only)\b/i, "National origin.", "Remove it."],
    [/\bmaster (bedroom|suite|bath)\b/i, "Not illegal, but most MLSs now prefer neutral terms.", "Use “primary bedroom” or “primary suite.”"]
  ];
  MA.fhCheck = function (text) { const t = String(text || ""), out = []; FH.forEach(([re, why, fix]) => { const m = t.match(new RegExp(re.source, "gi")); if (m) [...new Set(m.map(x => x.toLowerCase()))].forEach(w => out.push({ word: w, why, fix })); }); return out; };

  /* ------------------------------ Facts ------------------------------ */
  function facts() {
    const a = agent(), p = prof(), m = market(), l = MA.key ? pool().find(x => x.key === MA.key) : null;
    return { agent: { name: a.name, business: a.brand ? a.display : "", brokerage: a.firm, phone: a.phone, areas: areas().join(", "), languages: p.languages || "", bio: clip(p.presBio || p.bio || "", 600) },
      listing: l ? { address: l.address, price: l.price, status: l.status, beds: l.beds, baths: l.baths, sqft: l.sqft, year_built: l.year, type: typeName(l.type || ""), neighborhood: l.hood, city: l.city, description: l.remarks, off_market: !!l.exclusive, listing_brokerage: l.exclusive ? "" : l.office } : null,
      market: m.median ? { area: m.area, as_of: m.asOf, median_price: m.median, days_on_market: m.dom, prior_days: m.domPrior, months_supply: m.monthsSupply, homes_for_sale: m.active, closed_change_yoy_pct: m.closedYoY, concession_share_pct: m.concessionShare, rate: m.rate, source: m.source } : null,
      options: MA.opts };
  }

  /* ------------------------------ Templates (no AI) ------------------------------ */
  function tags(l) { const h = (l && l.hood ? l.hood : areas()[0] || "Denver").replace(/[^A-Za-z]/g, ""); return [`#${h}`, `#${h}RealEstate`, "#DenverRealEstate", "#DenverHomes", "#ColoradoRealEstate", "#JustListed", "#HomeForSale", "#MileHighCity"].join(" "); }
  function templates(tool) {
    const a = agent(), l = MA.key ? pool().find(x => x.key === MA.key) : null, m = market(), first = String(a.name || "").split(" ")[0], o = MA.opts;
    const facts1 = l ? [l.beds && `${l.beds} bed`, l.baths && `${l.baths} bath`, l.sqft && `${Number(l.sqft).toLocaleString()} sq ft`].filter(Boolean).join(", ") : "";
    const place = l ? [l.hood, l.city].filter(Boolean).join(", ") : areas()[0] || "Denver";
    const sig = `${a.name}${a.brand ? `, ${a.display}` : ""} · ${a.phone}\n${a.brand ? a.byline : a.firm}`;
    if (tool === "launch") {
      if (!l) return null;
      const remark = l.remarks || `Welcome to ${l.address} in ${place}: ${facts1}. [Describe the main living spaces and kitchen.] [Describe the primary suite.] [Describe outdoor space and parking.] Close to [parks, trails, shops, and transit]. Call ${first} for a private showing.`;
      return {
        headline: clip(`${typeName(l.type || "Home")} in ${l.hood || l.city || "Denver"} · ${facts1}`, 60), remarks: clip(remark, 1000),
        ig1: `Just listed in ${place}. ${l.address}: ${facts1}${l.price ? `, offered at ${money(l.price)}` : ""}.\n\n[One sentence on the best feature.]\n\nTap the link for photos and to book a showing, or message me.\n\n${sig}`,
        ig2: `Feature spotlight at ${l.address}: [the kitchen, the yard, the light, the view]. [Two sentences that make someone picture living there, without saying who should live there.]\n\nWant a private tour? Message me.\n\n${sig}`,
        ig3: o.openHouse ? `Open house at ${l.address}: ${o.openHouse}. Come see ${facts1} in ${place}. No appointment needed.\n\n${sig}` : `Still available: ${l.address} in ${place}. ${facts1}. Showings are filling up this week. Message me to grab a time.\n\n${sig}`,
        hashtags: tags(l),
        linkedin: `New listing: ${l.address} in ${place}. ${facts1}${l.price ? `, ${money(l.price)}` : ""}. If you know someone relocating to the Denver area or moving up in ${l.hood || l.city || "the metro"}, I’d appreciate an introduction.\n\n${sig}`,
        metaPrimary: clip(`New in ${l.hood || l.city || "Denver"}: ${facts1}. See photos and book a showing.`, 125), metaHeadline: clip(`${l.address}`, 40), metaDesc: clip(l.price ? money(l.price) : "Book a showing", 30),
        gHeadlines: [clip(`${l.hood || "Denver"} Home For Sale`, 30), clip(`${l.beds || ""} Bed ${typeName(l.type || "Home")}`.trim(), 30), clip(`Tour ${l.address.split(" ").slice(1, 3).join(" ")}`, 30)].join("\n"),
        gDescs: [clip(`${facts1} in ${place}. See photos, details, and book a private showing today.`, 90), clip(`Listed by ${a.brand ? a.display : a.name}. Call or text ${a.phone} for a tour.`, 90)].join("\n"),
        emailSubject: clip(`Just listed: ${l.address}`, 50), emailPreview: clip(`${facts1} in ${place}${l.price ? " · " + money(l.price) : ""}`, 90),
        emailBody: `Hi [First name],\n\nI just listed ${l.address} in ${place}: ${facts1}${l.price ? `, offered at ${money(l.price)}` : ""}.\n\n[Two or three sentences on what makes it special.]\n\nIf you or someone you know would like to see it, reply here or call me at ${a.phone}.\n\n${sig}`,
        sms: clip(`Hi [Name], it’s ${first}. Just listed ${l.address} (${facts1}). Want the photos or a tour? Reply STOP to opt out.`, 160),
        reel: `[0–3s, exterior push-in] On-screen text: “Just listed in ${l.hood || l.city || "Denver"}”\n[3–10s, entry and main living] Voiceover: “Welcome to ${l.address}.” [Best feature.]\n[10–20s, kitchen, primary suite, outdoor] Quick cuts, one feature each.\n[20–27s, neighborhood b-roll] “Minutes from [park, trail, or shops].”\n[27–30s, agent to camera] “I’m ${first}. Message me for a private tour.” End card: ${a.display}${a.byline ? " · " + a.byline : ""}`
      };
    }
    if (tool === "ads") {
      const area = o.area || areas()[0] || "Denver", goal = o.goal;
      const G = { seller: [`What’s your ${area} home worth? Get a free market analysis based on real recent sales.`, "Free home value report", `Thinking of selling in ${area}? See what nearby homes sold for and what that means for yours.`, `${area} home prices, explained`, `Homes near you are still selling. Find out what yours could bring, with no pressure.`, "See your home’s value"],
        buyer: [`Searching in ${area}? Get new listings the moment they hit, plus off-market homes.`, "New listings, first", `First-time buyer? Get a free guide to loans, Colorado down payment help, and offers.`, "Free first-time buyer guide", `Tour homes in ${area} with a local agent who tracks every deadline.`, "Book a buyer consult"],
        openhouse: [`Open house ${o.openHouse || "[day and time]"}. Come see it in person.`, "Open house this weekend", `See it before it’s gone: open house ${o.openHouse || "[day and time]"}.`, "RSVP for the open house", `Photos only tell half the story. Tour it ${o.openHouse || "this weekend"}.`, "Save your spot"],
        brand: [`Buying or selling in ${area}? Honest advice, sharp pricing, strong marketing.`, `Meet ${a.brand ? a.display : a.name}`, `Real estate in ${area}, done right. Search homes or get your home value.`, `${area} real estate agent`, `Clients come back because the process is calm and clear.`, "Let’s talk"] }[goal] || [];
      return { v1Primary: clip(G[0], 125), v1Headline: clip(G[1], 40), v2Primary: clip(G[2], 125), v2Headline: clip(G[3], 40), v3Primary: clip(G[4], 125), v3Headline: clip(G[5], 40),
        gHeadlines: (goal === "seller" ? [`${area} Home Value`, "Free Market Analysis", "Local Real Estate Agent"] : goal === "buyer" ? [`${area} Homes For Sale`, "New Listings Daily", "Free Buyer Consultation"] : goal === "openhouse" ? ["Open House This Weekend", `${area} Home For Sale`, "Tour It In Person"] : [`${area} Real Estate Agent`, "Buy Or Sell With Confidence", "Free Home Value"]).map(x => clip(x, 30)).join("\n"),
        gDescs: [clip(`Local expertise in ${area}. Honest pricing, strong marketing, steady negotiation.`, 90), clip(`Call ${a.phone} or visit the page to get started today.`, 90)].join("\n"),
        setup: `Meta: choose the “Housing” special ad category. Meta limits targeting by age, gender, and ZIP for housing ads, so target by city or a 15+ mile radius and let the creative do the work.\nSend clicks to a landing page with a form (Websites and landing pages: ${goal === "seller" ? "What’s my home worth?" : goal === "buyer" ? "Free buyer guide" : goal === "openhouse" ? "Open house RSVP" : "My website"}) and add ?utm_source=facebook&utm_campaign=${goal} to the link so leads show where they came from.\nGoogle: use search ads on intent keywords like “${area} home value” or “${area} homes for sale.” Start around ${o.budget ? o.budget : "$10–20"} a day and check results after a week.\nEvery ad shows your brokerage (${a.firm}) clearly. Fair Housing rules apply to images too.` };
    }
    if (tool === "email") {
      const t = o.emailType;
      if (t === "market") return { subject: clip(`${m.area || "Denver"} market update: ${m.asOf || "this month"}`, 50), preview: clip(`Median ${money(m.median)}, ${m.dom} days on market, ${m.monthsSupply} months of supply`, 90),
        body: `Hi [First name],\n\nHere’s a quick look at the ${m.area || "Denver"} market (${m.asOf || "latest"}):\n\n- Median sale price: ${money(m.median)}\n- Median days on market: ${m.dom} (was ${m.domPrior})\n- Months of supply: ${m.monthsSupply}\n- About ${m.concessionShare}% of sales included seller concessions\n\nWhat it means: [one or two sentences for buyers and sellers right now].\n\nCurious what this means for your home or your search? Reply and I’ll send a personalized snapshot.\n\n${sig}\n\nSource: ${m.source || "REcolorado"}.`, sms: clip(`Hi [Name], it’s ${first}. Quick ${m.area || "Denver"} update: median ${money(m.median)}, ${m.dom} days on market. Want a snapshot for your home? Reply STOP to opt out.`, 160) };
      if (t === "sold") return { subject: "Just sold in your neighborhood", preview: "Buyers are still looking nearby", body: `Hi [First name],\n\nWe just closed on [address] in [neighborhood]. Buyers are still looking nearby, and a few who missed out asked me to keep an eye out.\n\nIf you’ve wondered what your home could sell for, I’d be glad to put together a free, no-pressure market analysis.\n\n${sig}`, sms: clip(`Hi [Name], it’s ${first}. We just sold a home near you. Curious what yours is worth? Reply STOP to opt out.`, 160) };
      if (t === "welcome") return { subject: "Welcome! Here’s how we’ll find your home", preview: "Your search is set up. Here’s what happens next.", body: `Hi [First name],\n\nThanks for trusting me with your search. Here’s what happens next:\n\n1. Your home search is set up and you’ll get new matches as soon as they list.\n2. If you haven’t yet, connect with a lender for a pre-approval. I can share three I trust.\n3. When something catches your eye, send it my way and we’ll tour it.\n\nI’m here for every question, big or small.\n\n${sig}`, sms: clip(`Hi [Name], it’s ${first}! Your home search is live. Text me anytime with questions. Reply STOP to opt out.`, 160) };
      if (t === "holiday") return { subject: "Happy holidays from my family to yours", preview: "A quick thank-you", body: `Hi [First name],\n\nAs the year wraps up, I wanted to say thank you. Helping people like you is the best part of what I do.\n\nWishing you a warm, restful season. If there’s ever anything I can do for you, or anyone you know, I’m just a call away.\n\n${sig}`, sms: clip(`Happy holidays from ${first}! Thank you for a great year. Reply STOP to opt out.`, 160) };
      return { subject: "Checking in", preview: "How’s the house treating you?", body: `Hi [First name],\n\nI was thinking about you and wanted to check in. How’s everything with the house?\n\nIf you ever want an updated value, a contractor recommendation, or help for a friend who’s moving, I’m glad to help.\n\n${sig}`, sms: clip(`Hi [Name], it’s ${first}. Just checking in. How’s the house? Reply STOP to opt out.`, 160) };
    }
    if (tool === "blog") {
      const topic = o.topic || `Living in ${areas()[0] || "Denver"}`, kw = topic.toLowerCase();
      return { title: clip(topic, 70), seoTitle: clip(`${topic} | ${a.brand ? a.display : a.name}`, 60), meta: clip(`${topic}: a local agent’s guide to homes, prices, and what to know before you buy or sell. Updated ${m.asOf || "this month"}.`, 160), keyword: kw,
        ideas: [`${kw} homes for sale`, `${kw} real estate`, `${kw} home prices`, `moving to ${areas()[0] || "Denver"}`, `${areas()[0] || "Denver"} real estate agent`].join("\n"),
        body: `## Why ${topic.replace(/^living in /i, "")} stands out\n[Two paragraphs on the place: streets, home styles, parks, shops, and getting around.]\n\n## What homes cost right now\nAcross the ${m.area || "Denver metro"}, the median sale price was ${money(m.median)} in ${m.asOf || "the latest month"}, with homes selling in a median of ${m.dom} days. [Add local numbers for this area.]\n\n## Tips for buyers\n- Get pre-approved before you tour.\n- Ask about seller concessions; about ${m.concessionShare}% of recent sales included them.\n- [One local tip.]\n\n## Tips for sellers\n- Price from recent nearby sales, not list prices.\n- [One local tip.]\n\n## Thinking about a move?\nI’m ${a.name}${a.brand ? ` with ${a.display}` : ""}. Call ${a.phone} or send a note, and I’ll share what’s on the market now.\n\nSource: ${m.source || "REcolorado"}.` };
    }
    if (tool === "social") {
      const days = (o.weeks || 2) * 7, start = new Date(); start.setDate(start.getDate() + 1);
      const ideas = [["Listing", "Just listed or coming soon: share the best photo and one standout feature.", "Instagram, Facebook"], ["Market", `Market minute: ${m.area || "Denver"} median ${money(m.median)}, ${m.dom} days on market. What it means for buyers and sellers.`, "Instagram, LinkedIn"], ["Local", `Local favorite in ${areas()[0] || "Denver"}: a park, coffee shop, or trail you love, and why.`, "Instagram Stories, Facebook"], ["Tip", "Seller tip: three low-cost updates that help a home show better.", "Instagram Reel"], ["Personal", "Behind the scenes: a day in your work week or a client win (with permission).", "Instagram, Facebook"], ["Tip", "Buyer tip: what pre-approval means and why it helps your offer.", "Instagram Reel, TikTok"], ["Engage", "Question post: “What’s one feature your next home must have?”", "Facebook, Instagram Stories"]];
      const rows = []; for (let i = 0, k = 0; i < days; i++) { const d = new Date(start); d.setDate(start.getDate() + i); if ([0, 3, 5].includes(d.getDay()) || (o.weeks <= 2 && d.getDay() === 2)) { const [type, idea, where] = ideas[k++ % ideas.length]; rows.push({ date: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }), type, where, idea, caption: `${idea} [Write it in your words.]\n\n${a.name} · ${a.brand ? a.byline : a.firm}`, hashtags: tags(null) }); } }
      return { rows };
    }
    return null;
  }

  /* ------------------------------ AI ------------------------------ */
  const RULES = `Rules:
- U.S. Fair Housing advertising rules: describe homes and places, never who should live there; no protected-class references or steering (families, adults, religion, schools quality, safety or crime claims, "exclusive neighborhood", etc.). Colorado also bans source-of-income discrimination.
- Use only the facts given. Never invent numbers, features, sales, awards, or reviews. Put [bracketed notes] where the agent must add something.
- Agent compensation is negotiable; never suggest fixed rates. Don't promise values or results.
- Voice: ${MA.opts.tone || "warm"}, specific, confident. No emoji unless the format is a social caption (then at most two). Respect every character limit.
- The brokerage name (${"The Miller Group"}) must appear in any ad or post signature; use "{business}, brokered by The Miller Group" when the agent has a business name.`;
  async function runAI(tool) {
    const sample = await window.claude?.use?.("sample");
    if (!sample) return null;
    const f = facts();
    if (tool === "social") {
      const out = await sample.json(`You are a real estate social media strategist for a Denver-area agent. Facts: ${JSON.stringify(f)}
Make a ${MA.opts.weeks || 2}-week posting plan starting tomorrow (${new Date(Date.now() + 864e5).toDateString()}), 3 to 4 posts a week, mixing listings (only real ones given), market updates (only the numbers given), local spotlights, buyer and seller tips, and engagement posts. For each: date, type, best platform(s), the idea, a ready caption (under 900 characters, with a call to action and the brokerage line), and 5 to 8 hashtags.
${RULES}
Return only JSON: {"rows":[{"date":"Mon, Nov 16","type":"...","where":"...","idea":"...","caption":"...","hashtags":"#..."}]}`, { maxTokens: 6000 });
      return out && Array.isArray(out.rows) ? { rows: out.rows.slice(0, 20).map(r => ({ date: clip(r.date, 30), type: clip(r.type, 30), where: clip(r.where, 60), idea: clip(r.idea, 300), caption: clip(r.caption, 1200), hashtags: clip(r.hashtags, 300) })) } : null;
    }
    const slots = SLOTS[tool];
    const ask = { launch: "Write a complete listing launch campaign for this listing.", ads: `Write paid ad copy. Goal: ${MA.opts.goal} leads${MA.opts.area ? " in " + MA.opts.area : ""}.${MA.opts.openHouse ? " Open house: " + MA.opts.openHouse + "." : ""}${MA.opts.budget ? " Budget: " + MA.opts.budget + "." : ""} Include setup notes (Meta Housing special ad category limits, landing page, UTM tags, Google keywords, budget).`, email: `Write a ${({ market: "monthly market update", sold: "just sold in your neighborhood", welcome: "new buyer welcome", checkin: "past client check-in", holiday: "holiday thank-you" })[MA.opts.emailType] || "client"} email.`, blog: `Write an SEO-optimized blog article about: ${MA.opts.topic || "living in " + (areas()[0] || "Denver")}. 700 to 1,000 words in markdown with ## headings, local specifics from the facts only, a clear call to action, and [bracketed notes] where local details must be verified.` }[tool];
    const out = await sample.json(`You are an expert real estate marketer and copywriter (marketing and graphic design trained) working for a Denver-area agent.
Facts: ${JSON.stringify(f)}
Task: ${ask}
Fill these outputs, respecting limits (characters): ${JSON.stringify(slots.map(([id, label, lim]) => ({ id, label, limit: lim || undefined })))}
${RULES}
Return only JSON: {${slots.map(([id]) => `"${id}": "..."`).join(", ")}}`, { maxTokens: tool === "blog" ? 5000 : 4000 });
    if (!out || typeof out !== "object") return null;
    return Object.fromEntries(slots.map(([id]) => [id, clip(Array.isArray(out[id]) ? out[id].join("\n") : out[id], 8000)]));
  }
  async function generate() {
    const tool = MA.tool; MA.msg = "";
    if (tool === "launch" && !MA.key) { MA.msg = "Pick a listing first."; renderAgent(); return; }
    MA.busy = true; renderAgent();
    let out = null, ai = false;
    try { out = await runAI(tool); ai = !!out; } catch (e) { MA.msg = e && e.code === "not_granted" ? "AI was turned off for this page, so these are templates." : "The AI didn’t come through, so these are templates. Try again in a moment."; }
    if (!out) { out = templates(tool); if (!MA.msg) MA.msg = window.claude ? "Templates filled from your facts. Fill the [brackets] and make it yours." : "Templates filled from your facts. Fill the [brackets] and make it yours. Connect AI for fully custom copy."; }
    else MA.msg = "Done. Read it through and make it sound like you before posting.";
    MA.out = { tool, data: out, ai, at: new Date().toISOString() }; MA.busy = false; renderAgent();
    if (window.Office && Office._t && Office._t.saveCompany) { /* nothing to save company-side */ }
  }

  /* ------------------------------ UI ------------------------------ */
  MA.html = function () {
    const l = MA.key ? pool().find(x => x.key === MA.key) : null, o = MA.opts;
    const tabs = `<div class="mk-tabs ma-tabs" role="tablist">${TOOLS.map(([k, t]) => `<button role="tab" aria-selected="${MA.tool === k}" class="${MA.tool === k ? "on" : ""}" data-ma-tool="${k}">${t}</button>`).join("")}</div>`;
    const lsel = `<label for="maL">Listing</label><select id="maL" data-ma-key><option value="">Choose a listing</option>${pool().map(x => `<option value="${esc(x.key)}" ${x.key === MA.key ? "selected" : ""}>${esc(x.address)} · ${short(x.price)}${x.exclusive ? " · Off-market" : ""}</option>`).join("")}</select>`;
    const tone = `<label for="maTone">Voice</label><select id="maTone" data-ma-o="tone">${[["warm", "Warm and personal"], ["luxury", "Polished luxury"], ["energetic", "Upbeat and energetic"], ["straight", "Straightforward and data-driven"]].map(([k, t]) => `<option value="${k}" ${o.tone === k ? "selected" : ""}>${t}</option>`).join("")}</select>`;
    let form = "";
    if (MA.tool === "launch") form = `${lsel}<div class="row2"><div><label for="maOh">Open house (optional)</label><input id="maOh" data-ma-o="openHouse" value="${esc(o.openHouse)}" placeholder="Sat Nov 21, 11–2"></div><div>${tone}</div></div>`;
    else if (MA.tool === "social") form = `<div class="row2"><div><label for="maW">Plan length</label><select id="maW" data-ma-o="weeks"><option value="2" ${o.weeks == 2 ? "selected" : ""}>2 weeks</option><option value="4" ${o.weeks == 4 ? "selected" : ""}>4 weeks</option></select></div><div>${tone}</div></div>`;
    else if (MA.tool === "ads") form = `<div class="row2"><div><label for="maG">Goal</label><select id="maG" data-ma-o="goal">${[["seller", "Seller leads"], ["buyer", "Buyer leads"], ["openhouse", "Open house traffic"], ["brand", "Get known"]].map(([k, t]) => `<option value="${k}" ${o.goal === k ? "selected" : ""}>${t}</option>`).join("")}</select></div><div><label for="maA">Area</label><input id="maA" data-ma-o="area" value="${esc(o.area)}" placeholder="${esc(areas()[0] || "Denver")}"></div></div>
      <div class="row2"><div><label for="maB">Daily budget (optional)</label><input id="maB" data-ma-o="budget" value="${esc(o.budget)}" placeholder="$15 a day"></div><div><label for="maOh2">Open house (if any)</label><input id="maOh2" data-ma-o="openHouse" value="${esc(o.openHouse)}"></div></div>`;
    else if (MA.tool === "email") form = `<div class="row2"><div><label for="maE">Email</label><select id="maE" data-ma-o="emailType">${[["market", "Monthly market update"], ["sold", "Just sold nearby"], ["welcome", "New buyer welcome"], ["checkin", "Past client check-in"], ["holiday", "Holiday thank-you"]].map(([k, t]) => `<option value="${k}" ${o.emailType === k ? "selected" : ""}>${t}</option>`).join("")}</select></div><div>${tone}</div></div>`;
    else if (MA.tool === "blog") form = `<label for="maT">Topic or keyword</label><input id="maT" data-ma-o="topic" value="${esc(o.topic)}" placeholder="Living in ${esc(areas()[0] || "Highland")}: a local’s guide">${tone}`;
    if (MA.tool === "check") {
      const flags = MA.fhCheck(MA.check);
      return `${tabs}<p class="addr">Paste any ad, post, remarks, or email. The check flags words that can raise Fair Housing concerns and suggests better wording. Everything the assistant writes is checked automatically too.</p>
        <div class="tourform"><label for="maCk">Text to check</label><textarea id="maCk" rows="7" data-ma-check>${esc(MA.check)}</textarea><p class="addr">${MA.check.length.toLocaleString()} characters</p></div>
        ${MA.check ? (flags.length ? `<div class="ma-flags">${flags.map(f => `<p><strong>“${esc(f.word)}”</strong> ${esc(f.why)} <span>${esc(f.fix)}</span></p>`).join("")}</div>` : `<p class="ab-status ok"><strong>No flagged words found.</strong><span>Still read it for tone and accuracy; no checklist catches everything.</span></p>`) : ""}`;
    }
    let out = "";
    if (MA.out && MA.out.tool === MA.tool) {
      const d = MA.out.data;
      if (MA.tool === "social") out = `<div class="quick"><button class="btn ghost" data-ma-csv>Download as spreadsheet (CSV)</button></div>` + (d.rows || []).map((r, i) => card(`${r.date} · ${r.type}${r.where ? " · " + r.where : ""}`, `${r.caption}\n\n${r.hashtags}`, 0, "row" + i, r.idea)).join("");
      else out = (SLOTS[MA.tool] || []).filter(([id]) => d[id]).map(([id, label, lim]) => card(label, d[id], lim, id)).join("");
      if (MA.tool === "launch" && l) out = `<div class="quick ma-next"><span>Next:</span><button class="btn gold" data-ma-page>Build the landing page</button><button class="btn ghost" data-ma-flyer>Make a flyer</button><button class="btn ghost" data-ma-graphic>Social graphic</button></div>` + out;
      if (MA.tool === "blog") out = `<div class="quick ma-next"><button class="btn gold" data-ma-blogpage>Turn into a website page</button></div>` + out;
    }
    return `${tabs}<p class="addr">${({ launch: "Everything you need to launch a listing, written in seconds: MLS remarks, social posts, ads, email, text, and a video script.", social: "A posting plan with ready-to-use captions and hashtags.", ads: "Ad copy for Meta and Google, plus setup notes that keep you within housing-ad rules.", email: "Client emails and matching texts.", blog: "An article built to rank in local search, ready to become a page on your website." })[MA.tool]}</p>
      <div class="tourform">${form}<div class="quick"><button class="btn gold" data-ma-go ${MA.busy ? "disabled" : ""}>${MA.busy ? "Writing…" : MA.out && MA.out.tool === MA.tool ? "Write it again" : "Write it"}</button></div></div>
      ${MA.msg ? `<p class="msg" role="status">${esc(MA.msg)}</p>` : ""}${out}`;
  };
  function card(label, text, lim, id, note) {
    const n = String(text || "").length, over = lim && n > lim, flags = MA.fhCheck(text);
    const lineOver = id === "gHeadlines" ? String(text).split("\n").some(x => x.length > 30) : id === "gDescs" ? String(text).split("\n").some(x => x.length > 90) : false;
    return `<div class="pcard ma-card"><div class="pcard-top"><div><strong>${esc(label)}</strong>${note ? `<p>${esc(note)}</p>` : ""}</div><span class="addr ${over || lineOver ? "ma-over" : ""}">${lim ? `${n}/${lim}` : `${n.toLocaleString()} characters`}${lineOver ? " · a line is too long" : ""}</span></div>
      <textarea class="ma-text" rows="${Math.min(14, Math.max(2, Math.ceil(n / 70) + String(text).split("\n").length))}" data-ma-edit="${esc(id)}" aria-label="${esc(label)}">${esc(text)}</textarea>
      ${flags.length ? `<div class="ma-flags">${flags.map(f => `<p><strong>“${esc(f.word)}”</strong> ${esc(f.why)} <span>${esc(f.fix)}</span></p>`).join("")}</div>` : ""}
      <div class="links"><button data-ma-copy="${esc(id)}">Copy</button></div></div>`;
  }
  if (!document.getElementById("maStyles")) {
    const st = document.createElement("style"); st.id = "maStyles";
    st.textContent = `.ma-tabs{flex-wrap:wrap}.ma-tabs button{flex:1 1 auto;min-width:110px}.ma-card textarea{width:100%;margin:8px 0 4px;font:14px/1.5 var(--sans);border:1px solid var(--line);border-radius:8px;padding:8px 10px;background:var(--bg);color:var(--ink)}
.ma-over{color:var(--pass);font-weight:600}.ma-flags{border-left:3px solid var(--pass);background:color-mix(in srgb,var(--pass) 8%,var(--surface));border-radius:8px;padding:6px 10px;margin:6px 0;font-size:13px}.ma-flags p{margin:4px 0}.ma-flags span{color:var(--ink-2)}
.ma-next{align-items:center;margin:10px 0}.ma-next span{font-weight:600;color:var(--ink-2)}`;
    document.head.appendChild(st);
  }

  /* ------------------------------ Events ------------------------------ */
  document.addEventListener("input", e => {
    const d = e.target.dataset || {};
    if (d.maCheck !== undefined) { MA.check = e.target.value; clearTimeout(MA.t); MA.t = setTimeout(() => { const pos = e.target.selectionStart; renderAgent(); const t = document.getElementById("maCk"); if (t) { t.focus(); t.setSelectionRange(pos, pos); } }, 500); }
    else if (d.maEdit !== undefined && MA.out) { if (MA.out.tool === "social") { const i = +d.maEdit.slice(3); const [cap, ...h] = e.target.value.split("\n\n#"); MA.out.data.rows[i].caption = cap; MA.out.data.rows[i].hashtags = h.length ? "#" + h.join("\n\n#") : ""; } else MA.out.data[d.maEdit] = e.target.value; }
    else if (d.maO) MA.opts[d.maO] = e.target.value;
  });
  document.addEventListener("change", e => {
    const d = e.target.dataset || {};
    if (d.maKey !== undefined) { MA.key = e.target.value; MA.out = null; renderAgent(); }
    else if (d.maO) { MA.opts[d.maO] = d.maO === "weeks" ? +e.target.value : e.target.value; }
    else if (d.maEdit !== undefined) renderAgent();
  });
  document.addEventListener("click", async e => {
    const el = e.target.closest("[data-ma-tool],[data-ma-go],[data-ma-copy],[data-ma-csv],[data-ma-page],[data-ma-flyer],[data-ma-graphic],[data-ma-blogpage]"); if (!el) return; const d = el.dataset;
    if (d.maTool !== undefined) { MA.tool = d.maTool; MA.msg = ""; renderAgent(); }
    else if (d.maGo !== undefined) generate();
    else if (d.maCopy !== undefined) { const v = MA.out.tool === "social" ? (() => { const r = MA.out.data.rows[+d.maCopy.slice(3)]; return `${r.caption}\n\n${r.hashtags}`; })() : MA.out.data[d.maCopy]; try { await navigator.clipboard.writeText(v); el.textContent = "Copied"; setTimeout(() => { el.textContent = "Copy"; }, 1400); } catch (err) { prompt("Copy this", v); } }
    else if (d.maCsv !== undefined) { const q = s => `"${String(s || "").replace(/"/g, '""')}"`, rows = [["Date", "Type", "Where", "Idea", "Caption", "Hashtags"], ...MA.out.data.rows.map(r => [r.date, r.type, r.where, r.idea, r.caption, r.hashtags])]; const blob = new Blob([rows.map(r => r.map(q).join(",")).join("\n")], { type: "text/csv" }), u = URL.createObjectURL(blob), a = document.createElement("a"); a.href = u; a.download = "Social_Calendar.csv"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 3000); }
    else if (d.maPage !== undefined && window.SiteBuilder) {
      const id = "pg" + Date.now().toString(36), p = SiteBuilder._t.build("listing", { key: MA.key }), D = MA.out.data;
      if (D.remarks) { const f = p.sections.find(s => s.type === "featured"); if (f) f.body = D.remarks; }
      if (D.metaPrimary) { const h = p.sections.find(s => s.type === "hero"); if (h && D.headline) h.eyebrow = D.headline; }
      SiteBuilder.pages[id] = { ...p, updatedAt: new Date().toISOString(), agentId: Store.crmOwner }; SiteBuilder.edit = id; SiteBuilder.sel = 0; SiteBuilder.msg = "Landing page built from your campaign. Publish it and use the link in your ads.";
      if (Store.db && !Store.demo) Store.db.doc(`sites/${Store.crmOwner}/pages/${id}`).set(SiteBuilder.pages[id]).catch(() => {});
      agentPanel = "sites"; renderAgent(); window.scrollTo(0, 0);
    }
    else if (d.maFlyer !== undefined) { if (window.PrintStudio) { PrintStudio.state.key = MA.key; PrintStudio.state.product = "flyer"; PrintStudio.state.theme = "just-listed"; PrintStudio.state.picks = null; if (MA.out.data.remarks) PrintStudio.state.body = MA.out.data.remarks.slice(0, 600); PrintStudio.tab = "print"; } agentPanel = "marketing"; renderAgent(); window.scrollTo(0, 0); }
    else if (d.maGraphic !== undefined) { if (typeof mk !== "undefined") { mk.key = MA.key; mk.caps = null; } if (window.PrintStudio) PrintStudio.tab = "social"; agentPanel = "marketing"; renderAgent(); window.scrollTo(0, 0); }
    else if (d.maBlogpage !== undefined && window.SiteBuilder) {
      const D = MA.out.data, id = "pg" + Date.now().toString(36), p = SiteBuilder._t.build("blank");
      p.kind = "website"; p.template = "blog"; p.title = clip(D.title, 80); p.navTitle = "Blog"; p.slug = String(D.title || "article").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
      p.sections = [{ id: "s1", type: "hero", style: "split", eyebrow: "Local guide", headline: D.title, sub: D.meta, cta: "Talk with me" }, ...String(D.body || "").split(/\n(?=## )/).map((chunk, i) => { const m = /^##\s*(.+)\n?([\s\S]*)$/.exec(chunk.trim()); return { id: "s" + (i + 2), type: "text", heading: m ? m[1] : "", body: m ? m[2].trim() : chunk.trim() }; }), { id: "sf", type: "form", heading: "Questions? Let’s talk", purpose: "contact", button: "Send", fields: { phone: true, message: true } }];
      p.seo = { keyword: D.keyword, title: clip(D.seoTitle, 60), description: clip(D.meta, 160), image: "", noindex: false };
      SiteBuilder.pages[id] = { ...p, updatedAt: new Date().toISOString(), agentId: Store.crmOwner }; SiteBuilder.edit = id; SiteBuilder.sel = 0; SiteBuilder.tab = "seo"; SiteBuilder.msg = "Article added as a website page. Check the SEO tab, then publish.";
      if (Store.db && !Store.demo) Store.db.doc(`sites/${Store.crmOwner}/pages/${id}`).set(SiteBuilder.pages[id]).catch(() => {});
      agentPanel = "sites"; renderAgent(); window.scrollTo(0, 0);
    }
  });
  MA._t = { templates, FH, SLOTS };
})();
