/* =========================================================================
   The Miller Group — Listing presentation builder (PDF).
   Combines the agent's presentation profile, current market stats, the
   seller's CMA, an estimated net sheet, a marketing plan, and the selling
   process into one branded PDF. Saved at agent/<uid>/crm/presentations.
   Market stats are brokerage-wide (company/settings.marketStats).
   ========================================================================= */
(function () {
  const P = window.Presentation = { tab: "build" };
  const C = window.MG_CONFIG || {};

  // Starting market stats. The broker updates these monthly under Company hub, Market stats.
  const MARKET_DEFAULT = {
    asOf: "October 2026", area: "Denver metro",
    source: "REcolorado data, October 2026, via Chicago Title of Colorado (published November 10, 2026)",
    median: 585000, sfMedian: 640000, townMedian: 415000, condoMedian: 310000,
    dom: 29, domPrior: 31, monthsSupply: 4.4, active: 12085, closed: 2754, closedYoY: -20,
    concessionShare: 65, concessionMedian: 10000, expiredPer10: 9.2, rate: 7.4
  };
  const market = () => ({ ...MARKET_DEFAULT, ...((window.Office && Office.conn && Office.conn.marketStats) || {}) });

  const MARKETING = [
    ["photos", "Professional photography", "Bright, edited photos of every room, plus twilight exteriors where they help."],
    ["video", "Video walkthrough", "A short tour video for the listing, social media, and email."],
    ["floorplan", "Floor plan and measurements", "Buyers see the layout before they visit."],
    ["mls", "MLS and major home search sites", "Full exposure through REcolorado and the sites that pull from it."],
    ["matching", "Matching buyers in our system", "We alert clients whose saved searches and favorites fit your home the day it lists."],
    ["social", "Social media and targeted ads", "Paid ads aimed at buyers searching your area and price range."],
    ["openhouse", "Open houses", "Weekend opens with a digital sign-in so every visitor gets a follow-up."],
    ["neighbors", "Neighborhood outreach", "Just-listed notes and calls to neighbors, who often know the next buyer."],
    ["brokers", "Broker network", "Direct outreach to agents with active buyers in your price range."],
    ["staging", "Staging advice", "A room-by-room plan to help your home show at its best."],
    ["feedback", "Weekly updates", "Showing feedback, online views, and market changes every week."]
  ];
  const SECTIONS = [
    ["about", "Agent profile"], ["why", "Why The Miller Group"], ["market", "The market right now"], ["summary", "Property summary", true],
    ["comps", "Comparable homes and map", true], ["compdetail", "A page for each comp", true], ["sidebyside", "Side-by-side comparison", true],
    ["averages", "Status comparison and averages", true], ["charts", "Price charts", true], ["pricing", "Pricing analysis", true],
    ["strategy", "Pricing strategy"], ["net", "Estimated net proceeds"], ["prep", "Getting your home ready"], ["marketing", "Marketing plan"],
    ["process", "The selling process"], ["offers", "Incentives, offers, and negotiation"], ["questions", "Questions to ask any agent"]
  ];
  const DEFAULT_PROFILE = {
    presBio: "I help sellers along the Front Range price well, market boldly, and negotiate with care. My clients’ needs come first, and I’ve built my business one client at a time.",
    presPledge: ["Honesty and integrity in every situation", "Regular updates, so you always know where things stand", "Marketing that reaches the right buyers quickly", "A calm, organized process from listing to closing", "Help after the sale with anything you need for your move"],
    presStats: { years: "", homes: "", areas: "", avgDom: "", listToSale: "" },
    testimonials: []
  };
  const profile = () => { const p = Store.site || {}; return { ...DEFAULT_PROFILE, ...p, presStats: { ...DEFAULT_PROFILE.presStats, ...(p.presStats || {}) }, presPledge: (p.presPledge && p.presPledge.length) ? p.presPledge : DEFAULT_PROFILE.presPledge, testimonials: p.testimonials || [] }; };

  const list = () => Object.entries(Store.crm.presentations || {}).filter(([, x]) => x).map(([id, x]) => ({ id, ...x })).sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  const newId = () => "pr" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const num = v => { const n = parseFloat(String(v ?? "").replace(/[$,%\s]/g, "")); return isFinite(n) ? n : 0; };
  const usd = n => "$" + Math.round(n).toLocaleString("en-US");
  const daysInto = d => { if (!d) return 0; const x = new Date(d + "T12:00"), start = new Date(x.getFullYear(), 0, 1); return Math.round((x - start) / 864e5); };

  /* ---------- Net sheet ---------- */
  function netCalc(pr) {
    const n = pr.net || {}, cm = pr.cmaId ? Store.crm.cmas[pr.cmaId] : null;
    const price = num(n.price) || (cm ? cmaCalc(cm).value || 0 : 0);
    const pct = v => price * num(v) / 100;
    const taxes = num(n.annualTaxes) * daysInto(n.closeDate) / 365;
    const items = [
      ["Listing brokerage fee", pct(n.listFeePct), n.listFeePct ? `${n.listFeePct}% of price` : ""],
      ["Buyer’s agent compensation (if offered)", pct(n.buyerCompPct), n.buyerCompPct ? `${n.buyerCompPct}% of price` : "Optional and negotiable"],
      ["Owner’s title insurance", num(n.title), "Quote from title company"],
      ["Closing fee (your share)", num(n.closingFee), ""],
      ["HOA status letter and transfer fees", num(n.hoa), ""],
      ["Property taxes, prorated", taxes, n.annualTaxes ? "Colorado taxes are paid a year behind, so you credit the buyer for this year to date" : ""],
      ["Mortgage payoff", num(n.payoff), ""],
      ["Seller concessions", num(n.concessions), ""],
      ["Repairs and preparation", num(n.repairs), ""],
      ["Other", num(n.other), n.otherLabel || ""]
    ];
    const costs = items.reduce((t, x) => t + x[1], 0);
    return { price, items, costs, net: price - costs };
  }

  /* ---------- Builder UI ---------- */
  function sellerContacts() { return contacts().filter(c => isSeller(c)); }
  function defaultNet(pr) {
    const cm = pr.cmaId ? Store.crm.cmas[pr.cmaId] : null, r = cm ? cmaCalc(cm) : null;
    const d = new Date(); d.setDate(d.getDate() + 60);
    return { price: r && r.value ? r.value : "", listFeePct: (Store.settings || {}).listFeePct ?? "", buyerCompPct: "", title: "", closingFee: "", hoa: "", annualTaxes: "", closeDate: d.toLocaleDateString("en-CA"), payoff: "", concessions: "", repairs: "", other: "", otherLabel: "" };
  }
  P.create = function (opts = {}) {
    const c = opts.contactId ? Store.crm.contacts[opts.contactId] : null;
    const cmaId = opts.cmaId || (c ? (Object.entries(Store.crm.cmas || {}).find(([, x]) => x && x.contactId === c.id) || [])[0] : "") || "";
    const cm = cmaId ? Store.crm.cmas[cmaId] : null;
    const pr = { contactId: c ? c.id : (cm && cm.contactId) || "", cmaId, preparedFor: c ? c.name : (cm && cm.preparedFor) || "", address: cm ? cm.subject.address : (c && c.listingAddress) || "",
      sections: Object.fromEntries(SECTIONS.map(([k]) => [k, true])), marketing: MARKETING.map(m => m[0]), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    pr.net = defaultNet(pr);
    const id = Store.saveCrm("presentations", null, pr);
    agentPanel = "presentation:" + id; if (location.hash !== "#agent") location.hash = "agent"; else renderAgent(); window.scrollTo(0, 0);
    return id;
  };
  const edit = (id, fn) => { const x = structuredClone(Store.crm.presentations[id]); if (!x) return; fn(x); x.updatedAt = new Date().toISOString(); Store.saveCrm("presentations", id, x); };

  P.listHTML = function () {
    const ps = list();
    return `<p class="addr">A branded PDF for seller appointments: your story, today’s market, the home’s value, an estimated net sheet, your marketing plan, and the selling process.</p>
      <div class="quick"><button class="btn gold" data-pr-new>New presentation</button><button class="btn ghost" data-panel="pres-profile">My presentation profile</button>${Store.isBroker ? `<button class="btn ghost" data-pr-market>Market stats</button>` : ""}</div>` +
      (ps.length ? ps.map(p => `<div class="pcard"><div class="pcard-top"><div><strong>${esc(p.address || "Untitled presentation")}</strong><p>${p.preparedFor ? "For " + esc(p.preparedFor) + " · " : ""}${when(p.updatedAt)}</p></div></div><div class="links"><button data-panel="presentation:${p.id}">Open</button></div></div>`).join("")
        : `<div class="empty"><strong>No presentations yet</strong>Start one from here, from a seller in your pipeline, or from a CMA.</div>`);
  };
  P.html = function (id) {
    const pr = Store.crm.presentations[id], back = `<button class="back" data-panel="presentations">‹ Listing presentations</button>`;
    if (!pr) return back + `<div class="empty"><strong>Presentation not found</strong>It may have been deleted.</div>`;
    const cmas = Object.entries(Store.crm.cmas || {}).filter(([, x]) => x), n = pr.net || {}, calc = netCalc(pr), m = market();
    const f = (k, label, ph = "", type = "text") => `<div><label for="pn_${k}">${label}</label><input id="pn_${k}" ${type === "date" ? 'type="date"' : 'inputmode="decimal"'} data-pr-net="${id}|${k}" placeholder="${esc(ph)}" value="${esc(n[k] ?? "")}"></div>`;
    return `${back}<div class="colhead"><h2>${esc(pr.address || "Listing presentation")}</h2><button class="btn ghost" data-pr-del="${id}">Delete</button></div>
      <div class="tourform">
        <div class="row2"><div><label for="prAddr">Property address</label><input id="prAddr" data-pr-f="${id}|address" value="${esc(pr.address || "")}"></div><div><label for="prFor">Prepared for</label><input id="prFor" data-pr-f="${id}|preparedFor" value="${esc(pr.preparedFor || "")}"></div></div>
        <div class="row2"><div><label for="prContact">Seller</label><select id="prContact" data-pr-f="${id}|contactId"><option value="">None</option>${sellerContacts().map(c => `<option value="${esc(c.id)}" ${c.id === pr.contactId ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></div>
        <div><label for="prCma">CMA</label><select id="prCma" data-pr-f="${id}|cmaId"><option value="">None</option>${cmas.map(([cid, x]) => `<option value="${esc(cid)}" ${cid === pr.cmaId ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select></div></div>
        ${pr.cmaId ? "" : `<p class="addr">Pick a CMA to include the home’s value and comps. <button class="remove" data-newcma>New CMA</button></p>`}
      </div>
      <div class="cmares"><p>Estimated net proceeds</p><b>${calc.price ? usd(calc.net) : "Add a sale price"}</b><p>${calc.price ? `${usd(calc.price)} sale price minus ${usd(calc.costs)} in estimated costs` : "Uses the CMA’s indicated value when you pick a CMA."}</p>
        <div class="quick" style="margin:10px 0 0"><button class="btn gold" data-pr-pdf="${id}">Download presentation (PDF)</button><button class="btn ghost" data-wr-for="presentation|cma|${esc(pr.cmaId || "")}">Talk track</button></div><p class="msg" id="prMsg" role="status"></p></div>
      <h3 class="agent-h">Net sheet</h3><p class="addr">Estimates for discussion. The title company provides exact figures before closing.</p>
      <div class="tourform"><div class="row2">${f("price", "Sale price", "$650,000")}${f("closeDate", "Estimated closing", "", "date")}</div>
        <div class="row2">${f("listFeePct", "Listing brokerage fee (%)", "Agreed with seller")}${f("buyerCompPct", "Buyer’s agent compensation (%)", "Optional")}</div>
        <div class="row2">${f("title", "Owner’s title insurance", "From title quote")}${f("closingFee", "Closing fee, your share", "$")}</div>
        <div class="row2">${f("annualTaxes", "Annual property taxes", "$")}${f("hoa", "HOA letter and transfer fees", "$")}</div>
        <div class="row2">${f("payoff", "Mortgage payoff", "$")}${f("concessions", "Seller concessions", `Median in ${m.asOf}: ${usd(m.concessionMedian)}`)}</div>
        <div class="row2">${f("repairs", "Repairs and preparation", "$")}${f("other", "Other", "$")}</div></div>
      <h3 class="agent-h">Marketing plan</h3><div class="complist">${MARKETING.map(([k, t, d]) => `<label><input type="checkbox" data-pr-mk="${id}|${k}" ${(pr.marketing || []).includes(k) ? "checked" : ""}><span><strong>${esc(t)}</strong><br><span class="addr">${esc(d)}</span></span></label>`).join("")}</div>
      <h3 class="agent-h">Sections</h3><div class="complist">${SECTIONS.map(([k, t, needsCma]) => `<label><input type="checkbox" data-pr-sec="${id}|${k}" ${pr.sections && pr.sections[k] !== false ? "checked" : ""}><span>${esc(t)}${needsCma && !pr.cmaId ? " (needs a CMA)" : ""}${k === "about" && !(Store.site || {}).presBio ? ` <span class="addr">· using default text, <button class="remove" data-panel="pres-profile">edit profile</button></span>` : ""}</span></label>`).join("")}</div>`;
  };

  /* ---------- Presentation profile (per agent, shown in their presentations) ---------- */
  P.profileHTML = function () {
    const p = profile(), s = p.presStats;
    return `<form id="presProfileForm" class="tourform"><p class="addr">This goes on the About me and Questions pages of every presentation you make.</p>
      <div class="row2"><div><label for="ppTitle">Title</label><input id="ppTitle" placeholder="Broker" value="${esc(p.title || "")}"></div><div><label for="ppPhoto">Headshot link (optional)</label><input id="ppPhoto" type="url" placeholder="https://…/headshot.jpg" value="${esc(p.photoUrl || "")}"></div></div>
      <label for="ppBio">About you</label><textarea id="ppBio" rows="4" style="width:100%">${esc(p.presBio)}</textarea>
      <label for="ppPledge">Your pledge (one per line)</label><textarea id="ppPledge" rows="5" style="width:100%">${esc(p.presPledge.join("\n"))}</textarea>
      <div class="row2"><div><label for="ppYears">In real estate since</label><input id="ppYears" placeholder="2016" value="${esc(s.years)}"></div><div><label for="ppHomes">Homes sold</label><input id="ppHomes" placeholder="250+" value="${esc(s.homes)}"></div></div>
      <div class="row2"><div><label for="ppDom">Your median days on market</label><input id="ppDom" placeholder="Optional" value="${esc(s.avgDom)}"></div><div><label for="ppLts">Your sale-to-list price ratio (%)</label><input id="ppLts" placeholder="Optional" value="${esc(s.listToSale)}"></div></div>
      <label for="ppAreas">Areas you know best</label><input id="ppAreas" placeholder="Denver, Aurora, Summit County" value="${esc(s.areas)}">
      <label for="ppFee">Your usual listing fee for net sheets (%)</label><input id="ppFee" inputmode="decimal" placeholder="You set this with each seller" value="${esc((Store.settings || {}).listFeePct ?? "")}">
      <label for="ppTest">Client reviews (one per line: quote | name | city)</label><textarea id="ppTest" rows="5" style="width:100%" placeholder="Easy to work with and quick to respond. | Jane D. | Denver, CO">${esc(p.testimonials.map(t => [t.quote, t.name, t.place].join(" | ")).join("\n"))}</textarea>
      <p class="addr">Only use reviews clients gave you and agreed to share. Stats should be your own and current.</p>
      <div class="actions"><button class="btn gold" type="submit">Save profile</button></div><p class="msg" id="ppMsg" role="status"></p></form>`;
  };
  P.bindProfile = function () {
    const f = $("#presProfileForm"); if (!f) return;
    f.addEventListener("submit", async e => {
      e.preventDefault();
      const tests = $("#ppTest").value.split("\n").map(l => l.split("|").map(x => x.trim())).filter(x => x[0]).map(([quote, name, place]) => ({ quote, name: name || "", place: place || "" })).slice(0, 6);
      await Store.saveProfile({ title: $("#ppTitle").value.trim(), photoUrl: $("#ppPhoto").value.trim(), presBio: $("#ppBio").value.trim(), presPledge: $("#ppPledge").value.split("\n").map(x => x.trim()).filter(Boolean).slice(0, 8),
        presStats: { years: $("#ppYears").value.trim(), homes: $("#ppHomes").value.trim(), avgDom: $("#ppDom").value.trim(), listToSale: $("#ppLts").value.trim(), areas: $("#ppAreas").value.trim() }, testimonials: tests });
      const fee = $("#ppFee").value.trim(); Store.saveSettings({ listFeePct: fee === "" ? null : num(fee) });
      $("#ppMsg").textContent = "Saved.";
    });
  };
  P.openMarket = function () {
    const m = market();
    const fld = (k, label) => `<div><label for="ms_${k}">${label}</label><input id="ms_${k}" value="${esc(m[k])}"></div>`;
    $("#formBody").innerHTML = `<div class="sheettop"><h2>Market stats</h2><button class="close" data-close aria-label="Close">×</button></div>
      <form id="msForm"><p class="addr">Every agent’s presentations use these. Update them each month from the DMAR Market Trends Report or REcolorado.</p>
        <div class="row2">${fld("asOf", "Month")}${fld("area", "Area")}</div>
        <div class="row2">${fld("median", "Median sale price, all")}${fld("sfMedian", "Median, single-family")}</div>
        <div class="row2">${fld("townMedian", "Median, townhome")}${fld("condoMedian", "Median, condo")}</div>
        <div class="row2">${fld("dom", "Median days on market")}${fld("domPrior", "Same month last year")}</div>
        <div class="row2">${fld("monthsSupply", "Months of supply")}${fld("active", "Active listings")}</div>
        <div class="row2">${fld("closed", "Closed sales")}${fld("closedYoY", "Closed sales vs last year (%)")}</div>
        <div class="row2">${fld("concessionShare", "Sales with concessions (%)")}${fld("concessionMedian", "Median concession ($)")}</div>
        <div class="row2">${fld("expiredPer10", "Expired or withdrawn per 10 sales")}${fld("rate", "30-year mortgage rate (%)")}</div>
        <label for="ms_source">Source</label><input id="ms_source" value="${esc(m.source)}">
        <div class="actions"><button class="btn gold" type="submit">Save</button><button class="btn ghost" type="button" id="msReset">Reset to defaults</button></div></form>`;
    const save = v => { Office._t.saveCompanyDoc("settings", { marketStats: v }); $("#dlgForm").close(); renderAgent(); };
    $("#msForm").addEventListener("submit", e => { e.preventDefault(); const v = {}; Object.keys(MARKET_DEFAULT).forEach(k => { const raw = $("#ms_" + k).value.trim(); v[k] = typeof MARKET_DEFAULT[k] === "number" ? num(raw) : raw; }); save(v); });
    $("#msReset").addEventListener("click", () => save({ ...MARKET_DEFAULT }));
    if (!$("#dlgForm").open) $("#dlgForm").showModal();
  };

  /* ============================== PDF ==============================
     Layout follows a data-first listing presentation: cover, agent, market,
     property summary, comps (map, details, side by side, averages, charts),
     pricing analysis, net proceeds, then the plan and process pages. */
  async function toDataURL(url) {
    if (!url) return null;
    try {
      const res = await fetch(url, { mode: "cors" }); if (!res.ok) return null;
      const blob = await res.blob(); if (!/^image\/(jpeg|png)/.test(blob.type)) return null;
      return await new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.onerror = () => r(null); f.readAsDataURL(blob); });
    } catch (e) { return null; }
  }
  const STATUS_COLOR = { "Closed": [20, 26, 38], "Sold": [20, 26, 38], "Pending": [104, 110, 122], "Active": [184, 147, 90], "Coming Soon": [214, 190, 150] };
  const statusOrder = s => ({ Closed: 0, Sold: 0, Pending: 1, Active: 2, "Coming Soon": 3 })[s] ?? 4;
  const dom = l => l.listed ? Math.max(0, Math.round((Date.now() - new Date(l.listed + "T12:00")) / 864e5)) : null;
  function fit(xs, ys) { const n = xs.length; if (n < 2) return null; const mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n; let num = 0, den = 0; xs.forEach((x, i) => { num += (x - mx) * (ys[i] - my); den += (x - mx) ** 2; }); if (!den) return null; const b = num / den; return { b, a: my - b * mx }; }

  async function buildPDF(id) {
    const jsPDF = await CMAReport.loadPdfLib();
    const pr = Store.crm.presentations[id], B = CMAReport.brand, t = CMAReport.clean;
    const prof = profile(), m = market(), on = k => !pr.sections || pr.sections[k] !== false;
    const cm = pr.cmaId ? Store.crm.cmas[pr.cmaId] : null, r = cm ? cmaCalc(cm) : null;
    const sub = cm ? cm.subject : {}, subL = cm && cm.subjectKey ? listingSync(cm.subjectKey) : null;
    const comps = r ? r.rows : [];
    const agent = { name: IDX.BROKER.name, phone: IDX.BROKER.phone, email: IDX.BROKER.email || "", firm: IDX.BROKER.firm || "The Miller Group", first: String(IDX.BROKER.name || "").split(" ")[0], title: prof.title || "Broker" };
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const W = 612, H = 792, M = 40, CW = W - M * 2, gold = B.gold, mid = B.midnight, lin = B.linen, gray = B.gray, ink = B.ink, line = B.line, white = [255, 255, 255];
    let y = 0, pageNo = 0;
    const font = (f, st, sz, col) => { doc.setFont(f, st); doc.setFontSize(sz); doc.setTextColor(...(col || ink)); };
    const wrap = (s, w) => doc.splitTextToSize(t(s), w);
    const para = (s, sz = 10.5, col = ink, w = CW, x = M, lh = 1.5) => { font("helvetica", "normal", sz, col); wrap(s, w).forEach(l => { doc.text(l, x, y); y += sz * lh; }); };
    const page = title => {
      if (pageNo) doc.addPage(); pageNo++;
      doc.setFillColor(...mid); doc.rect(0, 0, W, 52, "F"); doc.setFillColor(...gold); doc.rect(0, 52, W, 2, "F");
      font("times", "bold", 15, gold); doc.text(t(agent.firm), M, 32);
      font("helvetica", "bold", 14, white); doc.text(t(title), W - M, 32, { align: "right" });
      y = 84;
    };
    const ensure = (h, title) => { if (y + h > H - 70) page(title); };
    const h2 = s => { font("helvetica", "bold", 12, mid); doc.text(t(s), M, y); y += 6; doc.setDrawColor(...gold); doc.setLineWidth(1.2); doc.line(M, y, M + 30, y); y += 16; };
    const badge = (x, yy, n, rad = 10, fill = gold, col = white) => { doc.setFillColor(...fill); doc.circle(x, yy, rad, "F"); font("helvetica", "bold", rad * 0.95, col); doc.text(String(n), x, yy + rad * 0.34, { align: "center" }); };
    const box = (x, yy, w, h, fill = lin) => { doc.setFillColor(...fill); doc.setDrawColor(...line); doc.setLineWidth(0.5); doc.roundedRect(x, yy, w, h, 4, 4, "FD"); };
    const house = (x, yy, w, h) => { box(x, yy, w, h); const cx = x + w / 2, cy = yy + h / 2, s = Math.min(w, h) / 3; doc.setDrawColor(...gold); doc.setLineWidth(1.4); doc.line(cx - s, cy, cx, cy - s * 0.8); doc.line(cx, cy - s * 0.8, cx + s, cy); doc.rect(cx - s * 0.7, cy, s * 1.4, s * 0.8); doc.rect(cx - s * 0.15, cy + s * 0.35, s * 0.3, s * 0.45); };
    const photo = async (url, x, yy, w, h) => { const d = await toDataURL(url); if (d) { try { doc.addImage(d, d.includes("image/png") ? "PNG" : "JPEG", x, yy, w, h, undefined, "FAST"); return true; } catch (e) {} } house(x, yy, w, h); return false; };
    const kv = (x, yy, k, v, w = 150) => { font("helvetica", "bold", 8.5, gray); doc.text(t(k), x, yy); font("helvetica", "normal", 10, ink); doc.text(wrap(v == null || v === "" ? "-" : v, w - 4)[0] || "-", x, yy + 13); };
    const table = (cols, rows, opts = {}) => {
      const rh = opts.rh || 20; font("helvetica", "bold", 8.5, white); doc.setFillColor(...mid); doc.rect(M, y, CW, rh, "F");
      let x = M + 6; cols.forEach(([h, w, a]) => { doc.text(t(h), a === "r" ? x + w - 10 : x, y + 13, a === "r" ? { align: "right" } : undefined); x += w; }); y += rh;
      rows.forEach((row, i) => {
        ensure(rh + 4, opts.title || ""); if (i % 2 === 0) { doc.setFillColor(...lin); doc.rect(M, y, CW, rh, "F"); }
        if (row._mark) { doc.setFillColor(...gold); doc.rect(M, y, 3, rh, "F"); }
        x = M + 6; row.forEach((v, k) => { const [, w, a] = cols[k]; font("helvetica", row._bold && k <= 1 ? "bold" : "normal", 8.8, ink); const s = wrap(v, w - 8)[0] || ""; doc.text(s, a === "r" ? x + w - 10 : x, y + 13.5, a === "r" ? { align: "right" } : undefined); x += w; });
        y += rh;
      });
      y += 10;
    };
    const scatter = (title, xs, ys, cols, xLab, fmtX, opts = {}) => {
      const x0 = M + 54, y0 = y, w = CW - 70, h = 330;
      const allY = [...ys, ...(opts.hLine ? [opts.hLine] : [])], allX = [...xs, ...(opts.vLine ? [opts.vLine] : [])];
      let ymin = Math.min(...allY), ymax = Math.max(...allY), xmin = Math.min(...allX), xmax = Math.max(...allX);
      const py = (ymax - ymin) * 0.12 || ymax * 0.05, px = (xmax - xmin) * 0.1 || 5; ymin -= py; ymax += py; xmin = Math.max(0, xmin - px); xmax += px;
      const X = v => x0 + (v - xmin) / (xmax - xmin) * w, Y = v => y0 + h - (v - ymin) / (ymax - ymin) * h;
      doc.setDrawColor(...line); doc.setLineWidth(0.5);
      for (let i = 0; i <= 5; i++) { const v = ymin + (ymax - ymin) * i / 5, yy = Y(v); doc.line(x0, yy, x0 + w, yy); font("helvetica", "normal", 8, gray); doc.text(short(v), x0 - 6, yy + 3, { align: "right" }); }
      for (let i = 0; i <= 5; i++) { const v = xmin + (xmax - xmin) * i / 5; font("helvetica", "normal", 8, gray); doc.text(fmtX(v), X(v), y0 + h + 14, { align: "center" }); }
      const f = fit(xs, ys); if (f) { doc.setDrawColor(...mid); doc.setLineWidth(1.2); doc.line(X(xmin), Y(f.a + f.b * xmin), X(xmax), Y(f.a + f.b * xmax)); }
      if (opts.vLine) { doc.setDrawColor(...gold); doc.setLineWidth(1); doc.setLineDashPattern([4, 3], 0); doc.line(X(opts.vLine), y0, X(opts.vLine), y0 + h); doc.setLineDashPattern([], 0); font("helvetica", "bold", 8.5, gold); doc.text(t(opts.vLabel || ""), X(opts.vLine) + 4, y0 + 10); }
      if (opts.hLine) { doc.setDrawColor(...gold); doc.setLineWidth(1); doc.setLineDashPattern([4, 3], 0); doc.line(x0, Y(opts.hLine), x0 + w, Y(opts.hLine)); doc.setLineDashPattern([], 0); font("helvetica", "bold", 8.5, gold); doc.text(t(opts.hLabel || ""), x0 + w - 4, Y(opts.hLine) - 4, { align: "right" }); }
      xs.forEach((v, i) => badge(X(v), Y(ys[i]), i + 1, 8, cols[i]));
      y = y0 + h + 34; font("helvetica", "bold", 9, mid); doc.text(t(xLab), x0, y);
      let lx = x0 + w; [["Sold", STATUS_COLOR.Sold], ["Pending", STATUS_COLOR.Pending], ["Active", STATUS_COLOR.Active], ["Coming soon", STATUS_COLOR["Coming Soon"]]].reverse().forEach(([lab, c]) => { font("helvetica", "normal", 8.5, ink); const tw = doc.getTextWidth(lab); lx -= tw; doc.text(lab, lx, y); lx -= 12; doc.setFillColor(...c); doc.circle(lx + 4, y - 3, 4, "F"); lx -= 14; });
      y += 18; if (f) para(opts.note ? opts.note(f) : "The line shows the trend across these comps.", 9, gray);
    };

    /* ---------- Cover ---------- */
    pageNo = 1;
    doc.setFillColor(...mid); doc.rect(0, 0, W, H, "F");
    const coverPhoto = subL && subL.photos && subL.photos[0] ? await toDataURL(subL.photos[0]) : null;
    if (coverPhoto) { try { doc.addImage(coverPhoto, coverPhoto.includes("image/png") ? "PNG" : "JPEG", 0, 120, W, 380, undefined, "FAST"); doc.setFillColor(...mid); doc.setGState && doc.setGState(new doc.GState({ opacity: 0.35 })); doc.rect(0, 120, W, 380, "F"); doc.setGState && doc.setGState(new doc.GState({ opacity: 1 })); } catch (e) {} }
    else { doc.setDrawColor(...gold); doc.setLineWidth(1.6); const pts = [[0, 0], [70, -38], [110, -16], [175, -72], [230, -30], [270, -52], [330, -8], [395, -64], [450, -22], [500, -46], [560, -12], [612, -30]]; for (let i = 1; i < pts.length; i++) doc.line(pts[i - 1][0], 470 + pts[i - 1][1], pts[i][0], 470 + pts[i][1]); }
    font("times", "bold", 18, gold); doc.text(t(agent.firm), M, 56);
    font("helvetica", "normal", 12, lin); doc.text("Listing presentation", W - M, 56, { align: "right" });
    font("times", "bold", 38, white); y = 560; wrap(pr.address || sub.address || "Your home", CW).slice(0, 2).forEach(l => { doc.text(l, M, y); y += 42; });
    font("helvetica", "normal", 12, lin); doc.text(t([pr.preparedFor ? `Prepared for ${pr.preparedFor}` : "", new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })].filter(Boolean).join("   |   ")), M, y + 4);
    doc.setFillColor(255, 255, 255); doc.roundedRect(M, 668, 300, 84, 6, 6, "F");
    const head = prof.photoUrl ? await toDataURL(prof.photoUrl) : null;
    if (head) { try { doc.addImage(head, head.includes("image/png") ? "PNG" : "JPEG", M + 10, 678, 64, 64, undefined, "FAST"); } catch (e) {} } else { doc.setFillColor(...gold); doc.circle(M + 42, 710, 30, "F"); font("times", "bold", 22, white); doc.text(t(agent.name.split(" ").map(s => s[0]).join("").slice(0, 2)), M + 42, 718, { align: "center" }); }
    font("helvetica", "bold", 12, mid); doc.text(t(agent.name), M + 86, 696); font("helvetica", "normal", 9.5, gray); doc.text(t(agent.title), M + 86, 710); doc.text(t(agent.phone), M + 86, 723); doc.text(t(agent.email), M + 86, 736);

    /* ---------- About ---------- */
    if (on("about")) {
      page("Agent profile");
      const ph = prof.photoUrl ? await toDataURL(prof.photoUrl) : null;
      box(M, y, 150, 180, mid); if (ph) { try { doc.addImage(ph, ph.includes("image/png") ? "PNG" : "JPEG", M, y, 150, 150, undefined, "FAST"); } catch (e) {} } else { doc.setFillColor(...gold); doc.circle(M + 75, y + 70, 44, "F"); font("times", "bold", 34, white); doc.text(t(agent.name.split(" ").map(s => s[0]).join("").slice(0, 2)), M + 75, y + 82, { align: "center" }); }
      font("helvetica", "bold", 11, white); doc.text(t(agent.name), M + 10, y + 166);
      const top = y; let ry = y + 8; const rx = M + 170;
      [["Phone", agent.phone], ["Email", agent.email], ["Brokerage", agent.firm], ["Areas", prof.presStats.areas]].filter(x => x[1]).forEach(([k, v]) => { kv(rx, ry, k, v, CW - 170); ry += 34; });
      y = Math.max(top + 200, ry + 8);
      h2("About me"); para(prof.presBio, 10.5);
      const s = prof.presStats, st = [[s.years ? `Since ${s.years}` : "", "In real estate"], [s.homes, "Homes sold"], [s.avgDom ? `${s.avgDom} days` : "", "Median days on market"], [s.listToSale ? `${s.listToSale}%` : "", "Sale to list price"]].filter(x => x[0]);
      if (st.length) { y += 6; const w = (CW - (st.length - 1) * 8) / st.length; st.forEach((x, i) => { box(M + i * (w + 8), y, w, 54); font("times", "bold", 18, mid); doc.text(t(x[0]), M + i * (w + 8) + 10, y + 24); font("helvetica", "normal", 8.5, gray); doc.text(t(x[1]), M + i * (w + 8) + 10, y + 42); }); y += 70; }
      h2("My pledge to you"); prof.presPledge.forEach(p => { doc.setFillColor(...gold); doc.circle(M + 4, y - 3.5, 2.8, "F"); font("helvetica", "normal", 10, ink); wrap(p, CW - 16).forEach(l => { doc.text(l, M + 14, y); y += 14; }); y += 2; });
      if (prof.testimonials.length) {
        y += 8; ensure(80, "Agent profile"); h2("What clients say");
        prof.testimonials.slice(0, 3).forEach(q => { font("times", "italic", 11, ink); const lines = wrap(`"${q.quote}"`, CW - 28), h = lines.length * 13.5 + 28; ensure(h + 8, "Agent profile"); box(M, y, CW, h); doc.setFillColor(...gold); doc.rect(M, y, 3, h, "F"); font("times", "italic", 11, ink); lines.forEach((l, i) => doc.text(l, M + 14, y + 18 + i * 13.5)); font("helvetica", "bold", 8.5, gray); doc.text(t([q.name, q.place].filter(Boolean).join(", ")), M + 14, y + h - 8); y += h + 8; });
      }
    }

    /* ---------- Why us ---------- */
    if (on("why")) {
      page(`Why ${agent.firm}`);
      const pts = [["Pricing grounded in data", "A market analysis of the homes buyers will compare to yours, with every adjustment shown, so your price rests on evidence."], ["Marketing that finds buyers", "Professional media, full online exposure, and same-day alerts to buyers in our system whose searches fit your home."], ["Strong, steady negotiation", "Every offer compared on price, financing, terms, and certainty, then repairs and appraisal negotiated with you at each step."], ["You always know where things stand", "Weekly updates with showing feedback, online activity, and market changes."], ["Colorado contract know-how", "Every deadline tracked, from inspection to title, appraisal, and loan conditions, so nothing slips."], ["Trusted partners", "Introductions to inspectors, stagers, contractors, title, and movers. You choose who to use."]];
      const colW = (CW - 20) / 2;
      pts.forEach((p, i) => { const x = M + (i % 2) * (colW + 20), top = y + Math.floor(i / 2) * 120; box(x, top, colW, 108, white); badge(x + 20, top + 22, i + 1, 11); font("helvetica", "bold", 11, mid); doc.text(wrap(p[0], colW - 50)[0], x + 40, top + 26); font("helvetica", "normal", 9.5, ink); wrap(p[1], colW - 28).slice(0, 5).forEach((l, k) => doc.text(l, x + 14, top + 50 + k * 13)); });
      y += 370;
    }

    /* ---------- Market ---------- */
    if (on("market")) {
      page("The market right now");
      font("helvetica", "normal", 10, gray); doc.text(t(`${m.area}  |  ${m.asOf}`), M, y); y += 16;
      const tiles = [[usd(m.median), "Median sale price"], [`${m.dom} days`, `Median days on market (${m.domPrior} last year)`], [String(m.monthsSupply), "Months of supply"], [Number(m.active).toLocaleString(), "Homes for sale"], [`${m.closedYoY > 0 ? "+" : ""}${m.closedYoY}%`, "Closed sales vs last year"], [`${m.rate}%`, "30-year mortgage rate"]];
      const w = (CW - 16) / 3; tiles.forEach((x, i) => { const tx = M + (i % 3) * (w + 8), ty = y + Math.floor(i / 3) * 70; box(tx, ty, w, 62); font("times", "bold", 20, mid); doc.text(t(x[0]), tx + 12, ty + 28); font("helvetica", "normal", 8.5, gray); doc.text(wrap(x[1], w - 20)[0], tx + 12, ty + 46); }); y += 152;
      h2("Median price by home type"); const bars = [["Single-family", m.sfMedian], ["Townhome", m.townMedian], ["Condo", m.condoMedian]], mx = Math.max(...bars.map(b => b[1]), 1);
      bars.forEach(([lab, v]) => { font("helvetica", "normal", 10, ink); doc.text(lab, M, y + 9); doc.setFillColor(...mid); doc.rect(M + 90, y, (CW - 170) * v / mx, 12, "F"); font("helvetica", "bold", 10, mid); doc.text(usd(v), M + 96 + (CW - 170) * v / mx, y + 10); y += 22; });
      y += 10; h2("What this means for you");
      const kind = m.monthsSupply < 3 ? "a seller’s market, so well-priced homes move quickly" : m.monthsSupply <= 6 ? "a balanced market. Buyers have choices and time to compare, so price and presentation decide which homes sell" : "a buyer’s market. Buyers have plenty of choices, so price, condition, and incentives matter more than ever";
      para(`With ${m.monthsSupply} months of supply, this is ${kind}. About ${m.concessionShare}% of recent sales included a seller concession (median ${usd(m.concessionMedian)}), and for every 10 homes that sold, about ${m.expiredPer10} listings expired or were withdrawn. Mortgage rates near ${m.rate}% mean buyers are watching their monthly payment closely.`, 10.5);
      if (sub.hood) { const nb = marketingPool().filter(l => l.hood === sub.hood && !l.exclusive); if (nb.length) { y += 4; para(`In ${sub.hood} right now: ${nb.filter(l => l.status === "Active").length} for sale, ${nb.filter(l => l.status === "Pending").length} under contract, median list price ${usd(median(nb.map(l => l.price)))}.`, 10.5); } }
      y += 4; para(`Source: ${m.source}.`, 8.5, gray);
    }

    /* ---------- Property summary ---------- */
    if (cm && on("summary")) {
      page("Property summary");
      doc.setFillColor(...mid); doc.rect(M, y, CW, 110, "F");
      await photo(subL && subL.photos && subL.photos[0], M, y, 170, 110);
      font("helvetica", "bold", 13, white); doc.text(wrap(sub.address, CW - 200)[0], M + 186, y + 30);
      const sv = [["Beds", sub.beds], ["Baths", sub.baths], ["Sq ft", Number(sub.sqft || 0).toLocaleString()], ["Lot", subL && subL.lot ? `${subL.lot} acres` : "-"]];
      sv.forEach(([k, v], i) => { font("helvetica", "normal", 8.5, lin); doc.text(k, M + 186 + i * 82, y + 64); font("times", "bold", 16, white); doc.text(t(String(v ?? "-")), M + 186 + i * 82, y + 84); }); y += 132;
      h2("Listing detail");
      const det = [["Property type", typeName(sub.type)], ["Year built", sub.year || "-"], ["Neighborhood", sub.hood], ["City", subL ? subL.city : "-"], ["MLS number", subL ? subL.mlsId : "-"], ["Status", subL ? subL.status : "Not yet listed"]];
      det.forEach(([k, v], i) => kv(M + (i % 3) * (CW / 3), y + Math.floor(i / 3) * 36, k, String(v), CW / 3)); y += 80;
      if (subL && subL.remarks) { h2("Description"); para(subL.remarks, 10); }
    }

    /* ---------- Comps: map + table ---------- */
    if (comps.length && on("comps")) {
      page("Comparable homes");
      const pts = comps.map((x, i) => ({ lat: x.l.lat, lng: x.l.lng, n: i + 1, c: STATUS_COLOR[x.l.status] || gray })).filter(p => p.lat && p.lng);
      const hc = typeof HOODS !== "undefined" ? HOODS.find(h => h[0] === sub.hood) : null;
      const sp = subL && subL.lat ? { lat: subL.lat, lng: subL.lng } : hc ? { lat: hc[1].lat, lng: hc[1].lng } : null;
      if (pts.length) {
        const all = sp ? [...pts, sp] : pts, mh = 250; let la0 = Math.min(...all.map(p => p.lat)), la1 = Math.max(...all.map(p => p.lat)), ln0 = Math.min(...all.map(p => p.lng)), ln1 = Math.max(...all.map(p => p.lng));
        const pa = Math.max((la1 - la0) * 0.15, 0.004), pn = Math.max((ln1 - ln0) * 0.15, 0.005); la0 -= pa; la1 += pa; ln0 -= pn; ln1 += pn;
        const X = v => M + (v - ln0) / (ln1 - ln0) * CW, Y = v => y + (la1 - v) / (la1 - la0) * mh;
        box(M, y, CW, mh); doc.setDrawColor(...line); doc.setLineWidth(0.4); for (let i = 1; i < 6; i++) { doc.line(M + CW * i / 6, y, M + CW * i / 6, y + mh); doc.line(M, y + mh * i / 6, M + CW, y + mh * i / 6); }
        if (sp) { doc.setFillColor(...gold); doc.circle(X(sp.lng), Y(sp.lat), 11, "F"); font("helvetica", "bold", 10, white); doc.text("S", X(sp.lng), Y(sp.lat) + 3.5, { align: "center" }); }
        pts.forEach(p => badge(X(p.lng), Y(p.lat), p.n, 9, p.c));
        y += mh + 12; font("helvetica", "normal", 8.5, gray); doc.text("S = subject property. Numbers match the table. Map is a simplified plot of locations.", M, y); y += 20;
      }
      const rows = [Object.assign(["S", sub.address, "Subject", subL ? usd(subL.price) : "-", String(sub.beds ?? "-"), String(sub.baths ?? "-"), Number(sub.sqft || 0).toLocaleString(), "-", "-"], { _bold: true, _mark: true })]
        .concat(comps.map((x, i) => [String(i + 1), x.l.address, x.l.status, usd(x.l.price), String(x.l.beds), String(x.l.baths), x.l.sqft.toLocaleString(), String(dom(x.l) ?? "-"), "$" + Math.round(x.l.price / x.l.sqft)]));
      table([["#", 20], ["Address", 168], ["Status", 66], ["Price", 70, "r"], ["Beds", 36, "r"], ["Baths", 38, "r"], ["Sq ft", 46, "r"], ["Days", 34, "r"], ["$/sq ft", 54, "r"]], rows, { title: "Comparable homes" });
    }

    /* ---------- Comp details ---------- */
    if (comps.length && on("compdetail")) {
      for (const [i, x] of comps.entries()) {
        const l = x.l; page("Listing overview");
        badge(M + 11, y - 4, i + 1, 11, STATUS_COLOR[l.status] || gray); font("helvetica", "bold", 13, mid); doc.text(t(l.address), M + 30, y); font("helvetica", "normal", 9.5, gray); doc.text(t(`${l.hood}, ${l.city}, ${l.state} ${l.zip}`), M + 30, y + 14); y += 30;
        await photo(l.photos && l.photos[0], M, y, 250, 170);
        const rx = M + 266; let ry = y + 6;
        font("times", "bold", 20, mid); doc.text(usd(l.price), rx, ry + 12); font("helvetica", "bold", 9, gold); doc.text(t(l.status), rx, ry + 28); ry += 44;
        [["Beds / baths", `${l.beds} / ${l.baths}`], ["Square feet", l.sqft.toLocaleString()], ["Year built", l.year], ["Lot", l.lot ? `${l.lot} acres` : "-"], ["Days on market", dom(l) ?? "-"], ["$ per sq ft", "$" + Math.round(l.price / l.sqft)]]
          .forEach(([k, v], j) => kv(rx + (j % 2) * 140, ry + Math.floor(j / 2) * 36, k, String(v), 136));
        y += 186;
        if (l.photos && l.photos.length > 1) { const ph = l.photos.slice(1, 7), w = (CW - 10) / 3; for (const [j, u] of ph.entries()) await photo(u, M + (j % 3) * (w + 5), y + Math.floor(j / 3) * 92, w, 86); y += Math.ceil(ph.length / 3) * 92 + 8; }
        if (l.remarks) { h2("Remarks"); para(l.remarks, 9.5); }
        y += 4; h2("Adjustments to match the subject");
        const adj = [...x.parts, ...(x.other ? [{ label: "Agent adjustment", amt: x.other }] : [])];
        if (adj.length) adj.forEach(p => { font("helvetica", "normal", 10, ink); doc.text(t(p.label), M, y); doc.text((p.amt > 0 ? "+" : "-") + usd(Math.abs(p.amt)), M + CW, y, { align: "right" }); y += 16; });
        else { para("No adjustments needed.", 10, gray); }
        doc.setDrawColor(...line); doc.line(M, y - 6, M + CW, y - 6); y += 8; font("helvetica", "bold", 11, mid); doc.text("Adjusted value", M, y); doc.text(usd(x.ap), M + CW, y, { align: "right" }); y += 18;
        font("helvetica", "normal", 8, gray); doc.text(t(`Listing courtesy of ${l.office || "the listing brokerage"}.${x.heavy ? " Needs large adjustments, so treat it as a less reliable indicator." : ""}`), M, y);
      }
    }

    /* ---------- Side by side ---------- */
    if (comps.length && on("sidebyside")) {
      for (let s = 0; s < comps.length; s += 4) {
        page("Side-by-side comparison");
        const group = comps.slice(s, s + 4), labelW = 110, colW = (CW - labelW) / (group.length + 1);
        const cols = [{ name: "Subject", l: subL, sub: true }, ...group.map((x, k) => ({ name: `${s + k + 1}. ${x.l.address}`, l: x.l, x }))];
        doc.setFillColor(...mid); doc.rect(M, y, CW, 34, "F");
        cols.forEach((c, k) => { font("helvetica", "bold", 8.5, c.sub ? gold : white); wrap(c.sub ? `Subject: ${sub.address}` : c.name, colW - 8).slice(0, 2).forEach((ln, j) => doc.text(ln, M + labelW + k * colW + 4, y + 14 + j * 11)); });
        y += 34;
        const val = (c, k) => { const l = c.l, x = c.x;
          switch (k) {
            case "Status": return c.sub ? (l ? l.status : "Subject") : l.status; case "MLS number": return l ? l.mlsId : "-"; case "Type": return typeName(c.sub ? sub.type : l.type);
            case "Bedrooms": return c.sub ? sub.beds : l.beds; case "Bathrooms": return c.sub ? sub.baths : l.baths; case "Square feet": return Number(c.sub ? sub.sqft : l.sqft).toLocaleString();
            case "Year built": return c.sub ? sub.year : l.year; case "Lot": return l && l.lot ? `${l.lot} ac` : "-"; case "Days on market": return l ? dom(l) ?? "-" : "-";
            case "List price": return l ? usd(l.price) : "-"; case "$ per sq ft": return l && l.sqft ? "$" + Math.round(l.price / l.sqft) : "-";
            case "Total adjustment": return c.sub ? "-" : (x.adj > 0 ? "+" : x.adj < 0 ? "-" : "") + usd(Math.abs(x.adj)); case "Adjusted value": return c.sub ? (r ? usd(r.value) : "-") : usd(x.ap);
          } };
        ["Status", "MLS number", "Type", "Bedrooms", "Bathrooms", "Square feet", "Year built", "Lot", "Days on market", "List price", "$ per sq ft", "Total adjustment", "Adjusted value"].forEach((k, i) => {
          if (i % 2 === 0) { doc.setFillColor(...lin); doc.rect(M, y, CW, 22, "F"); }
          font("helvetica", "bold", 8.8, mid); doc.text(k, M + 6, y + 14.5);
          cols.forEach((c, j) => { font("helvetica", k === "Adjusted value" ? "bold" : "normal", 9, ink); doc.text(wrap(String(val(c, k) ?? "-"), colW - 8)[0] || "-", M + labelW + j * colW + 4, y + 14.5); });
          y += 22;
        });
        y += 10; para("Subject’s adjusted value column shows the indicated value from this analysis.", 8.5, gray);
      }
    }

    /* ---------- Status + averages ---------- */
    if (comps.length && on("averages")) {
      page("Status comparison and averages");
      const groups = {}; comps.forEach((x, i) => (groups[x.l.status] = groups[x.l.status] || []).push([x, i]));
      Object.keys(groups).sort((a, b) => statusOrder(a) - statusOrder(b)).forEach(s => {
        ensure(60, "Status comparison and averages"); doc.setFillColor(...(STATUS_COLOR[s] || gray)); doc.rect(M, y - 10, 4, 14, "F"); font("helvetica", "bold", 11, mid); doc.text(t(`${s} (${groups[s].length})`), M + 10, y); y += 10;
        table([["#", 20], ["Address", 180], ["Beds", 40, "r"], ["Baths", 40, "r"], ["Sq ft", 56, "r"], ["$/sq ft", 60, "r"], ["Price", 76, "r"], ["Days", 50, "r"]], groups[s].map(([x, i]) => [String(i + 1), x.l.address, String(x.l.beds), String(x.l.baths), x.l.sqft.toLocaleString(), "$" + Math.round(x.l.price / x.l.sqft), usd(x.l.price), String(dom(x.l) ?? "-")]), { rh: 19, title: "Status comparison and averages" });
      });
      ensure(170, "Status comparison and averages"); h2("Averages across these comps");
      const prices = comps.map(x => x.l.price), avg = prices.reduce((a, b) => a + b, 0) / prices.length;
      const stats = [["Average", avg], ["Median", median(prices)], ["Low", Math.min(...prices)], ["High", Math.max(...prices)]], mx = Math.max(...prices);
      stats.forEach(([k, v]) => { font("helvetica", "normal", 10, ink); doc.text(k, M, y + 10); doc.setFillColor(...mid); doc.rect(M + 70, y, (CW - 160) * v / mx, 14, "F"); font("helvetica", "bold", 10, mid); doc.text(usd(v), M + 76 + (CW - 160) * v / mx, y + 11); y += 24; });
      y += 6; const avgOf = f => comps.reduce((a, x) => a + f(x.l), 0) / comps.length;
      [["Beds", avgOf(l => l.beds).toFixed(1)], ["Baths", avgOf(l => l.baths).toFixed(1)], ["Sq ft", Math.round(avgOf(l => l.sqft)).toLocaleString()], ["$ per sq ft", "$" + Math.round(avgOf(l => l.price / l.sqft))]].forEach(([k, v], i) => kv(M + i * (CW / 4), y, `Average ${k.toLowerCase()}`, v, CW / 4));
      y += 36;
    }

    /* ---------- Charts ---------- */
    if (comps.length >= 2 && on("charts")) {
      const withDom = comps.filter(x => dom(x.l) != null);
      if (withDom.length >= 2) { page("Price and days on market"); scatter("", withDom.map(x => dom(x.l)), withDom.map(x => x.l.price), withDom.map(x => STATUS_COLOR[x.l.status] || gray), "Days on market", v => String(Math.round(v)), { note: f => f.b < 0 ? "Homes priced higher here have sat longer, a sign buyers are resisting price." : "Here, time on market hasn’t tracked price closely. Condition and location matter too." }); }
      page("Price and size");
      const sq = comps.map(x => x.l.sqft), pz = comps.map(x => x.l.price);
      scatter("", sq, pz, comps.map(x => STATUS_COLOR[x.l.status] || gray), "Square feet", v => Math.round(v).toLocaleString(), { vLine: sub.sqft, vLabel: `This home: ${Number(sub.sqft).toLocaleString()} sq ft`, note: f => `At this home’s size, the trend line points to about ${usd(f.a + f.b * sub.sqft)}. Size is only one factor, which is why each comp is adjusted.` });
    }

    /* ---------- Pricing analysis ---------- */
    if (r && r.value && on("pricing")) {
      page("Pricing analysis");
      doc.setFillColor(...mid); doc.rect(M, y, CW, 150, "F");
      await photo(subL && subL.photos && subL.photos[0], M, y, 200, 150);
      font("helvetica", "normal", 11, lin); doc.text("Suggested list price range", M + 222, y + 44);
      font("times", "bold", 28, white); doc.text(t(`${usd(r.low)} - ${usd(r.high)}`), M + 222, y + 80);
      font("helvetica", "bold", 11, gold); doc.text(t(`Approximate market value ${usd(r.value)}`), M + 222, y + 108); y += 172;
      const prices = comps.map(x => x.l.price), avgPpsf = comps.reduce((a, x) => a + x.l.price / x.l.sqft, 0) / comps.length;
      const line2 = (k, v, bold) => { font("helvetica", bold ? "bold" : "normal", 10.5, bold ? mid : ink); doc.text(t(k), M, y); doc.text(t(v), M + CW, y, { align: "right" }); y += 8; doc.setDrawColor(...line); doc.setLineWidth(0.4); doc.line(M, y, M + CW, y); y += 14; };
      h2("Based on adjusted comps (recommended)"); line2("Median adjusted value of comparable homes", usd(r.value), true); line2("Middle half of adjusted values (suggested range)", `${usd(r.low)} - ${usd(r.high)}`);
      y += 6; h2("Based on average price"); line2(`Average price of ${comps.length} comparable homes`, usd(prices.reduce((a, b) => a + b, 0) / prices.length));
      y += 6; h2("Based on price per square foot"); line2("Average $ per sq ft of comparable homes", "$" + avgPpsf.toFixed(2)); line2("Square feet of this home", Number(sub.sqft).toLocaleString()); line2("Price at average $ per sq ft", usd(avgPpsf * sub.sqft), true);
      y += 6; para("The adjusted comp method accounts for differences in size, bedrooms, bathrooms, age, and listing status, so it’s the basis for the recommendation. The other two methods are shown for context. This is a broker’s opinion of value, not an appraisal.", 9, gray);
    }

    /* ---------- Pricing strategy ---------- */
    if (on("strategy")) {
      page("Pricing strategy");
      para("Buyers compare your home with everything else for sale. Price it right and it competes from day one. Price it high and it helps sell the homes around it, while days on market add up and buyers start asking what’s wrong.", 10.5); y += 6;
      h2("Who sees your home, by list price");
      [["10% below market value", 0.95], ["At market value", 0.8], ["5% above", 0.5], ["10% above", 0.3], ["15% above", 0.15]].forEach(([lab, v], i) => { font("helvetica", "normal", 10, ink); doc.text(lab, M, y + 10); doc.setFillColor(...(i === 1 ? gold : [206, 196, 178])); doc.rect(M + 150, y, (CW - 160) * v, 14, "F"); y += 24; });
      para("Illustration of a common pattern, not a measurement: as price rises above value, fewer buyers search, tour, and offer.", 8.5, gray); y += 8;
      box(M, y, CW, 56); font("times", "bold", 20, mid); doc.text(`${m.expiredPer10} of every 10`, M + 14, y + 34); font("helvetica", "normal", 10, ink); doc.text(wrap(`For every 10 homes that sold in ${m.asOf}, about ${m.expiredPer10} listings expired or were withdrawn without selling. Price is usually why.`, CW - 190), M + 176, y + 22); y += 76;
      h2("Five things that decide your sale");
      [["Location", "Fixed. It sets the baseline for value."], ["Condition", "Partly yours. Small fixes and good presentation pay off."], ["Market", "Out of our hands, so we read it carefully."], ["Terms", "Flexible terms can widen your buyer pool."], ["Price", "Yours to set, and the one that matters most."]].forEach(([a, b], i) => { badge(M + 9, y - 4, i + 1, 9); font("helvetica", "bold", 10.5, mid); doc.text(a, M + 26, y); font("helvetica", "normal", 10.5, ink); doc.text(t(b), M + 104, y); y += 21; });
    }

    /* ---------- Net proceeds: three scenarios ---------- */
    const base = netCalc(pr);
    if (on("net") && base.price) {
      page("Estimated net proceeds");
      const scen = r && r.value ? [["Low end of range", r.low], ["Suggested price", num(pr.net.price) || r.value], ["High end of range", r.high]] : [["Estimated sale price", base.price]];
      const calcs = scen.map(([lab, p]) => ({ lab, ...netCalc({ ...pr, net: { ...pr.net, price: p } }) }));
      const w = (CW - (calcs.length - 1) * 10) / calcs.length;
      calcs.forEach((c, i) => { const x = M + i * (w + 10), hi = calcs.length > 1 && i === 1; box(x, y, w, 96, hi ? mid : lin); font("helvetica", "normal", 9, hi ? gold : gray); doc.text(t(c.lab), x + 12, y + 20); font("helvetica", "normal", 9.5, hi ? lin : ink); doc.text(t(`Sale price ${usd(c.price)}`), x + 12, y + 38); doc.text(t(`Costs (${usd(c.costs)})`), x + 12, y + 54); font("times", "bold", 20, hi ? white : mid); doc.text(usd(c.net), x + 12, y + 82); });
      y += 116;
      h2("Cost breakdown (at suggested price)");
      const mid2 = calcs[Math.min(1, calcs.length - 1)], groups = [["Mortgage payoff", ["Mortgage payoff"]], ["Real estate fees", ["Listing brokerage fee", "Buyer’s agent compensation (if offered)"]], ["Settlement costs", ["Owner’s title insurance", "Closing fee (your share)", "Property taxes, prorated"]], ["Other costs", ["HOA status letter and transfer fees", "Seller concessions", "Repairs and preparation", "Other"]]];
      groups.forEach(([g, labs]) => { const items = mid2.items.filter(x => labs.includes(x[0]) && (x[1] || /negotiable/i.test(x[2]))); if (!items.length) return; font("helvetica", "bold", 10, mid); doc.text(g, M, y); y += 16; items.forEach(([lab, v, note]) => { font("helvetica", "normal", 10, ink); doc.text(t(lab), M + 10, y); doc.text(v ? `(${usd(v)})` : "-", M + CW, y, { align: "right" }); if (note) { font("helvetica", "normal", 8, gray); doc.text(wrap(note, CW - 160)[0], M + 20, y + 11); y += 11; } y += 17; }); y += 4; });
      doc.setDrawColor(...line); doc.line(M, y - 6, M + CW, y - 6); y += 8; font("helvetica", "bold", 11, mid); doc.text("Estimated net proceeds", M, y); doc.text(usd(mid2.net), M + CW, y, { align: "right" }); y += 22;
      para("Estimates for planning. Your title company prepares the actual settlement statement. Brokerage fees and any compensation to a buyer’s agent are negotiable and set in writing.", 8.5, gray);
    }

    /* ---------- Prep ---------- */
    if (on("prep")) {
      page("Getting your home ready");
      para("Buyers expect a lived-in home, but the brighter and simpler it looks, the easier it is for them to picture it as theirs. Most of what helps costs little.", 10.5); y += 6;
      const colW = (CW - 24) / 2, sy = y;
      const block = (x, title, items) => { let yy = sy; font("helvetica", "bold", 12, mid); doc.text(title, x, yy); yy += 20; items.forEach(it => { doc.setDrawColor(...gold); doc.setLineWidth(1.2); doc.rect(x, yy - 9, 10, 10); font("helvetica", "normal", 10, ink); wrap(it, colW - 20).forEach(l => { doc.text(l, x + 18, yy); yy += 13.5; }); yy += 5; }); return yy; };
      const a = block(M, "Before photos", ["Walk through room by room with a notepad", "Patch, touch up, and paint where needed", "Fix leaky faucets, sticky doors, and dead bulbs", "Deep clean kitchens and bathrooms", "Clear counters, shelves, closets, and the garage", "Box up personal photos and collections", "Refresh the entry: door, house numbers, mat, plants", "Trim landscaping and clean windows"]);
      const b = block(M + colW + 24, "Before each showing", ["Open blinds and turn on every light", "Set a comfortable temperature", "Put away pet items, dishes, and laundry", "Take out trash and recycling", "Secure valuables and medications", "Plan to be away during showings", "Leave notes on recent upgrades"]);
      y = Math.max(a, b) + 8; box(M, y, CW, 44); font("helvetica", "normal", 10, ink); doc.text(wrap("Colorado sellers also complete a Seller’s Property Disclosure and other required disclosures. I’ll walk you through each one.", CW - 28), M + 14, y + 19);
    }

    /* ---------- Marketing ---------- */
    if (on("marketing")) {
      page("Marketing plan");
      para("Most buyers start online, many work with agents, and neighbors often know the next buyer. Your plan reaches all three.", 10.5); y += 6;
      const items = MARKETING.filter(mk => (pr.marketing || []).includes(mk[0])), colW = (CW - 14) / 2;
      items.forEach((mk, i) => { const x = M + (i % 2) * (colW + 14), top = y + Math.floor(i / 2) * 70; box(x, top, colW, 62, white); doc.setFillColor(...gold); doc.circle(x + 16, top + 19, 5, "F"); font("helvetica", "bold", 10.5, mid); doc.text(t(mk[1]), x + 28, top + 23); font("helvetica", "normal", 9, ink); wrap(mk[2], colW - 38).slice(0, 2).forEach((l, k) => doc.text(l, x + 28, top + 39 + k * 12)); });
      y += Math.ceil(items.length / 2) * 70;
    }

    /* ---------- Process ---------- */
    if (on("process")) {
      page("The selling process");
      const steps = [["Plan and price", "Review the analysis, choose a price and timing, and sign the listing agreement."], ["Prepare", "Repairs, cleaning, staging, and required disclosures."], ["Launch", "Photos, video, and listing go live, with alerts to matching buyers and agents."], ["Show and adjust", "Showings and open houses with weekly feedback. We revisit price if the market says to."], ["Review offers", "Compare price, financing, earnest money, deadlines, and contingencies. Accept, counter, or decline."], ["Under contract", "Track the Colorado contract dates: inspection, title, appraisal, and loan conditions."], ["Close", "Sign at the title company, get paid, and hand over the keys."], ["After the sale", "Help with your move, your next home, and anything that comes up."]];
      const x = M + 14; doc.setDrawColor(...gold); doc.setLineWidth(1.5); doc.line(x, y, x, y + (steps.length - 1) * 70);
      steps.forEach(([a, b], i) => { const yy = y + i * 70; badge(x, yy, i + 1, 12, i % 2 ? mid : gold); font("helvetica", "bold", 11.5, mid); doc.text(a, x + 26, yy + 4); font("helvetica", "normal", 10, ink); wrap(b, CW - 50).forEach((l, k) => doc.text(l, x + 26, yy + 20 + k * 13)); });
      y += steps.length * 70;
    }

    /* ---------- Offers ---------- */
    if (on("offers")) {
      page("Incentives, offers, and negotiation");
      h2("Incentives that help a home stand out");
      [`Seller concessions: about ${m.concessionShare}% of recent sales included one (median ${usd(m.concessionMedian)}), often used for closing costs or a rate buydown.`, "A one-year home warranty for peace of mind on an older home.", "A pre-listing inspection, so buyers see issues up front.", "Including appliances or other items buyers ask about.", "Offering compensation to the buyer’s agent is optional and negotiable. We decide together, and it’s set in writing."]
        .forEach(s => { doc.setFillColor(...gold); doc.circle(M + 4, y - 3.5, 2.8, "F"); font("helvetica", "normal", 10.5, ink); wrap(s, CW - 16).forEach(l => { doc.text(l, M + 14, y); y += 14.5; }); y += 4; });
      y += 8; h2("How we compare offers");
      table([["Factor", 130], ["What we look at", CW - 130]], [["Price", "And any concessions requested"], ["Financing", "Cash, conventional, FHA, or VA, and the lender’s strength"], ["Earnest money", "How much the buyer puts at risk"], ["Deadlines", "Inspection, appraisal, loan, and closing dates"], ["Contingencies", "Appraisal gap, sale of the buyer’s home, and more"], ["Possession", "When you move out, and whether you need time after closing"]], { title: "Incentives, offers, and negotiation" });
      para("When an offer arrives you can accept it, decline it, or counter. In Colorado a counterproposal replaces the original offer, so we only change what matters to you. Once you’re under contract, I track every deadline through closing.", 10.5);
    }

    /* ---------- Questions ---------- */
    if (on("questions")) {
      page("Questions to ask any agent");
      const s = prof.presStats;
      [["How long have you been selling homes?", s.years ? `Since ${s.years}.` : ""], ["How many homes have you sold?", s.homes ? `${s.homes}.` : ""], ["How long do your listings take to sell?", s.avgDom ? `A median of ${s.avgDom} days on market.` : ""], ["How close to list price do your listings sell?", s.listToSale ? `${s.listToSale}% of list price.` : ""], ["How will you market my home?", "See the marketing plan, built for your home."], ["How will you keep me informed?", "Weekly updates with showing feedback and online activity, and I’m reachable by call or text."], ["How do you handle negotiation?", "I compare every offer on price, terms, and certainty, and we decide on each counter together."], ["What are your fees?", "They’re negotiable, and we agree on them in writing before we start."]]
        .filter(([, a]) => a).forEach(([q, a], i) => { ensure(48, "Questions to ask any agent"); badge(M + 9, y - 4, i + 1, 9); font("helvetica", "bold", 10.5, mid); doc.text(t(q), M + 26, y); y += 15; if (a) { font("helvetica", "normal", 10.5, ink); wrap(a, CW - 30).forEach(l => { doc.text(l, M + 26, y); y += 13.5; }); } y += 10; });
    }

    /* ---------- Next steps ---------- */
    page("Next steps");
    [["Choose a list price and launch date", "Using the analysis and today’s market."], ["Sign the listing agreement and disclosures", "Including the brokerage relationship disclosure Colorado requires."], ["Prepare the home", "Photos are scheduled once it’s ready."], ["Go live", "And start bringing in buyers."]].forEach(([a, b], i) => { badge(M + 11, y - 4, i + 1, 11); font("helvetica", "bold", 11.5, mid); doc.text(t(a), M + 30, y); font("helvetica", "normal", 10.5, ink); doc.text(t(b), M + 30, y + 15); y += 44; });
    y += 8; doc.setFillColor(...mid); doc.roundedRect(M, y, CW, 90, 6, 6, "F"); font("times", "bold", 20, gold); doc.text(t(agent.name), M + 20, y + 32); font("helvetica", "normal", 10.5, lin); doc.text(t(agent.firm), M + 20, y + 52); doc.text(t([agent.phone, agent.email].filter(Boolean).join("   |   ")), M + 20, y + 70); y += 112;
    para("Brokerage fees and any compensation to a buyer’s agent are not set by law and are fully negotiable. Market figures come from the source named on the market page. Values in this presentation are a broker’s opinion, not an appraisal. Equal Housing Opportunity.", 8.5, gray);

    // Footers
    const pages = doc.getNumberOfPages();
    for (let p = 2; p <= pages; p++) {
      doc.setPage(p); doc.setFillColor(...mid); doc.rect(0, H - 34, W, 34, "F");
      font("helvetica", "normal", 8.5, lin); doc.text(t(`${agent.name}  |  ${agent.phone}${agent.email ? "  |  " + agent.email : ""}`), M, H - 14);
      doc.text(`${p} / ${pages}`, W - M, H - 14, { align: "right" });
      font("helvetica", "normal", 7, gray); doc.text(t(`All information deemed reliable but not guaranteed and should be independently verified.${C.LICENSE_TEXT && !/\[add/i.test(C.LICENSE_TEXT) ? "  " + C.LICENSE_TEXT : ""}`), W / 2, H - 40, { align: "center" });
    }
    const name = `Listing_Presentation_${(pr.address || sub.address || "Home").replace(/[^\w]+/g, "_").replace(/^_|_$/g, "")}.pdf`;
    return { blob: doc.output("blob"), name, doc };
  }
  P.buildPDF = buildPDF;

  /* ---------- Events ---------- */
  document.addEventListener("click", async e => {
    const b = e.target.closest("[data-pr-new],[data-pr-pdf],[data-pr-del],[data-pr-market],[data-pr-for]"); if (!b) return; const d = b.dataset;
    if (d.prNew !== undefined) P.create({});
    else if (d.prFor !== undefined) { const [kind, id] = d.prFor.split("|"); P.create(kind === "cma" ? { cmaId: id } : { contactId: id }); }
    else if (d.prMarket !== undefined) P.openMarket();
    else if (d.prDel !== undefined) { if (confirm("Delete this presentation?")) { Store.saveCrm("presentations", d.prDel, null); agentPanel = "presentations"; renderAgent(); } }
    else if (d.prPdf !== undefined) {
      const msg = $("#prMsg"); if (msg) msg.textContent = "Making the PDF…";
      try { const { blob, name } = await buildPDF(d.prPdf); await CMAReport.savePDF(blob, name); if (msg) msg.textContent = "PDF ready."; }
      catch (err) { if (msg) msg.textContent = err.message || "The PDF didn’t generate. Try again."; }
    }
  });
  document.addEventListener("change", e => {
    const d = e.target.dataset || {};
    if (d.prF) { const [id, k] = d.prF.split("|"); edit(id, x => { x[k] = e.target.value.trim(); if (k === "contactId") { const c = Store.crm.contacts[x.contactId]; if (c && !x.preparedFor) x.preparedFor = c.name; } if (k === "cmaId") { const cm = Store.crm.cmas[x.cmaId]; if (cm) { if (!x.address) x.address = cm.subject.address; const r = cmaCalc(cm); if (r.value) x.net = { ...(x.net || {}), price: r.value }; } } }); }
    else if (d.prNet) { const [id, k] = d.prNet.split("|"); edit(id, x => { x.net = { ...(x.net || {}), [k]: e.target.value.trim() }; }); }
    else if (d.prMk) { const [id, k] = d.prMk.split("|"); edit(id, x => { const s = new Set(x.marketing || []); e.target.checked ? s.add(k) : s.delete(k); x.marketing = MARKETING.map(m => m[0]).filter(m => s.has(m)); }); }
    else if (d.prSec) { const [id, k] = d.prSec.split("|"); edit(id, x => { x.sections = { ...(x.sections || {}), [k]: e.target.checked }; }); }
  });
  P._t = { netCalc, market, MARKET_DEFAULT, profile, SECTIONS, MARKETING };
})();
