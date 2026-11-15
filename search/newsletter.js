/* =========================================================================
   The Miller Group: automated agent newsletters.
   Each agent's newsletter is tailored to them: their brand, their areas,
   their current listings, open houses, and events, the latest market
   numbers, and Colorado real estate news the broker approved on the News
   desk (found weekly by AI web search, summarized in original words with
   links to the source).
   - This issue: assembled automatically; edit the subject and intro (or let
     AI write them), pick items, preview, send a test, send to the list.
   - Schedule: weekly, every two weeks, or monthly at 8 AM, either drafted for
     review or sent automatically. Audience by folder or role.
   - Every send includes the brokerage line, Equal Housing Opportunity, a
     mailing address, and a working unsubscribe link (added by the server).
   ========================================================================= */
(function () {
  const NL = window.Newsletter = { tab: "issue", draft: null, msg: "", busy: false, count: null };
  const C = window.MG_CONFIG || {};
  const R = () => window.NewsletterRender;
  const now = () => new Date().toISOString();
  const today = () => typeof localDay === "function" ? localDay() : new Date().toLocaleDateString("en-CA");
  const enc = encodeURIComponent;
  const S = () => ({ auto: false, mode: "review", frequency: "monthly", weekday: 2, monthday: 1, audience: { all: true, folders: [], roles: [] }, sections: { market: true, news: true, listings: true, openhouses: true, events: true }, newsCount: 3, voice: "warm and personal", address: "", mlsId: "", events: [], ...((Store.settings || {}).newsletter || {}) });
  const saveS = patch => Store.saveSettings({ newsletter: { ...S(), ...patch } });
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /* ------------------------------ Audience ------------------------------ */
  function matches(c, aud) {
    if (!c || !EMAIL.test(c.email || "") || c.doNotContact || c.newsletterOptOut) return false;
    if (!aud || aud.all) return true;
    const f = (c.folders || []).map(x => String(x).toLowerCase());
    if ((aud.folders || []).some(x => f.includes(String(x).toLowerCase()))) return true;
    const roles = aud.roles || [];
    return roles.includes(c.role) || (c.role === "both" && (roles.includes("buyer") || roles.includes("seller")));
  }
  NL.audience = aud => { const seen = new Set(); return Object.values(Store.crm.contacts || {}).filter(c => matches(c, aud)).filter(c => { const k = c.email.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }); };
  const folders = () => [...new Set(Object.values(Store.crm.contacts || {}).flatMap(c => (c && c.folders) || []))].sort();

  /* ------------------------------ Issue assembly ------------------------------ */
  const agent = () => { const a = window.AgentBrand ? AgentBrand.current(Store.crmOwner) : { name: IDX.BROKER.name, phone: IDX.BROKER.phone, display: "The Miller Group", firm: "The Miller Group", byline: "", brand: null }; const t = (Store.team || {})[Store.crmOwner] || Store.site || {};
    return { name: a.name, title: a.title || t.title || "", phone: a.phone, email: a.email || t.email || "", photo: /^https:/.test(a.photo || "") ? a.photo : "", display: a.display, byline: a.byline, firm: a.firm, primary: a.brand && a.brand.primary, accent: a.brand && a.brand.accent, logoDark: a.brand && /^https:/.test(a.brand.logoDark || "") ? a.brand.logoDark : "" }; };
  const areas = () => { const p = Store.site || {}; return String(p.areas || (p.presStats || {}).areas || "Denver").split(/,|;| and /).map(x => x.trim()).filter(Boolean); };
  const appLink = k => { const slug = (Store.site || {}).slug; return `${(C.SITE_URL || location.origin).replace(/\/$/, "")}/search/${slug ? "?agent=" + enc(slug) : ""}${k ? "#home=" + enc(k) : ""}`; };
  const pool = () => typeof marketingPool === "function" ? marketingPool() : [];
  const myListings = () => { const a = agent(); return pool().filter(l => l.status !== "Closed" && (l.exclusive || (l.agent && a.name && l.agent === a.name))).slice(0, 6); };
  const newsPool = () => Object.entries((window.Office && Office.news) || {}).filter(([, x]) => x).map(([id, x]) => ({ id, ...x }));
  function build() {
    const s = S(), m = window.Presentation ? Presentation._t.market() : null, sec = s.sections;
    const approved = newsPool().filter(x => x.status === "approved");
    const news = sec.news ? R().pickNews(approved, areas(), s.newsCount || 3) : [];
    const listings = sec.listings ? myListings().map(l => ({ key: l.key, status: l.status, price: l.price, beds: l.beds, baths: l.baths, sqft: l.sqft, address: `${l.address}${l.city ? ", " + l.city : ""}`, hood: l.hood, photo: /^https:/.test((l.photos || [])[0] || "") ? l.photos[0] : "", url: appLink(l.key) })) : [];
    const t = today(), soon = d => d >= t && (Date.parse(d) - Date.parse(t)) / 864e5 <= 21;
    const openHouses = sec.openhouses ? Object.values(Store.crm.openhouses || {}).filter(o => o && o.date && soon(o.date)).sort((a, b) => a.date.localeCompare(b.date)).map(o => { const l = typeof listingSync === "function" ? listingSync(o.listingKey) : null; return { date: o.date, start: o.start, end: o.end, address: l ? `${l.address}${l.city ? ", " + l.city : ""}` : "", price: l && l.price, url: appLink(o.listingKey) }; }).filter(o => o.address) : [];
    const events = sec.events ? (s.events || []).filter(x => x && x.title && x.date >= t).slice(0, 4) : [];
    const a = agent(), month = new Date(t + "T12:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" });
    return { id: "", subject: `${month.split(" ")[0]} in Colorado real estate | ${a.display}`.slice(0, 60), preheader: news[0] ? news[0].title : "Market numbers, news, and homes", monthLabel: month,
      intro: `Hi {{first_name}},\n\nHere’s what’s happening in Colorado real estate this ${s.frequency === "monthly" ? "month" : "week"}${listings.length ? ", plus my latest listings" : ""}${openHouses.length ? " and open houses" : ""}. If you or someone you know is thinking about a move, I’m always happy to help.`,
      market: sec.market && m && m.median ? { area: m.area, median: m.median, dom: m.dom, monthsSupply: m.monthsSupply, rate: m.rate, asOf: m.asOf, source: m.source, note: "" } : null,
      news, listings, openHouses, events, cta: { label: "Search homes", url: appLink("") }, agent: a, createdAt: now() };
  }
  const cur = () => NL.draft || (NL.draft = build());
  const issueHTML = () => R().personalize(R().render({ ...cur(), address: S().address || "[Mailing address goes here]", license: C.LICENSE_TEXT && !/\[add/i.test(C.LICENSE_TEXT) ? C.LICENSE_TEXT : "" }).html, { first_name: "Jordan", unsubscribe_url: "#" }, true);
  const issues = () => Object.entries(Store.crm.newsletters || {}).filter(([, x]) => x).map(([id, x]) => ({ id, ...x })).sort((a, b) => (b.sentAt || b.createdAt || "").localeCompare(a.sentAt || a.createdAt || ""));

  /* ------------------------------ AI ------------------------------ */
  async function aiWrite() {
    const sample = await window.claude?.use?.("sample");
    if (!sample) { NL.msg = "AI isn’t connected here yet. The template intro is ready to edit."; renderAgent(); return; }
    const d = cur(), s = S(); NL.busy = true; renderAgent();
    try {
      const out = await sample.json(`Write the subject line, preview text, and short personal intro for a real estate agent's ${s.frequency} client newsletter.
Agent: ${d.agent.name}${d.agent.byline ? ", " + d.agent.display : ""}. Areas: ${areas().join(", ")}. Voice: ${s.voice}.
This issue includes: ${JSON.stringify({ market: d.market && { median: d.market.median, dom: d.market.dom, monthsSupply: d.market.monthsSupply, rate: d.market.rate, asOf: d.market.asOf }, news: d.news.map(x => x.title), listings: d.listings.map(h => h.address), openHouses: d.openHouses.map(o => o.date + " " + o.address), events: d.events.map(x => x.title) })}
Rules: start the intro with "Hi {{first_name}}," then 2 short paragraphs under 90 words total. Use only the facts given. Fair Housing advertising rules apply. No emoji. Subject under 60 characters, preview under 90.
Return only JSON: {"subject":"...","preheader":"...","intro":"...","marketNote":"one plain-English sentence on what the market numbers mean, or empty"}`);
      if (out && out.intro) { d.intro = String(out.intro).slice(0, 1200); if (!/\{\{first_name\}\}/.test(d.intro)) d.intro = "Hi {{first_name}},\n\n" + d.intro; }
      if (out && out.subject) d.subject = String(out.subject).slice(0, 120); if (out && out.preheader) d.preheader = String(out.preheader).slice(0, 140);
      if (out && out.marketNote && d.market) d.market.note = String(out.marketNote).slice(0, 300);
      NL.msg = "Drafted. Make it sound like you before sending.";
    } catch (e) { NL.msg = "The AI didn’t come through. Try again."; }
    NL.busy = false; renderAgent();
  }

  /* ------------------------------ Send ------------------------------ */
  async function post(endpoint, body) {
    const token = window.MillerCloud ? await MillerCloud.token() : "";
    const r = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "That didn’t go through."); return j;
  }
  async function send(test) {
    const s = S(), d = cur(), list = NL.audience(s.audience);
    if (!s.address) { NL.msg = "Add the brokerage mailing address under Schedule and audience first. Every commercial email needs one."; renderAgent(); return; }
    if (!test && !list.length) { NL.msg = "No contacts match this audience."; renderAgent(); return; }
    if (!test && !confirm(`Send “${d.subject}” to ${list.length} ${list.length === 1 ? "contact" : "contacts"}?`)) return;
    if (Store.demo || !C.NEWSLETTER_ENDPOINT) {
      if (!test) Store.saveCrm("newsletters", d.id || null, { ...JSON.parse(JSON.stringify({ ...d, _all: undefined, skip: undefined })), status: "sent", sentAt: now(), recipients: list.length, sent: 0, failed: 0, demo: true, audience: s.audience });
      NL.msg = Store.demo ? `Demo: ${test ? "a test" : `this issue to ${list.length} contacts`} would send now. Nothing was emailed.` : "Newsletter sending turns on once the server is connected.";
      if (!test) NL.draft = null; renderAgent(); return;
    }
    NL.busy = true; renderAgent();
    try { const issue = JSON.parse(JSON.stringify(d)); delete issue._all; delete issue.skip; const r = await post(C.NEWSLETTER_ENDPOINT, { action: test ? "test" : "send", issue, audience: s.audience, issueId: d.id || "" }); NL.msg = test ? "Test sent to your email." : `Sent to ${r.sent} of ${r.recipients}.${r.failed ? ` ${r.failed} didn’t send.` : ""}`; if (!test) NL.draft = null; }
    catch (e) { NL.msg = e.message; }
    NL.busy = false; renderAgent();
  }

  /* ------------------------------ UI ------------------------------ */
  const nextRun = () => { const s = S(); if (!s.auto) return ""; const d = new Date(); for (let i = 1; i <= 62; i++) { const x = new Date(d); x.setDate(d.getDate() + i); const k = x.toLocaleDateString("en-CA"); if (s.frequency === "monthly" ? x.getDate() === Number(s.monthday) : x.getDay() === Number(s.weekday)) return x.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }); } return ""; };
  NL.html = function () {
    const tabs = [["issue", "This issue"], ["schedule", "Schedule and audience"], ["sent", "Sent"], ...(Store.isBroker ? [["news", "News desk"]] : [])];
    const s = S(), drafts = issues().filter(x => x.status === "draft");
    let html = `<p class="addr">Your own newsletter: Colorado real estate news, market numbers, your listings, open houses, and events, in your brand, sent to the contacts you choose.</p>
      <div class="ab-status ${s.auto ? "ok" : ""}"><strong>${s.auto ? `Automatic: ${s.frequency === "monthly" ? "monthly" : s.frequency === "biweekly" ? "every two weeks" : "weekly"}, ${s.mode === "send" ? "sent automatically" : "drafted for your review"}` : "Automatic newsletters are off"}</strong><span>${s.auto ? `Next issue ${nextRun()} at 8 AM to ${NL.audience(s.audience).length} contacts.` : "Turn them on under Schedule and audience, or send this issue now."}</span></div>
      <div class="mk-tabs" role="tablist">${tabs.map(([k, t]) => `<button role="tab" aria-selected="${NL.tab === k}" class="${NL.tab === k ? "on" : ""}" data-nl-tab="${k}">${t}</button>`).join("")}</div>`;
    if (NL.tab === "issue") {
      const d = cur(), n = NL.audience(s.audience).length;
      html += `${drafts.length && !d.id ? `<div class="cn-card"><strong>Your scheduled issue is ready to review</strong><div class="quick"><button class="btn gold" data-nl-load="${drafts[0].id}">Open it</button></div></div>` : ""}
        <div class="tourform"><label for="nlSub">Subject <span class="addr">${d.subject.length}/60</span></label><input id="nlSub" data-nl-f="subject" value="${esc(d.subject)}">
        <label for="nlPre">Preview text <span class="addr">${d.preheader.length}/90</span></label><input id="nlPre" data-nl-f="preheader" value="${esc(d.preheader)}">
        <label for="nlIntro">Personal note <span class="addr">{{first_name}} becomes each person’s first name</span></label><textarea id="nlIntro" rows="5" style="width:100%" data-nl-f="intro">${esc(d.intro)}</textarea>
        ${d.market ? `<label for="nlMk">What the market numbers mean (optional)</label><input id="nlMk" data-nl-mk value="${esc(d.market.note || "")}" placeholder="e.g. More homes to choose from, and sellers are offering concessions.">` : ""}
        <div class="quick"><button class="btn ghost" data-nl-ai ${NL.busy ? "disabled" : ""}>${NL.busy ? "Writing…" : "Write subject and note with AI"}</button><button class="btn ghost" data-nl-rebuild>Rebuild from latest</button></div></div>
        <h3 class="agent-h">In this issue</h3>
        ${list("market", d.market ? [["market", `Market numbers: ${short(d.market.median)} median, ${d.market.dom} days, ${d.market.monthsSupply} months of supply`]] : [], "No market numbers yet. The broker updates them under Market stats.")}
        ${list("news", d.news.map((x, i) => [i, `${x.title} · ${x.source || ""}`]), Store.isBroker ? "No approved news yet. Approve some on the News desk." : "No approved news this week yet.")}
        ${list("listings", d.listings.map((x, i) => [i, `${short(x.price)} · ${x.address}`]), "No current listings of yours to show.")}
        ${list("openHouses", d.openHouses.map((x, i) => [i, `${x.date} · ${x.address}`]), "No open houses in the next three weeks.")}
        ${list("events", d.events.map((x, i) => [i, `${x.title} · ${x.date}`]), "No upcoming events. Add one under Schedule and audience.")}
        <h3 class="agent-h">Preview</h3><iframe class="sb-frame" style="height:640px" title="Newsletter preview" sandbox srcdoc="${esc(issueHTML())}"></iframe>
        <div class="quick" style="margin-top:12px"><button class="btn ghost" data-nl-test ${NL.busy ? "disabled" : ""}>Send me a test</button><button class="btn gold" data-nl-send ${NL.busy ? "disabled" : ""}>Send to ${n} ${n === 1 ? "contact" : "contacts"}</button></div>
        ${NL.msg ? `<p class="msg" role="status">${esc(NL.msg)}</p>` : ""}
        <p class="addr">Each email includes your brand${agent().byline ? ` with “${esc(agent().byline)}”` : ""}, the brokerage line, Equal Housing Opportunity, the mailing address, and an unsubscribe link. Unsubscribes are honored automatically. Only your own listings are included.</p>`;
    } else if (NL.tab === "schedule") {
      const fs = folders(), aud = s.audience || {}, n = NL.audience(aud).length, days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      html += `<div class="tourform"><label class="check"><input type="checkbox" data-nl-s="auto" ${s.auto ? "checked" : ""}> Build my newsletter automatically</label>
        <div class="row2"><div><label for="nlFreq">How often</label><select id="nlFreq" data-nl-s="frequency">${[["weekly", "Weekly"], ["biweekly", "Every two weeks"], ["monthly", "Monthly"]].map(([k, t]) => `<option value="${k}" ${s.frequency === k ? "selected" : ""}>${t}</option>`).join("")}</select></div>
        <div>${s.frequency === "monthly" ? `<label for="nlMd">Day of the month</label><select id="nlMd" data-nl-s="monthday">${Array.from({ length: 28 }, (_, i) => `<option value="${i + 1}" ${Number(s.monthday) === i + 1 ? "selected" : ""}>${i + 1}</option>`).join("")}</select>` : `<label for="nlWd">Day</label><select id="nlWd" data-nl-s="weekday">${days.map((x, i) => `<option value="${i}" ${Number(s.weekday) === i ? "selected" : ""}>${x}</option>`).join("")}</select>`}</div></div>
        <label for="nlMode">When it’s built (8 AM)</label><select id="nlMode" data-nl-s="mode"><option value="review" ${s.mode !== "send" ? "selected" : ""}>Email me a draft to review and send</option><option value="send" ${s.mode === "send" ? "selected" : ""}>Send it automatically</option></select>
        <h3 class="agent-h">Who gets it <span class="addr">${n} ${n === 1 ? "contact" : "contacts"}</span></h3>
        <label class="check"><input type="checkbox" data-nl-aud="all" ${aud.all ? "checked" : ""}> Everyone in my contacts</label>
        ${aud.all ? "" : `<div class="complist">${[["buyer", "Buyers"], ["seller", "Sellers"]].map(([k, t]) => `<label><input type="checkbox" data-nl-role="${k}" ${(aud.roles || []).includes(k) ? "checked" : ""}><span>${t}</span></label>`).join("")}${fs.map(f => `<label><input type="checkbox" data-nl-folder="${esc(f)}" ${(aud.folders || []).includes(f) ? "checked" : ""}><span>${esc(f)}</span></label>`).join("")}</div>`}
        <p class="addr">People without an email, marked do not contact, or who unsubscribed are always left out.</p>
        <h3 class="agent-h">Sections</h3><div class="complist">${[["market", "Market numbers"], ["news", "Colorado news"], ["listings", "My listings"], ["openhouses", "Open houses"], ["events", "Events"]].map(([k, t]) => `<label><input type="checkbox" data-nl-sec="${k}" ${s.sections[k] !== false ? "checked" : ""}><span>${t}</span></label>`).join("")}</div>
        <div class="row2"><div><label for="nlNc">News stories</label><select id="nlNc" data-nl-s="newsCount">${[2, 3, 4, 5].map(x => `<option ${Number(s.newsCount) === x ? "selected" : ""}>${x}</option>`).join("")}</select></div><div><label for="nlVoice">Voice</label><select id="nlVoice" data-nl-s="voice">${["warm and personal", "polished and luxury", "straightforward and data-driven", "upbeat and friendly"].map(x => `<option ${s.voice === x ? "selected" : ""}>${x}</option>`).join("")}</select></div></div>
        <label for="nlAddr">Brokerage mailing address (required)</label><input id="nlAddr" data-nl-s="address" value="${esc(s.address)}" placeholder="Street, city, CO ZIP">
        <label for="nlMls">REcolorado agent ID (to include your MLS listings)</label><input id="nlMls" data-nl-s="mlsId" value="${esc(s.mlsId || "")}">
        <h3 class="agent-h">Events</h3>${(s.events || []).map((x, i) => `<div class="sb-item"><div class="row2"><input aria-label="Event name" placeholder="Event name" data-nl-ev="${i}|title" value="${esc(x.title || "")}"><input type="date" aria-label="Date" data-nl-ev="${i}|date" value="${esc(x.date || "")}"></div><div class="row2"><input type="time" aria-label="Time" data-nl-ev="${i}|time" value="${esc(x.time || "")}"><input aria-label="Place" placeholder="Place" data-nl-ev="${i}|place" value="${esc(x.place || "")}"></div><input type="url" aria-label="RSVP link" placeholder="RSVP link (https://…)" data-nl-ev="${i}|url" value="${esc(x.url || "")}"><button class="remove" data-nl-evdel="${i}">Remove</button></div>`).join("")}
        <div class="quick"><button class="btn ghost" data-nl-evadd>Add an event</button>${window.SiteBuilder ? `<button class="btn ghost" data-panel="sites">Make an RSVP page</button>` : ""}</div></div>`;
    } else if (NL.tab === "sent") {
      const xs = issues();
      html += xs.length ? xs.map(x => `<div class="pcard"><div class="pcard-top"><div><strong>${esc(x.subject)}</strong><p>${x.status === "draft" ? `Draft · ${when(x.createdAt)}` : `Sent ${when(x.sentAt)} · ${x.sent ?? 0} of ${x.recipients ?? 0}${x.failed ? ` · ${x.failed} failed` : ""}${x.demo ? " · demo" : ""}`}</p></div>${x.status === "draft" ? `<button class="btn ghost" data-nl-load="${x.id}">Review</button>` : ""}</div></div>`).join("") : `<div class="empty"><strong>Nothing sent yet</strong>Your sent issues appear here.</div>`;
    } else if (NL.tab === "news" && Store.isBroker) html += newsDeskHTML();
    return html;
  };
  function list(kind, rows, empty) {
    const d = cur(), off = (d.skip || {})[kind] || [];
    if (!rows.length) return `<p class="addr">${esc(empty)}</p>`;
    return `<div class="complist nl-items">${rows.map(([i, t]) => `<label><input type="checkbox" data-nl-item="${kind}|${i}" ${off.includes(String(i)) ? "" : "checked"}><span>${esc(t)}</span></label>`).join("")}</div>`;
  }
  function newsDeskHTML() {
    const xs = newsPool().sort((a, b) => (b.date || "").localeCompare(a.date || "")), by = st => xs.filter(x => (x.status || "suggested") === st);
    const row = x => `<div class="pcard"><div class="pcard-top"><div><strong><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title)}</a></strong><p>${esc([x.source, x.date].filter(Boolean).join(" · "))}${x.by === "ai" ? " · found by AI" : ""}${x.sample ? " · sample" : ""}</p></div></div>
      <textarea rows="2" aria-label="Summary" data-nw-sum="${x.id}" style="width:100%;margin:6px 0;border:1px solid var(--line);border-radius:8px;padding:8px;background:var(--bg);color:var(--ink)">${esc(x.summary || "")}</textarea>
      <div class="links">${x.status !== "approved" ? `<button data-nw-st="${x.id}|approved">Approve</button>` : ""}${x.status !== "rejected" ? `<button data-nw-st="${x.id}|rejected">Hide</button>` : ""}<button data-nw-del="${x.id}">Delete</button></div></div>`;
    return `<p class="addr">News for every agent’s newsletter. Each Monday AI searches for Colorado real estate news and suggests stories with short summaries in its own words and links to the source. Check each one, edit the summary if needed, and approve it. Agents’ newsletters only use approved stories.</p>
      <div class="quick"><button class="btn gold" data-nw-find ${NL.busy ? "disabled" : ""}>${NL.busy ? "Searching…" : "Find this week’s news now"}</button></div>${NL.newsMsg ? `<p class="msg" role="status">${esc(NL.newsMsg)}</p>` : ""}
      <h3 class="agent-h">Suggested <span class="addr">${by("suggested").length}</span></h3>${by("suggested").map(row).join("") || `<p class="addr">No suggestions waiting.</p>`}
      <h3 class="agent-h">Approved <span class="addr">${by("approved").length}</span></h3>${by("approved").map(row).join("") || `<p class="addr">None yet.</p>`}
      <h3 class="agent-h">Add a story</h3><div class="tourform"><label for="nwT">Headline (your words)</label><input id="nwT"><div class="row2"><div><label for="nwS">Source</label><input id="nwS" placeholder="Colorado Sun"></div><div><label for="nwD">Date</label><input id="nwD" type="date" value="${esc(today())}"></div></div>
        <label for="nwU">Link</label><input id="nwU" type="url" placeholder="https://…"><label for="nwM">Summary (1 or 2 sentences, your words)</label><textarea id="nwM" rows="2"></textarea><div class="quick"><button class="btn ghost" data-nw-add>Add and approve</button></div></div>
      <p class="addr">Write summaries in your own words and link to the source; don’t paste articles.</p>`;
  }

  /* ------------------------------ Events ------------------------------ */
  const saveNews = (id, x) => Office._t.saveCompany("news", id, x);
  document.addEventListener("input", e => {
    const d = e.target.dataset || {};
    if (d.nlF) { cur()[d.nlF] = e.target.value; clearTimeout(NL.t); NL.t = setTimeout(() => { const f = document.querySelector(".sb-frame"); if (f && agentPanel === "newsletters") f.srcdoc = issueHTML(); }, 400); }
    else if (d.nlMk !== undefined && cur().market) cur().market.note = e.target.value;
  });
  document.addEventListener("change", e => {
    const d = e.target.dataset || {};
    if (d.nlF || d.nlMk !== undefined) renderAgent();
    else if (d.nlS) { const k = d.nlS, v = e.target.type === "checkbox" ? e.target.checked : ["weekday", "monthday", "newsCount"].includes(k) ? Number(e.target.value) : e.target.value.trim(); saveS({ [k]: v }); if (k !== "auto" && k !== "mode" && k !== "address" && k !== "mlsId") NL.draft = null; renderAgent(); }
    else if (d.nlAud) { const aud = { ...S().audience, all: e.target.checked }; saveS({ audience: aud }); renderAgent(); }
    else if (d.nlRole) { const aud = { ...S().audience }; const r = new Set(aud.roles || []); e.target.checked ? r.add(d.nlRole) : r.delete(d.nlRole); aud.roles = [...r]; saveS({ audience: aud }); renderAgent(); }
    else if (d.nlFolder) { const aud = { ...S().audience }; const f = new Set(aud.folders || []); e.target.checked ? f.add(d.nlFolder) : f.delete(d.nlFolder); aud.folders = [...f]; saveS({ audience: aud }); renderAgent(); }
    else if (d.nlSec) { saveS({ sections: { ...S().sections, [d.nlSec]: e.target.checked } }); NL.draft = null; renderAgent(); }
    else if (d.nlEv) { const [i, k] = d.nlEv.split("|"), ev = JSON.parse(JSON.stringify(S().events || [])); ev[+i] = { ...ev[+i], [k]: e.target.value.trim() }; if (k === "url" && ev[+i].url && !/^https:\/\//.test(ev[+i].url)) ev[+i].url = ""; saveS({ events: ev }); NL.draft = null; }
    else if (d.nlItem) { const [kind, i] = d.nlItem.split("|"), dr = cur(); dr.skip = dr.skip || {}; const set = new Set(dr.skip[kind] || []); e.target.checked ? set.delete(i) : set.add(i); dr.skip[kind] = [...set]; applySkips(); renderAgent(); }
    else if (d.nwSum) { const x = Office.news[d.nwSum]; if (x) saveNews(d.nwSum, { ...x, summary: e.target.value.trim().slice(0, 400) }); }
  });
  // Unchecked items are left out of what gets rendered and sent.
  function applySkips() { const d = cur(); if (!d._all) d._all = { news: d.news, listings: d.listings, openHouses: d.openHouses, events: d.events, market: d.market }; const sk = d.skip || {}; ["news", "listings", "openHouses", "events"].forEach(k => { d[k] = d._all[k].filter((_, i) => !(sk[k] || []).includes(String(i))); }); d.market = (sk.market || []).includes("market") ? null : d._all.market; }
  document.addEventListener("click", async e => {
    const el = e.target.closest("[data-nl-tab],[data-nl-ai],[data-nl-rebuild],[data-nl-test],[data-nl-send],[data-nl-load],[data-nl-evadd],[data-nl-evdel],[data-nw-st],[data-nw-del],[data-nw-add],[data-nw-find]"); if (!el) return; const d = el.dataset;
    if (d.nlTab !== undefined) { NL.tab = d.nlTab; NL.msg = ""; renderAgent(); }
    else if (d.nlAi !== undefined) aiWrite();
    else if (d.nlRebuild !== undefined) { NL.draft = null; NL.msg = "Rebuilt with the latest news, listings, and open houses."; renderAgent(); }
    else if (d.nlTest !== undefined) send(true);
    else if (d.nlSend !== undefined) send(false);
    else if (d.nlLoad !== undefined) { const x = Store.crm.newsletters[d.nlLoad]; if (x) { NL.draft = { ...JSON.parse(JSON.stringify(x)), id: d.nlLoad }; NL.tab = "issue"; NL.msg = "Scheduled draft loaded. Review and send."; renderAgent(); } }
    else if (d.nlEvadd !== undefined) { saveS({ events: [...(S().events || []), { title: "", date: today(), time: "", place: "", url: "" }] }); renderAgent(); }
    else if (d.nlEvdel !== undefined) { const ev = [...(S().events || [])]; ev.splice(+d.nlEvdel, 1); saveS({ events: ev }); NL.draft = null; renderAgent(); }
    else if (d.nwSt !== undefined) { const [id, st] = d.nwSt.split("|"), x = Office.news[id]; if (x) { saveNews(id, { ...x, status: st, reviewedAt: now() }); NL.draft = null; renderAgent(); } }
    else if (d.nwDel !== undefined) { if (confirm("Delete this story?")) { saveNews(d.nwDel, null); NL.draft = null; renderAgent(); } }
    else if (d.nwAdd !== undefined) {
      const g = id => document.getElementById(id).value.trim(), x = { title: g("nwT").slice(0, 140), source: g("nwS").slice(0, 80), date: g("nwD"), url: g("nwU"), summary: g("nwM").slice(0, 400), tags: [], status: "approved", addedAt: now(), by: "broker" };
      if (!x.title || !/^https:\/\//.test(x.url) || !x.summary) { NL.newsMsg = "Add a headline, an https link, and a summary."; renderAgent(); return; }
      saveNews("nw" + Date.now().toString(36), x); NL.newsMsg = "Added."; NL.draft = null; renderAgent();
    }
    else if (d.nwFind !== undefined) {
      if (Store.demo || !C.NEWS_ENDPOINT) { NL.newsMsg = Store.demo ? "Demo: the weekly news search runs once the server is connected." : "Connect the server to search for news automatically. You can add stories by hand below."; renderAgent(); return; }
      NL.busy = true; renderAgent();
      try { const r = await post(C.NEWS_ENDPOINT, {}); NL.newsMsg = r.added ? `Found ${r.added} new ${r.added === 1 ? "story" : "stories"} to review.` : "No new stories this time."; } catch (err) { NL.newsMsg = err.message; }
      NL.busy = false; renderAgent();
    }
  });
  NL.seedDemo = function () {
    if (!window.Office) return; Office.news = Office.news || {};
    if (Object.keys(Office.news).length) return;
    const d = n => { const x = new Date(); x.setDate(x.getDate() - n); return x.toLocaleDateString("en-CA"); };
    [["Sample story: Denver-area inventory keeps climbing into winter", "Sample source", "More homes for sale than last year gives buyers more choices heading into the holidays. (Demo item; replace with real, approved stories.)", ["Denver", "inventory"], "approved", 2],
     ["Sample story: What lower mortgage rates mean for first-time buyers", "Sample source", "Rate changes affect monthly payments and buying power. (Demo item.)", ["rates"], "approved", 4],
     ["Sample story: Colorado property tax changes homeowners should know", "Sample source", "A plain-English look at upcoming property tax changes. (Demo item.)", ["Colorado", "taxes"], "approved", 6],
     ["Sample story: New transit-oriented homes planned near light rail", "Sample source", "A suggested story waiting for the broker’s review. (Demo item.)", ["Aurora"], "suggested", 1]]
      .forEach(([title, source, summary, tags, status, ago], i) => { Office.news["dnw" + i] = { title, source, url: `https://example.com/sample-news-${i + 1}`, date: d(ago), summary, tags, status, addedAt: new Date().toISOString(), by: i === 3 ? "ai" : "broker", sample: true }; });
  };
  NL._t = { build, matches, applySkips, cur };
  if (typeof Store !== "undefined" && Store.demo) NL.seedDemo();
})();
