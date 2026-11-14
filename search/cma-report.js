/* =========================================================================
   The Miller Group — Seller CMA report (PDF), adjustment rates, and email.
   Loads after the main app and office.js and uses their globals.
   The PDF is drawn with jsPDF, loaded from cdnjs only when a report is made.
   ========================================================================= */
(function () {
  const JSPDF_URL = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
  const C = window.MG_CONFIG || {};
  const R = window.CMAReport = {};
  const brand = { midnight: [20, 26, 38], gold: [184, 147, 90], linen: [244, 239, 231], ink: [33, 37, 46], gray: [104, 110, 122], line: [221, 212, 197] };
  const DISCLAIMER = "This comparative market analysis is a broker’s opinion of value prepared to help price a home for sale. It is not an appraisal and should not be relied on as one. Values are estimates based on the listings and sales shown and may change with market conditions and the home’s condition after a walkthrough.";

  let loading = null;
  function loadPdfLib() {
    if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
    if (!loading) loading = new Promise((res, rej) => {
      const s = document.createElement("script"); s.src = JSPDF_URL; s.async = true;
      s.onload = () => window.jspdf ? res(window.jspdf.jsPDF) : rej(new Error("PDF tool didn’t load"));
      s.onerror = () => { loading = null; rej(new Error("PDF tool didn’t load. Check your connection.")); };
      document.head.appendChild(s);
    });
    return loading;
  }
  // Built-in PDF fonts cover basic Latin; swap the few characters they lack.
  const t = v => String(v ?? "").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/−/g, "-").replace(/…/g, "...").replace(/[^\x09\x0A\x0D\x20-\x7E -ÿ–—]/g, "");
  const usd = n => "$" + Math.round(n).toLocaleString("en-US");
  const signed = n => (n > 0 ? "+" : n < 0 ? "-" : "") + usd(Math.abs(n));
  const today = () => new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  /* ---------------- PDF ---------------- */
  async function buildPDF(id, opt) {
    const jsPDF = await loadPdfLib();
    const c = Store.crm.cmas[id], r = cmaCalc(c), sub = c.subject || {};
    const agent = { name: IDX.BROKER.name, phone: IDX.BROKER.phone, email: IDX.BROKER.email || "", firm: IDX.BROKER.firm || "The Miller Group" };
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const W = 612, H = 792, M = 48, CW = W - M * 2;
    let y = 0;
    const font = (f, st, sz, col) => { doc.setFont(f, st); doc.setFontSize(sz); doc.setTextColor(...(col || brand.ink)); };
    const ensure = h => { if (y + h > H - 70) { doc.addPage(); y = M; } };
    const para = (text, sz = 10, col = brand.ink, lh = 1.45, width = CW, x = M) => {
      font("helvetica", "normal", sz, col);
      const lines = doc.splitTextToSize(t(text), width);
      lines.forEach(line => { ensure(sz * lh); doc.text(line, x, y); y += sz * lh; });
    };
    const heading = text => { ensure(40); y += 10; font("times", "bold", 15, brand.midnight); doc.text(t(text), M, y); y += 8; doc.setDrawColor(...brand.gold); doc.setLineWidth(1); doc.line(M, y, M + 40, y); y += 16; };

    // Header band
    doc.setFillColor(...brand.midnight); doc.rect(0, 0, W, 64, "F");
    font("times", "bold", 20, brand.gold); doc.text(t(agent.firm), M, 40);
    font("helvetica", "normal", 10, brand.linen); doc.text("Comparative Market Analysis", W - M, 40, { align: "right" });
    y = 104;
    font("times", "bold", 26, brand.midnight); doc.splitTextToSize(t(sub.address || c.name), CW).forEach(l => { doc.text(l, M, y); y += 30; });
    font("helvetica", "normal", 11, brand.gray);
    doc.text(t([sub.hood, typeName(sub.type), `${sub.beds} bd`, `${sub.baths} ba`, `${Number(sub.sqft || 0).toLocaleString()} sq ft`, sub.year ? `Built ${sub.year}` : ""].filter(Boolean).join("  |  ")), M, y); y += 18;
    doc.text(t(`${opt.preparedFor ? `Prepared for ${opt.preparedFor} by ` : "Prepared by "}${agent.name}  |  ${today()}`), M, y); y += 28;

    // Price box
    doc.setFillColor(...brand.linen); doc.setDrawColor(...brand.line); doc.roundedRect(M, y, CW, 96, 8, 8, "FD");
    font("helvetica", "normal", 10, brand.gray); doc.text("Suggested list price range", M + 20, y + 26);
    font("times", "bold", 30, brand.midnight); doc.text(t(`${usd(r.low)} - ${usd(r.high)}`), M + 20, y + 60);
    font("helvetica", "normal", 10, brand.gray); doc.text(t(`Indicated value ${usd(r.value)}, the median ${r.method} of ${r.rows.length} comparable homes.`), M + 20, y + 82);
    y += 122;

    // Comps table
    heading("Comparable homes");
    const cols = [{ h: "#", w: 18 }, { h: "Address", w: 150 }, { h: "Status", w: 62 }, { h: "Price", w: 70, a: "right" }, { h: "Bd/Ba", w: 40, a: "right" }, { h: "Sq ft", w: 44, a: "right" }, { h: "Adjust.", w: 62, a: "right" }, { h: "Adjusted", w: 70, a: "right" }];
    const drawRow = (cells, bold, fill) => {
      ensure(22);
      if (fill) { doc.setFillColor(...fill); doc.rect(M, y - 13, CW, 20, "F"); }
      font("helvetica", bold ? "bold" : "normal", 9, bold ? brand.midnight : brand.ink);
      let x = M + 4;
      cells.forEach((v, i) => { const col = cols[i]; const txt = doc.splitTextToSize(t(v), col.w - 6)[0] || ""; doc.text(txt, col.a === "right" ? x + col.w - 8 : x, y, col.a === "right" ? { align: "right" } : undefined); x += col.w; });
      y += 20;
    };
    drawRow(cols.map(c => c.h), true, brand.linen);
    drawRow(["S", sub.address || "Subject", "Subject", "", `${sub.beds}/${sub.baths}`, Number(sub.sqft || 0).toLocaleString(), "", ""], true);
    r.rows.forEach((x, i) => drawRow([String(i + 1), x.l.address + (x.heavy ? " *" : ""), x.l.status, usd(x.l.price), `${x.l.beds}/${x.l.baths}`, x.l.sqft.toLocaleString(), x.adj ? signed(x.adj) : "-", usd(x.ap)], false, i % 2 ? null : [250, 248, 244]));
    doc.setDrawColor(...brand.line); doc.line(M, y - 12, M + CW, y - 12); y += 4;
    if (r.heavy) { para("* Needs large adjustments to match this home (more than 15% net or 25% gross), so treat it as a less reliable indicator of value.", 8.5, brand.gray); y += 2; }

    // Adjustment details
    if (opt.details) {
      const anyAdj = r.rows.some(x => x.parts.length || x.other);
      if (anyAdj) {
        heading("How each comp was adjusted");
        para("Each adjustment estimates what a comparable home would sell for if it matched this home. Homes that are larger or better featured than this one are adjusted down, and smaller ones are adjusted up.", 9, brand.gray);
        y += 4;
        r.rows.forEach((x, i) => {
          const items = [...x.parts.map(p => `${p.label} ${signed(p.amt)}`), ...(x.other ? [`Agent adjustment ${signed(x.other)}`] : [])];
          if (!items.length) return;
          ensure(30); font("helvetica", "bold", 9.5, brand.midnight); doc.text(t(`${i + 1}. ${x.l.address}`), M, y); y += 13;
          para(items.join("   |   "), 9, brand.ink, 1.4, CW - 12, M + 12); y += 4;
        });
      }
    }

    // Map
    if (opt.map) {
      const pts = r.rows.map((x, i) => ({ lat: x.l.lat, lng: x.l.lng, label: String(i + 1) })).filter(p => p.lat && p.lng);
      const sk = c.subjectKey ? listingSync(c.subjectKey) : null;
      const hc = (typeof HOODS !== "undefined" ? HOODS.find(h => h[0] === sub.hood) : null);
      const sp = sk && sk.lat ? { lat: sk.lat, lng: sk.lng } : hc ? { lat: hc[1].lat, lng: hc[1].lng, approx: true } : null;
      if (pts.length) {
        heading("Where the comps are");
        const all = sp ? [...pts, sp] : pts, mh = 200;
        ensure(mh + 30);
        let la0 = Math.min(...all.map(p => p.lat)), la1 = Math.max(...all.map(p => p.lat)), ln0 = Math.min(...all.map(p => p.lng)), ln1 = Math.max(...all.map(p => p.lng));
        const padLa = Math.max((la1 - la0) * 0.15, 0.004), padLn = Math.max((ln1 - ln0) * 0.15, 0.005); la0 -= padLa; la1 += padLa; ln0 -= padLn; ln1 += padLn;
        const X = ln => M + (ln - ln0) / (ln1 - ln0) * CW, Y = la => y + (la1 - la) / (la1 - la0) * mh;
        doc.setFillColor(...brand.linen); doc.setDrawColor(...brand.line); doc.roundedRect(M, y, CW, mh, 6, 6, "FD");
        if (sp) { doc.setFillColor(...brand.gold); doc.circle(X(sp.lng), Y(sp.lat), 9, "F"); font("helvetica", "bold", 9, [255, 255, 255]); doc.text("S", X(sp.lng), Y(sp.lat) + 3, { align: "center" }); }
        pts.forEach(p => { doc.setFillColor(...brand.midnight); doc.circle(X(p.lng), Y(p.lat), 8, "F"); font("helvetica", "bold", 8.5, [255, 255, 255]); doc.text(p.label, X(p.lng), Y(p.lat) + 3, { align: "center" }); });
        y += mh + 14;
        font("helvetica", "normal", 8.5, brand.gray); doc.text(t(`S = this home${sp && sp.approx ? " (approximate)" : ""}. Numbers match the comps table.`), M, y); y += 10;
      }
    }

    // Summary
    if (opt.summary && (c.notes || "").trim()) { heading("Summary"); para(c.notes, 10.5, brand.ink, 1.5); }

    // Method + disclaimer
    heading("About this analysis");
    const actives = r.rows.some(x => x.l.status === "Active" || x.l.status === "Coming Soon");
    para(`The range is the middle half of the adjusted comp values, rounded to the nearest $5,000. ${actives ? "Some comps are active listings rather than closed sales, so they are reduced to reflect that homes usually sell for less than their list price. " : ""}Listing data: ${IDX.MLS_NAME}${IDX.MODE === "sample" ? " (sample listings for demonstration)" : ""}.`, 9, brand.gray);
    y += 4; para(DISCLAIMER, 9, brand.gray);

    // Footer on every page
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.setDrawColor(...brand.line); doc.line(M, H - 52, W - M, H - 52);
      font("helvetica", "bold", 9, brand.midnight); doc.text(t(`${agent.name}  |  ${agent.firm}`), M, H - 36);
      font("helvetica", "normal", 8.5, brand.gray); doc.text(t([agent.phone, agent.email].filter(Boolean).join("  |  ")), M, H - 24);
      if (C.LICENSE_TEXT && !/\[add/i.test(C.LICENSE_TEXT)) doc.text(t(C.LICENSE_TEXT), M, H - 13);
      doc.text(`Page ${p} of ${pages}`, W - M, H - 24, { align: "right" });
    }
    const name = `CMA_${(sub.address || c.name).replace(/[^\w]+/g, "_").replace(/^_|_$/g, "")}.pdf`;
    return { blob: doc.output("blob"), name, doc };
  }
  R.buildPDF = buildPDF;
  R.loadPdfLib = loadPdfLib; R.brand = brand; R.clean = t;

  async function savePDF(blob, name) {
    try { const dl = await window.claude?.use?.("downloads"); if (dl) { await dl.save({ filename: name, data: blob }); return true; } } catch (e) { if (e && e.code && e.code !== "unavailable") return false; }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); return true;
  }
  R.savePDF = (...a) => savePDF(...a);
  const toBase64 = blob => new Promise((res, rej) => { const f = new FileReader(); f.onload = () => res(String(f.result).split(",")[1]); f.onerror = rej; f.readAsDataURL(blob); });

  /* ---------------- Report sheet ---------------- */
  R.open = function (id) {
    const c = Store.crm.cmas[id]; if (!c) return;
    const r = cmaCalc(c); if (!r.value) { toast("Choose at least one comp first."); return; }
    const contact = c.contactId ? Store.crm.contacts[c.contactId] : null;
    const canEmail = !!C.EMAIL_ENDPOINT;
    $("#formBody").innerHTML = `<div class="sheettop"><h2>Seller report</h2><button class="close" data-close aria-label="Close">×</button></div>
      <form id="cmaRepForm">
        <p class="addr">${esc(c.name)} · ${money(r.low)} – ${money(r.high)}</p>
        <label for="crFor">Prepared for</label><input id="crFor" value="${esc(c.preparedFor || (contact ? contact.name : ""))}">
        <label class="check"><input type="checkbox" id="crSum" ${c.notes ? "checked" : "disabled"}> Include the summary${c.notes ? "" : " (write or draft one first)"}</label>
        <label class="check"><input type="checkbox" id="crDet" checked> Include how each comp was adjusted</label>
        <label class="check"><input type="checkbox" id="crMap" checked> Include a map of the comps</label>
        <label class="check"><input type="checkbox" id="crOk" required> I reviewed the comps, adjustments, and price range</label>
        <div class="actions"><button class="btn gold" type="submit" data-act="pdf">Download PDF</button><button class="btn ghost" type="submit" data-act="email">Email to seller</button></div>
        <div id="crEmail" class="hidden"><label for="crTo">Seller’s email</label><input id="crTo" type="email" value="${esc(contact && contact.email || "")}">
          <label for="crSubj">Subject</label><input id="crSubj" value="${esc(`Your home’s market analysis: ${c.subject.address || c.name}`)}">
          <label for="crMsg">Message</label><textarea id="crMsg" rows="5" style="width:100%">${esc(`Hi ${(c.preparedFor || (contact ? contact.name : "")).split(" ")[0] || "there"},\n\nAttached is the market analysis for ${c.subject.address || "your home"}. I’d love to walk through it with you and talk about timing and pricing.\n\n${IDX.BROKER.name}`)}</textarea>
          ${canEmail ? "" : `<p class="addr">Email sending isn’t connected yet. Send will download the PDF and open your email app so you can attach it.</p>`}
          <div class="actions"><button class="btn gold" type="button" id="crSend">Send</button></div></div>
        <p class="msg" id="crMsgOut" role="status"></p></form>`;
    const form = $("#cmaRepForm"), out = $("#crMsgOut");
    let act = "pdf";
    form.querySelectorAll("[data-act]").forEach(b => b.addEventListener("click", () => { act = b.dataset.act; }));
    const opts = () => ({ preparedFor: $("#crFor").value.trim(), summary: $("#crSum").checked, details: $("#crDet").checked, map: $("#crMap").checked });
    const remember = () => editCMA(id, x => { x.preparedFor = $("#crFor").value.trim(); x.reportedAt = new Date().toISOString(); });
    form.addEventListener("submit", async e => {
      e.preventDefault();
      if (act === "email") { $("#crEmail").classList.remove("hidden"); $("#crTo").focus(); return; }
      out.textContent = "Making the PDF…";
      try { const { blob, name } = await buildPDF(id, opts()); await savePDF(blob, name); remember(); out.textContent = "PDF ready."; }
      catch (err) { out.textContent = err.message || "The PDF didn’t generate. Try again."; }
    });
    $("#crSend").addEventListener("click", async () => {
      if (!$("#crOk").checked) { out.textContent = "Check that you reviewed the report first."; return; }
      const to = $("#crTo").value.trim(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) { out.textContent = "Add the seller’s email."; return; }
      out.textContent = "Making the PDF…";
      try {
        const { blob, name } = await buildPDF(id, opts());
        if (!canEmail) {
          await savePDF(blob, name); remember();
          location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent($("#crSubj").value)}&body=${encodeURIComponent($("#crMsg").value + "\n\n(Market analysis attached.)")}`;
          out.textContent = "PDF downloaded. Attach it to the email that just opened."; return;
        }
        out.textContent = "Sending…";
        const token = await window.MillerCloud?.token?.();
        const res = await fetch(C.EMAIL_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token || ""}` },
          body: JSON.stringify({ to, subject: $("#crSubj").value, text: $("#crMsg").value, attachments: [{ filename: name, content: await toBase64(blob) }] }) });
        if (!res.ok) { const j = await res.json().catch(() => ({})); out.textContent = j.error || "That didn’t send. Try again."; return; }
        remember();
        if (contact) Store.saveCrm("contacts", c.contactId, { ...contact, lastContacted: new Date().toISOString() });
        out.textContent = `Sent to ${to}.`;
      } catch (err) { out.textContent = err.message || "That didn’t send. Try again."; }
    });
    if (!$("#dlgForm").open) $("#dlgForm").showModal();
  };

  /* ---------------- Adjustment rates (broker) ---------------- */
  R.openRates = function () {
    const r = cmaRates();
    $("#formBody").innerHTML = `<div class="sheettop"><h2>Adjustment rates</h2><button class="close" data-close aria-label="Close">×</button></div>
      <form id="cmaRatesForm"><p class="addr">Every agent’s automatic adjustments use these. Agents can still add their own on each comp.</p>
        <label for="rtSize">Size: share of the comps’ median price per square foot (%)</label><input id="rtSize" inputmode="decimal" value="${r.sizePct}">
        <div class="row2"><div><label for="rtBed">Per bedroom ($)</label><input id="rtBed" inputmode="decimal" value="${r.bed}"></div><div><label for="rtBath">Per bathroom ($)</label><input id="rtBath" inputmode="decimal" value="${r.bath}"></div></div>
        <div class="row2"><div><label for="rtAge">Per decade of age ($)</label><input id="rtAge" inputmode="decimal" value="${r.agePerDecade}"></div><div><label for="rtCap">Age cap ($)</label><input id="rtCap" inputmode="decimal" value="${r.ageCap}"></div></div>
        <label for="rtAct">Active listings: reduce list price by (%)</label><input id="rtAct" inputmode="decimal" value="${r.activePct}">
        <div class="actions"><button class="btn gold" type="submit">Save rates</button><button class="btn ghost" type="button" id="rtReset">Reset to defaults</button></div></form>`;
    const num = id => { const v = parseFloat(String($(id).value).replace(/[$,%\s]/g, "")); return isFinite(v) && v >= 0 ? v : 0; };
    const save = rates => { if (window.Office?._t?.saveCompanyDoc) Office._t.saveCompanyDoc("settings", { cmaRates: rates }); $("#dlgForm").close(); renderAgent(); };
    $("#cmaRatesForm").addEventListener("submit", e => { e.preventDefault(); save({ sizePct: Math.min(num("#rtSize"), 100), bed: num("#rtBed"), bath: num("#rtBath"), agePerDecade: num("#rtAge"), ageCap: num("#rtCap"), activePct: Math.min(num("#rtAct"), 20) }); });
    $("#rtReset").addEventListener("click", () => save({ ...CMA_RATE_DEFAULTS }));
    if (!$("#dlgForm").open) $("#dlgForm").showModal();
  };
})();
