/* =========================================================================
   The Miller Group — Buyer presentation kit.
   Client-facing PDF for the buyer consultation, built from the 2026 Road to
   Closed training guide (financing, buyer representation, offers, contract
   deadlines, inspections, appraisal, title, closing), plus an agent-only
   appointment checklist. Saved at agent/<uid>/crm/buyerpres.
   ========================================================================= */
(function () {
  const BP = window.BuyerPresentation = {};
  const C = window.MG_CONFIG || {};
  const num = v => { const n = parseFloat(String(v ?? "").replace(/[$,%\s]/g, "")); return isFinite(n) ? n : 0; };
  const usd = n => "$" + Math.round(n).toLocaleString("en-US");
  const list = () => Object.entries(Store.crm.buyerpres || {}).filter(([, x]) => x).map(([id, x]) => ({ id, ...x })).sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  const market = () => window.Presentation ? Presentation._t.market() : {};
  const profile = () => window.Presentation ? Presentation._t.profile() : { presStats: {}, presPledge: [], testimonials: [] };
  const partnersBy = cats => Object.values((window.Office && Office.partners) || {}).filter(p => p && cats.includes(p.category)).sort((a, b) => (a.company || a.name || "").localeCompare(b.company || b.name || ""));

  // Agent-only checklist from the training guide (Part 2: The Buyer Consultation).
  const CHECKLIST = [
    ["Before any confidential discussion (C.R.S. 12-10-408)", [["dwr", "Definitions of Working Relationships / Broker Disclosure to Buyer signed"], ["aba", "Affiliated Business Arrangement Disclosure signed"]]],
    ["Secure the client", [["ertb", "Exclusive Right-to-Buy Contract signed"], ["mold", "Mold Disclosure"], ["wire", "Wire Fraud Disclosure"], ["radon", "Radon and Real Estate Transactions pamphlet"], ["lbp", "Lead-Based Paint disclosure (if applicable)"]]],
    ["Buyer packet", [["pk_pres", "This buyer presentation"], ["pk_time", "Transaction timeline"], ["pk_rules", "Showing, inspection, and appraisal rules"], ["pk_sample", "Blank sample Exclusive Right-to-Buy Contract"], ["pk_lend", "3+ lenders, alphabetical"], ["pk_insp", "3+ inspectors, alphabetical"], ["pk_warr", "3+ home warranty companies, alphabetical"]]],
    ["Prepare the buyer", [["pre", "Pre-approval status and conditions confirmed with lender"], ["hoa", "Budget confirmed, including HOA dues"], ["pof", "Proof of funds for large cash down payment"], ["mls", "MLS portal search set up with must-haves vs. negotiables"]]]
  ];

  BP.create = function (opts = {}) {
    const c = opts.contactId ? Store.crm.contacts[opts.contactId] : null;
    const m = market();
    const rec = { contactId: c ? c.id : "", preparedFor: c ? c.name : "", price: c ? parseMoney(c.budget) || "" : "", areas: c ? c.area || "" : "", downPct: 5, rate: m.rate || 7, hoa: "", earnestPct: 1, closingPct: 3,
      loans: ["fha", "conv", "va", "usda"], dpa: true, kit: {}, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const id = Store.saveCrm("buyerpres", null, rec);
    agentPanel = "buyerpres:" + id; if (location.hash !== "#agent") location.hash = "agent"; else renderAgent(); window.scrollTo(0, 0);
    return id;
  };
  const edit = (id, fn) => { const x = structuredClone(Store.crm.buyerpres[id]); if (!x) return; fn(x); x.updatedAt = new Date().toISOString(); Store.saveCrm("buyerpres", id, x); };
  const monthly = (price, downPct, rate, hoa) => payment(price, downPct, rate) + num(hoa);

  BP.listHTML = function () {
    const ps = list();
    return `<p class="addr">A branded PDF for buyer consultations, based on The Miller Group Road to Closed training: financing, assistance programs, the buying process, offers, contract deadlines, inspections, and closing.</p>
      <div class="quick"><button class="btn gold" data-bp-new>New buyer presentation</button><button class="btn ghost" data-panel="pres-profile">My presentation profile</button></div>` +
      (ps.length ? ps.map(p => `<div class="pcard"><div class="pcard-top"><div><strong>${esc(p.preparedFor || "Untitled buyer presentation")}</strong><p>${p.price ? "Around " + short(num(p.price)) + " · " : ""}${p.areas ? esc(p.areas) + " · " : ""}${when(p.updatedAt)}</p></div></div><div class="links"><button data-panel="buyerpres:${p.id}">Open</button></div></div>`).join("")
        : `<div class="empty"><strong>No buyer presentations yet</strong>Start one here or from a buyer in your pipeline.</div>`);
  };
  BP.html = function (id) {
    const b = Store.crm.buyerpres[id], back = `<button class="back" data-panel="buyerpres">‹ Buyer presentations</button>`;
    if (!b) return back + `<div class="empty"><strong>Presentation not found</strong>It may have been deleted.</div>`;
    const price = num(b.price), done = CHECKLIST.flatMap(g => g[1]).filter(([k]) => (b.kit || {})[k]).length, total = CHECKLIST.flatMap(g => g[1]).length;
    const f = (k, label, ph = "") => `<div><label for="bp_${k}">${label}</label><input id="bp_${k}" data-bp-f="${id}|${k}" placeholder="${esc(ph)}" value="${esc(b[k] ?? "")}"></div>`;
    const lenders = partnersBy(["Lender"]).length, insp = partnersBy(["Inspector"]).length, warr = partnersBy(["Home warranty"]).length;
    return `${back}<div class="colhead"><h2>${esc(b.preparedFor || "Buyer presentation")}</h2><button class="btn ghost" data-bp-del="${id}">Delete</button></div>
      <div class="tourform"><div class="row2"><div><label for="bpContact">Buyer</label><select id="bpContact" data-bp-f="${id}|contactId"><option value="">None</option>${contacts().filter(isBuyer).map(c => `<option value="${esc(c.id)}" ${c.id === b.contactId ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></div>${f("preparedFor", "Prepared for")}</div>
        <div class="row2">${f("price", "Target price", "$550,000")}${f("areas", "Areas", "Aurora, Centennial")}</div>
        <div class="row2">${f("downPct", "Down payment (%)", "5")}${f("rate", "Interest rate (%)", "7")}</div>
        <div class="row2">${f("hoa", "HOA dues per month", "$0")}${f("earnestPct", "Earnest money (% of price)", "1")}</div>
        <div class="row2">${f("closingPct", "Closing costs estimate (%)", "3")}<div><label for="bpDpa">Include assistance programs</label><select id="bpDpa" data-bp-f="${id}|dpa"><option value="true" ${b.dpa !== false && b.dpa !== "false" ? "selected" : ""}>Yes</option><option value="false" ${b.dpa === false || b.dpa === "false" ? "selected" : ""}>No</option></select></div></div></div>
      <div class="cmares"><p>Estimated monthly payment at ${price ? short(price) : "the target price"}</p><b>${price ? usd(monthly(price, num(b.downPct), num(b.rate), b.hoa)) : "Add a target price"}</b><p>Principal, interest, estimated taxes and insurance${num(b.hoa) ? ", and HOA" : ""}. The lender confirms the real numbers.</p>
        <div class="quick" style="margin:10px 0 0"><button class="btn gold" data-bp-pdf="${id}">Download buyer presentation (PDF)</button><button class="btn ghost" data-wr-for="buyer|contact|${esc(b.contactId || "")}">Talk track</button></div><p class="msg" id="bpMsg" role="status"></p></div>
      ${lenders < 3 || insp < 3 || warr < 3 ? `<p class="note-c">Your training guide calls for at least three lenders, inspectors, and home warranty companies. Preferred partners has ${lenders}, ${insp}, and ${warr}. <button class="remove" data-panel="o-partners">Add partners</button></p>` : ""}
      <h3 class="agent-h">Loan types to cover</h3><div class="complist">${[["fha", "FHA"], ["conv", "Conventional"], ["va", "VA"], ["usda", "USDA"], ["jumbo", "Jumbo"], ["arm", "Adjustable-rate (ARM)"]].map(([k, t]) => `<label><input type="checkbox" data-bp-loan="${id}|${k}" ${(b.loans || []).includes(k) ? "checked" : ""}><span>${t}</span></label>`).join("")}</div>
      <h3 class="agent-h">Appointment checklist <span class="addr">${done} of ${total}</span></h3><p class="addr">For you, not the buyer. From the Road to Closed training guide.</p>
      ${CHECKLIST.map(([g, items], gi) => `<div class="stage-h">${esc(g)}</div>${items.map(([k, t]) => `<label class="task ${(b.kit || {})[k] ? "done" : ""}"><input type="checkbox" data-bp-kit="${id}|${k}" ${(b.kit || {})[k] ? "checked" : ""}><span class="tt"><span>${esc(t)}</span></span></label>`).join("")}${gi === 0 ? `<p class="note-c">Colorado requires these before you elicit or discuss any confidential information.</p>` : ""}`).join("")}`;
  };

  /* ============================== PDF ============================== */
  async function buildPDF(id) {
    const jsPDF = await CMAReport.loadPdfLib();
    const b = Store.crm.buyerpres[id], Bc = CMAReport.brand, t = CMAReport.clean, m = market(), prof = profile();
    const agent = { name: IDX.BROKER.name, phone: IDX.BROKER.phone, email: IDX.BROKER.email || "", firm: IDX.BROKER.firm || "The Miller Group", first: String(IDX.BROKER.name || "").split(" ")[0], title: prof.title || "Broker" };
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const W = 612, H = 792, M = 40, CW = W - M * 2, gold = Bc.gold, mid = Bc.midnight, lin = Bc.linen, gray = Bc.gray, ink = Bc.ink, line = Bc.line, white = [255, 255, 255];
    let y = 0, pageNo = 0;
    const font = (f, st, sz, col) => { doc.setFont(f, st); doc.setFontSize(sz); doc.setTextColor(...(col || ink)); };
    const wrap = (s, w) => doc.splitTextToSize(t(s), w);
    const para = (s, sz = 10.5, col = ink, w = CW, x = M, lh = 1.5) => { font("helvetica", "normal", sz, col); wrap(s, w).forEach(l => { ensure(sz * lh); doc.text(l, x, y); y += sz * lh; }); };
    let curTitle = "";
    const page = title => { if (pageNo) doc.addPage(); pageNo++; curTitle = title; doc.setFillColor(...mid); doc.rect(0, 0, W, 52, "F"); doc.setFillColor(...gold); doc.rect(0, 52, W, 2, "F"); font("times", "bold", 15, gold); doc.text(t(agent.firm), M, 32); font("helvetica", "bold", 14, white); doc.text(t(title), W - M, 32, { align: "right" }); y = 84; };
    function ensure(h) { if (y + h > H - 70) page(curTitle); }
    const h2 = s => { if (y > 100) y += 8; ensure(40); font("helvetica", "bold", 12, mid); doc.text(t(s), M, y); y += 6; doc.setDrawColor(...gold); doc.setLineWidth(1.2); doc.line(M, y, M + 30, y); y += 16; };
    const badge = (x, yy, n, r = 10, fill = gold) => { doc.setFillColor(...fill); doc.circle(x, yy, r, "F"); font("helvetica", "bold", r * 0.95, white); doc.text(String(n), x, yy + r * 0.34, { align: "center" }); };
    const box = (x, yy, w, h, fill = lin) => { doc.setFillColor(...fill); doc.setDrawColor(...line); doc.setLineWidth(0.5); doc.roundedRect(x, yy, w, h, 4, 4, "FD"); };
    const bullets = (items, sz = 10.2) => items.forEach(s => { font("helvetica", "normal", sz, ink); const ls = wrap(s, CW - 16); ensure(ls.length * 14 + 4); doc.setFillColor(...gold); doc.circle(M + 4, y - 3.5, 2.6, "F"); ls.forEach(l => { doc.text(l, M + 14, y); y += 14; }); y += 3; });
    const card = (x, yy, w, h, title, lines, tag) => { box(x, yy, w, h, white); doc.setFillColor(...gold); doc.rect(x, yy, w, 3, "F"); font("helvetica", "bold", 11.5, mid); doc.text(t(title), x + 12, yy + 22); if (tag) { font("helvetica", "bold", 8, gold); doc.text(t(tag), x + w - 12, yy + 22, { align: "right" }); } let ly = yy + 40; lines.forEach(s => { font("helvetica", "normal", 9, ink); wrap(s, w - 30).forEach((l, k) => { if (ly < yy + h - 8) { if (k === 0) { doc.setFillColor(...gold); doc.circle(x + 15, ly - 3, 2, "F"); } doc.text(l, x + 22, ly); } ly += 12; }); ly += 2; }); };
    const table = (cols, rows) => { font("helvetica", "bold", 8.8, white); doc.setFillColor(...mid); doc.rect(M, y, CW, 20, "F"); let x = M + 8; cols.forEach(([h, w, a]) => { doc.text(t(h), a === "r" ? x + w - 12 : x, y + 13.5, a === "r" ? { align: "right" } : undefined); x += w; }); y += 20;
      rows.forEach((row, i) => { const hts = row.map((v, k) => wrap(v, cols[k][1] - 12).length), rh = Math.max(20, Math.max(...hts) * 12 + 8); ensure(rh); if (i % 2 === 0) { doc.setFillColor(...lin); doc.rect(M, y, CW, rh, "F"); } x = M + 8; row.forEach((v, k) => { const [, w, a] = cols[k]; font("helvetica", k === 0 ? "bold" : "normal", 9, k === 0 ? mid : ink); wrap(v, w - 12).forEach((l, j) => doc.text(l, a === "r" ? x + w - 12 : x, y + 13.5 + j * 12, a === "r" ? { align: "right" } : undefined)); x += w; }); y += rh; }); y += 10; };

    const price = num(b.price), dp = num(b.downPct), rate = num(b.rate) || m.rate || 7, hoa = num(b.hoa);

    /* Cover */
    pageNo = 1; doc.setFillColor(...mid); doc.rect(0, 0, W, H, "F");
    doc.setDrawColor(...gold); doc.setLineWidth(1.6); const pts = [[0, 0], [70, -38], [110, -16], [175, -72], [230, -30], [270, -52], [330, -8], [395, -64], [450, -22], [500, -46], [560, -12], [612, -30]]; for (let i = 1; i < pts.length; i++) doc.line(pts[i - 1][0], 470 + pts[i - 1][1], pts[i][0], 470 + pts[i][1]);
    // a roofline over the mountains
    doc.setLineWidth(2.2); doc.line(250, 430, 306, 384); doc.line(306, 384, 362, 430);
    font("times", "bold", 18, gold); doc.text(t(agent.firm), M, 56); font("helvetica", "normal", 12, lin); doc.text("Buyer presentation", W - M, 56, { align: "right" });
    font("times", "bold", 40, white); doc.text("Your road to closed", M, 560);
    font("helvetica", "normal", 13, lin); doc.text(t([b.preparedFor ? `Prepared for ${b.preparedFor}` : "", new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })].filter(Boolean).join("   |   ")), M, 590);
    if (b.areas) { font("helvetica", "normal", 11, gold); doc.text(t(`Searching: ${b.areas}${price ? `  |  around ${usd(price)}` : ""}`), M, 612); }
    doc.setFillColor(...white); doc.roundedRect(M, 668, 300, 84, 6, 6, "F"); doc.setFillColor(...gold); doc.circle(M + 42, 710, 30, "F"); font("times", "bold", 22, white); doc.text(t(agent.name.split(" ").map(s => s[0]).join("").slice(0, 2)), M + 42, 718, { align: "center" });
    font("helvetica", "bold", 12, mid); doc.text(t(agent.name), M + 86, 696); font("helvetica", "normal", 9.5, gray); doc.text(t(agent.title), M + 86, 710); doc.text(t(agent.phone), M + 86, 723); doc.text(t(agent.email), M + 86, 736);

    /* Agent */
    page("Your agent");
    font("times", "bold", 22, mid); doc.text(t(agent.name), M, y + 6); font("helvetica", "normal", 10, gray); doc.text(t([agent.title, agent.firm, agent.phone, agent.email].filter(Boolean).join("  |  ")), M, y + 24); y += 46;
    para(prof.presBio || "", 10.5); y += 4;
    const s = prof.presStats || {}, st = [[s.years ? `Since ${s.years}` : "", "In real estate"], [s.homes, "Homes sold"], [s.areas, "Areas I know best"]].filter(x => x[0]);
    if (st.length) { const w = (CW - (st.length - 1) * 8) / st.length; st.forEach((x, i) => { box(M + i * (w + 8), y, w, 56); font("times", "bold", 15, mid); doc.text(wrap(x[0], w - 20)[0], M + i * (w + 8) + 10, y + 24); font("helvetica", "normal", 8.5, gray); doc.text(t(x[1]), M + i * (w + 8) + 10, y + 42); }); y += 72; }
    h2("My promise to you"); bullets(prof.presPledge || []);
    if ((prof.testimonials || []).length) { y += 6; h2("What clients say"); prof.testimonials.slice(0, 2).forEach(q => { font("times", "italic", 11, ink); const ls = wrap(`"${q.quote}"`, CW - 28), h = ls.length * 13.5 + 28; ensure(h + 8); box(M, y, CW, h); doc.setFillColor(...gold); doc.rect(M, y, 3, h, "F"); font("times", "italic", 11, ink); ls.forEach((l, i) => doc.text(l, M + 14, y + 18 + i * 13.5)); font("helvetica", "bold", 8.5, gray); doc.text(t([q.name, q.place].filter(Boolean).join(", ")), M + 14, y + h - 8); y += h + 8; }); }

    /* Working together */
    page("How we work together");
    para("Before we talk about your finances, timing, or what you can pay, Colorado requires me to explain how brokers can work with you and to have you sign that disclosure. It protects you.", 10.5); y += 4;
    h2("What you’ll sign first");
    table([["Document", 190], ["What it means for you", CW - 190]], [["Definitions of Working Relationships", "Explains the ways a broker can work with you. As your buyer’s agent, I represent your interests."], ["Affiliated Business Arrangement Disclosure", "Tells you about any business ties I or my brokerage have to services you may use. You’re always free to choose your own."]]);
    h2("Then we make it official");
    table([["Document", 190], ["What it means for you", CW - 190]], [["Exclusive Right-to-Buy Contract", "Our written agreement: what I’ll do for you, for how long, and how I’m paid. Compensation is negotiable and set before we tour homes."], ["Mold Disclosure", "Information about mold and how to have a home checked."], ["Wire Fraud Disclosure", "How to protect your money from wiring scams."], ["Radon pamphlet", "What radon is and why testing matters in Colorado."], ["Lead-Based Paint disclosure", "For homes built before 1978."]]);
    box(M, y, CW, 50); font("helvetica", "bold", 10, mid); doc.text("Choosing your own providers", M + 14, y + 20); font("helvetica", "normal", 9.5, ink); doc.text(wrap("I’ll share at least three lenders, inspectors, and home warranty companies I trust, listed alphabetically. You decide who to use.", CW - 28), M + 14, y + 35); y += 66;

    /* Market for buyers */
    page("The market for buyers");
    font("helvetica", "normal", 10, gray); doc.text(t(`${m.area}  |  ${m.asOf}`), M, y); y += 16;
    const tiles = [[usd(m.median), "Median sale price"], [`${m.dom} days`, "Median days on market"], [String(m.monthsSupply), "Months of supply"], [Number(m.active).toLocaleString(), "Homes for sale"], [`${m.concessionShare}%`, "Sales with seller concessions"], [`${m.rate}%`, "30-year mortgage rate"]];
    const tw = (CW - 16) / 3; tiles.forEach((x, i) => { const tx = M + (i % 3) * (tw + 8), ty = y + Math.floor(i / 3) * 70; box(tx, ty, tw, 62); font("times", "bold", 20, mid); doc.text(t(x[0]), tx + 12, ty + 28); font("helvetica", "normal", 8.5, gray); doc.text(t(x[1]), tx + 12, ty + 46); }); y += 152;
    h2("What this means for you");
    const lev = m.monthsSupply > 6 ? "Buyers have strong negotiating power right now." : m.monthsSupply >= 3 ? "The market is balanced, so you have choices and room to negotiate on well-chosen homes." : "Homes are moving quickly, so we’ll need to be ready to act fast.";
    bullets([lev, `About ${m.concessionShare}% of recent sales included a seller concession (median ${usd(m.concessionMedian)}). That money can cover closing costs or buy down your rate.`, `Homes are selling in a median of ${m.dom} days, so there’s usually time to inspect and think, but the best-priced homes still go first.`, `Rates near ${m.rate}% make your monthly payment the number to watch. Let’s look at it next.`]);
    y += 4; para(`Source: ${m.source}.`, 8.5, gray);

    /* Buying power */
    page("Your buying power");
    para("Your monthly payment depends on price, down payment, and rate. Here’s an estimate to start the conversation. Your lender will confirm what you qualify for.", 10.5); y += 4;
    if (price) {
      const scen = [[price * 0.9, "10% below target"], [price, "Target price"], [price * 1.1, "10% above target"]];
      const cw = (CW - 16) / 3; scen.forEach(([p, lab], i) => { const x = M + i * (cw + 8), hi = i === 1; box(x, y, cw, 112, hi ? mid : lin); font("helvetica", "normal", 9, hi ? gold : gray); doc.text(t(lab), x + 12, y + 20); font("times", "bold", 18, hi ? white : mid); doc.text(usd(p), x + 12, y + 44); font("helvetica", "normal", 9, hi ? lin : ink); doc.text(t(`About ${usd(monthly(p, dp, rate, hoa))}/month`), x + 12, y + 66); doc.text(t(`Down payment ${usd(p * dp / 100)}`), x + 12, y + 82); doc.text(t(`Cash to close about ${usd(p * dp / 100 + p * num(b.closingPct) / 100)}`), x + 12, y + 98); }); y += 130;
      h2("Payment breakdown at your target price");
      const loan = price * (1 - dp / 100), rr = rate / 1200, pi = rr ? loan * rr / (1 - Math.pow(1 + rr, -360)) : loan / 360;
      table([["Item", 300], ["Monthly", CW - 300, "r"]], [["Principal and interest (30-year fixed, " + rate + "%)", usd(pi)], ["Property taxes (estimate)", usd(price * TAX_RATE / 12)], ["Homeowner’s insurance (estimate)", usd(INSURANCE)], ...(hoa ? [["HOA dues", usd(hoa)]] : []), ["Estimated total", usd(pi + price * TAX_RATE / 12 + INSURANCE + hoa)]]);
      h2("Cash you’ll need");
      table([["Item", 300], ["Estimate", CW - 300, "r"]], [["Earnest money (due after acceptance; part of your down payment)", usd(price * num(b.earnestPct) / 100)], [`Down payment (${dp}%)`, usd(price * dp / 100)], [`Closing costs (about ${num(b.closingPct)}%; your Loan Estimate has exact figures)`, usd(price * num(b.closingPct) / 100)], ["Inspections (general, sewer scope, radon)", "Varies"], ["Appraisal (usually paid to the lender)", "Varies"]]);
      para("Seller concessions or down payment assistance can lower your cash to close. Mortgage insurance, if required, isn’t included above.", 8.5, gray);
    } else para("Add a target price to see payment estimates.", 10.5, gray);

    /* Loans */
    const LOANS = {
      fha: ["FHA", "Government-insured", ["3.5% down with a 580+ credit score (10% down at 500–579)", "Two years of verifiable work and income", "Primary residence only, FHA-approved appraiser", "Popular with first-time buyers"]],
      conv: ["Conventional", "Most common", ["As little as 3% down for qualifying buyers", "620+ credit score; best rates around 740+", "No mortgage insurance at 20% down", "A larger down payment can make an offer stronger"]],
      va: ["VA", "For eligible veterans", ["No down payment required in most cases", "No private mortgage insurance", "Competitive rates and limited closing costs", "A lifetime benefit you can use more than once"]],
      usda: ["USDA", "Rural and some suburban areas", ["No down payment", "Household income within county limits", "Primary residence in an eligible area", "Many suburban pockets qualify"]],
      jumbo: ["Jumbo", "Above conforming limits", ["For loans above the county’s conforming limit", "Stronger credit, larger down payment, more reserves", "Fixed or adjustable rates", "Requirements vary, so compare lenders"]],
      arm: ["Adjustable-rate (ARM)", "Lower start, then adjusts", ["A 5/1 ARM is fixed 5 years, then adjusts yearly", "Can fit if you’ll sell or refinance before it adjusts", "Know the caps and the highest possible payment", "Ask your lender to show the worst case"]]
    };
    const chosen = (b.loans && b.loans.length ? b.loans : ["fha", "conv", "va", "usda"]).filter(k => LOANS[k]);
    page("Your loan options");
    para("The right loan depends on your credit, savings, and plans. Your lender will recommend the best fit; here’s an overview to start.", 10.5); y += 4;
    const lw = (CW - 12) / 2; chosen.forEach((k, i) => { const [ti, tag, ls] = LOANS[k]; if (i && i % 6 === 0) { page("Your loan options"); } const j = i % 6, x = M + (j % 2) * (lw + 12), top = y + Math.floor(j / 2) * 128; card(x, top, lw, 118, ti, ls, tag); });
    y += Math.ceil(Math.min(chosen.length, 6) / 2) * 128;
    para("Loan limits and requirements change every year. Your lender confirms current figures.", 8.5, gray);

    /* DPA */
    if (b.dpa !== false && b.dpa !== "false") {
      page("Down payment assistance");
      para("Colorado has several programs that help with down payment and closing costs. Each has its own rules, and they change every year, so a participating lender confirms what you qualify for.", 10.5); y += 4;
      const progs = [["metroDPA", "metrodpa.org", ["Assistance up to a percentage of the first mortgage", "Forgivable second mortgage at 0% interest", "Works with FHA, VA, and conventional loans", "Income limit and approved areas apply"]],
        ["CHFA", "chfainfo.com", ["Below-market rate loans, often with assistance", "Homebuyer education course before closing", "Income limits and a minimum $1,000 buyer contribution", "Must use a CHFA participating lender"]],
        ["CHAC", "chaconline.org", ["Low-interest second mortgage for first-time buyers", "Income limits (generally around 80% of area median)", "Homebuyer class required", "Repayable, and due if you sell or refinance"]],
        ["Chenoa Fund", "chenoafund.org", ["3.5% or 5% assistance with FHA or some conventional loans", "Forgivable and repayable options", "Credit score minimums around 600–640", "Repaid if you sell or refinance before forgiveness"]]];
      progs.forEach(([n, url, ls], i) => { const x = M + (i % 2) * (lw + 12), top = y + Math.floor(i / 2) * 128; card(x, top, lw, 118, n, ls, url); });
      y += 2 * 128;
      para("Program details here are general. Ask a participating lender for current income limits, credit minimums, and approved areas before counting on any program.", 8.5, gray);
    }

    /* Road to closed */
    page("Your road to closed");
    const steps = [["Meet and sign disclosures", "We review how we’ll work together and sign the buyer agreement."], ["Get pre-approved", "Your lender confirms your budget, including HOA dues."], ["Set your search", "I build your search around your must-haves and nice-to-haves, and you get new matches right away."], ["Tour homes", "I schedule and attend every showing with you."], ["Write a strong offer", "We plan price, terms, and strategy together."], ["Under contract", "Earnest money, inspections, insurance, title, and HOA documents, each with its own deadline."], ["Appraisal and loan approval", "Your lender finalizes the loan, and we handle any appraisal issues."], ["Final walk-through and closing", "Confirm the home’s condition, sign at the title company, and get your keys."]];
    const sx = M + 14; doc.setDrawColor(...gold); doc.setLineWidth(1.5); doc.line(sx, y, sx, y + (steps.length - 1) * 70);
    steps.forEach(([a, d], i) => { const yy = y + i * 70; badge(sx, yy, i + 1, 12, i % 2 ? mid : gold); font("helvetica", "bold", 11.5, mid); doc.text(a, sx + 26, yy + 4); font("helvetica", "normal", 10, ink); wrap(d, CW - 50).forEach((l, k) => doc.text(l, sx + 26, yy + 20 + k * 13)); });
    y += steps.length * 70;

    /* Showings */
    page("Touring homes");
    bullets(["I schedule, confirm, and attend every showing with you. If I can’t make one, another licensed agent will go with you.", "Lockbox codes are for licensed agents only, so I can’t share them.", "Visiting an open house without me? Let the host know you’re working with me, and hand them my card.", "New construction: tell me before you visit a builder. Many builders require me to register you on your first visit, or I can’t represent you there.", "I’ll come with you to the builder’s design center. Builder contracts are written by the builder, so we review them carefully.", "Take notes and photos where allowed. We’ll compare homes against your must-haves after each tour."]);

    /* Offers */
    page("Writing a winning offer");
    para("Price matters, but it isn’t the only way to stand out. Before we write, I call the listing agent to learn what the seller cares about most.", 10.5); y += 4;
    table([["Strategy", 160], ["How it helps", 190], ["Trade-off", CW - 350]], [["Stronger earnest money", "Shows you’re serious", "More at risk if you back out outside a deadline"], ["Larger down payment", "Signals financial strength", "Less cash left after closing"], ["Flexible closing date", "Fits the seller’s timeline", "May need flexibility on your move"], ["Fewer contingencies", "Fewer ways for the deal to fall apart", "Less protection for you. We weigh this carefully."], ["Escalation clause", "Beats competing offers by a set amount, up to your cap", "Always set a cap you’re comfortable paying"], ["Appraisal gap coverage", "Promises to cover part of a low appraisal", "Cash out of pocket if it appraises low"]]);
    h2("When the seller counters");
    para("We can accept, counter, or let it go. On price, closing date, concessions, contingencies, or earnest money, we decide together whether to give ground or hold it. My job is to keep your goals in focus, not to win an argument.", 10.5);

    /* Deadlines */
    page("Under contract: the key dates");
    para("Colorado’s contract runs on deadlines, counted from the date the contract is fully signed. Every contract is different, but here’s a typical timeline. I track each date for you.", 10.5); y += 8;
    const dl = [["Earnest money due", 1, 3], ["Seller’s disclosures", 1, 3], ["Loan application", 1, 5], ["Inspection objection", 5, 10], ["Title documents", 5, 8], ["Loan terms", 6, 13], ["HOA documents", 14, 14], ["Survey (ILC)", 14, 18], ["Appraisal", 18, 21], ["Closing", 30, 30]];
    const max = 32, gx = M + 140, gw = CW - 150, X = d => gx + d / max * gw;
    font("helvetica", "normal", 8, gray); [0, 7, 14, 21, 28].forEach(d => { doc.text(`Day ${d}`, X(d), y, { align: "center" }); doc.setDrawColor(...line); doc.setLineWidth(0.4); doc.line(X(d), y + 4, X(d), y + 8 + dl.length * 24); }); y += 14;
    dl.forEach(([lab, a, z], i) => { font("helvetica", i === dl.length - 1 ? "bold" : "normal", 9.5, ink); doc.text(lab, M, y + 10); doc.setFillColor(...(i === dl.length - 1 ? mid : gold)); doc.roundedRect(X(a), y + 1, Math.max(6, X(z) - X(a)), 12, 3, 3, "F"); y += 24; });
    y += 6; para("Typical ranges for illustration only. Your lender, the seller, and our negotiation set the real dates. The first 7 to 10 days are the busiest.", 8.5, gray);
    y += 4; h2("Your first week to-do list");
    bullets(["Deliver earnest money to the title company by the deadline, with the property address on it, and get a receipt.", "Schedule your inspection right away, including a radon test and sewer scope if they fit the home.", "Get a homeowner’s insurance quote and ask for a CLUE report on prior claims.", "Send your lender everything they ask for. If you’re using CHFA, take the homebuyer class now."]);

    /* Inspection, appraisal, title */
    page("Inspections, appraisal, and title");
    h2("Inspections"); para("I always recommend an inspection. Common ones in Colorado:", 10.5);
    const insp = ["General home inspection", "Sewer scope", "Roof", "Radon", "Electrical", "Structural", "Mold, lead, asbestos, or meth if there’s reason to", "Well and septic for rural homes"];
    const iw = (CW - 10) / 2; insp.forEach((x, i) => { font("helvetica", "normal", 10, ink); doc.setFillColor(...gold); doc.circle(M + (i % 2) * (iw + 10) + 4, y + Math.floor(i / 2) * 16 - 3.5, 2.5, "F"); doc.text(t(x), M + (i % 2) * (iw + 10) + 12, y + Math.floor(i / 2) * 16); }); y += Math.ceil(insp.length / 2) * 16 + 6;
    para("After the inspection you can ask for repairs (focused on safety, health, and structure), a lower price, a credit toward closing costs, or, before the deadline, walk away and keep your earnest money.", 10.2); y += 6;
    h2("If the appraisal comes in low");
    bullets(["Lenders won’t lend above appraised value, so we have options:", "Ask the seller to lower the price, or split the difference.", "Cover the gap yourself, if you can and want to.", "Challenge the appraisal if it missed a recent sale or measured wrong.", "With an appraisal contingency, terminate and recover your earnest money."]);
    y += 4; h2("Title insurance");
    para("Title insurance protects you from problems with ownership that existed before you bought, like unknown liens. The owner’s policy protects you for as long as you own the home; the lender’s policy protects your lender. I’ll walk you through the title commitment and flag anything unusual.", 10.2);

    /* Team */
    page("Your home buying team");
    para("I share at least three providers in each category, listed alphabetically. You’re free to choose anyone.", 10.5); y += 4;
    [["Lenders", ["Lender"]], ["Home inspectors", ["Inspector"]], ["Home warranty", ["Home warranty"]], ["Title and closing", ["Title and closing"]], ["Insurance", ["Insurance"]]].forEach(([lab, cats]) => {
      const ps = partnersBy(cats); if (!ps.length) return; ensure(60); h2(lab);
      table([["Company", 200], ["Contact", 140], ["Phone", CW - 340]], ps.slice(0, 6).map(p => [p.company || p.name, p.company ? p.name : "", p.phone || ""]));
    });
    if (partnersBy(["Lender", "Inspector", "Home warranty"]).some(p => p.affiliated)) para("Where I or my brokerage has a business tie to a provider, it’s shown on the Affiliated Business Arrangement Disclosure.", 8.5, gray);

    /* Wire fraud + next steps */
    page("Protect your money, and next steps");
    doc.setFillColor(...mid); doc.roundedRect(M, y, CW, 104, 6, 6, "F");
    font("helvetica", "bold", 13, gold); doc.text("Wire fraud warning", M + 16, y + 26);
    font("helvetica", "normal", 10, white); wrap("Criminals send fake emails that look like they come from your agent, lender, or title company, with new wiring instructions. Before you wire any money, call the title company at a number you know is real, not one from the email. I will never send you wiring instructions by email.", CW - 32).forEach((l, i) => doc.text(l, M + 16, y + 46 + i * 14));
    y += 126;
    h2("Next steps");
    [["Sign our disclosures and buyer agreement", "So we can talk openly about your plans."], ["Get pre-approved", "Choose a lender and share your approval with me."], ["Start your search", "I’ll set it up today and send matches as they list."], ["Tour your first homes", "Let’s pick a few to see this week."]].forEach(([a, d], i) => { badge(M + 11, y - 4, i + 1, 11); font("helvetica", "bold", 11.5, mid); doc.text(t(a), M + 30, y); font("helvetica", "normal", 10.5, ink); doc.text(t(d), M + 30, y + 15); y += 42; });
    y += 6; doc.setFillColor(...lin); doc.roundedRect(M, y, CW, 70, 6, 6, "F"); font("times", "bold", 18, mid); doc.text(t(agent.name), M + 18, y + 28); font("helvetica", "normal", 10, ink); doc.text(t([agent.firm, agent.phone, agent.email].filter(Boolean).join("   |   ")), M + 18, y + 48); y += 90;
    para("Estimates in this presentation are for planning only. Your lender confirms rates, payments, and costs, and loan and assistance programs change every year. Buyer’s agent compensation is negotiable and set in our written agreement. Equal Housing Opportunity.", 8.5, gray);

    const pages = doc.getNumberOfPages();
    for (let p = 2; p <= pages; p++) {
      doc.setPage(p); doc.setFillColor(...mid); doc.rect(0, H - 34, W, 34, "F"); font("helvetica", "normal", 8.5, lin); doc.text(t(`${agent.name}  |  ${agent.phone}${agent.email ? "  |  " + agent.email : ""}`), M, H - 14); doc.text(`${p} / ${pages}`, W - M, H - 14, { align: "right" });
      font("helvetica", "normal", 7, gray); doc.text(t(`Estimates only; verify with your lender.${C.LICENSE_TEXT && !/\[add/i.test(C.LICENSE_TEXT) ? "  " + C.LICENSE_TEXT : ""}`), W / 2, H - 40, { align: "center" });
    }
    const name = `Buyer_Presentation_${(b.preparedFor || "Buyer").replace(/[^\w]+/g, "_").replace(/^_|_$/g, "")}.pdf`;
    return { blob: doc.output("blob"), name, doc };
  }
  BP.buildPDF = buildPDF;

  document.addEventListener("click", async e => {
    const el = e.target.closest("[data-bp-new],[data-bp-pdf],[data-bp-del],[data-bp-for]"); if (!el) return; const d = el.dataset;
    if (d.bpNew !== undefined) BP.create({});
    else if (d.bpFor !== undefined) BP.create({ contactId: d.bpFor });
    else if (d.bpDel !== undefined) { if (confirm("Delete this buyer presentation?")) { Store.saveCrm("buyerpres", d.bpDel, null); agentPanel = "buyerpres"; renderAgent(); } }
    else if (d.bpPdf !== undefined) { const msg = $("#bpMsg"); if (msg) msg.textContent = "Making the PDF…"; try { const { blob, name } = await buildPDF(d.bpPdf); await CMAReport.savePDF(blob, name); if (msg) msg.textContent = "PDF ready."; } catch (err) { if (msg) msg.textContent = err.message || "The PDF didn’t generate. Try again."; } }
  });
  document.addEventListener("change", e => {
    const d = e.target.dataset || {};
    if (d.bpF) { const [id, k] = d.bpF.split("|"); edit(id, x => { x[k] = k === "dpa" ? e.target.value === "true" : e.target.value.trim(); if (k === "contactId") { const c = Store.crm.contacts[x.contactId]; if (c) { if (!x.preparedFor) x.preparedFor = c.name; if (!x.price && c.budget) x.price = parseMoney(c.budget); if (!x.areas && c.area) x.areas = c.area; } } }); }
    else if (d.bpLoan) { const [id, k] = d.bpLoan.split("|"); edit(id, x => { const s = new Set(x.loans || []); e.target.checked ? s.add(k) : s.delete(k); x.loans = ["fha", "conv", "va", "usda", "jumbo", "arm"].filter(v => s.has(v)); }); }
    else if (d.bpKit) { const [id, k] = d.bpKit.split("|"); edit(id, x => { x.kit = { ...(x.kit || {}), [k]: e.target.checked }; }); }
  });
  BP._t = { CHECKLIST, monthly };
})();
