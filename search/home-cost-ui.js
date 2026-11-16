/* =========================================================================
   The Miller Group: "What it really costs" on every listing.
   - Monthly all-in: principal and interest, mortgage insurance, property tax
     (metro districts included), HOA dues, homeowners insurance (wildfire
     adjusted), and flood insurance when it's required.
   - Each number is labeled: from the listing, verified by an agent, or an
     estimate. Agents add verified facts once (tax bill, HOA, metro district,
     flood zone, wildfire risk, radon, sewer scope) and every client sees them.
   - "Checks before you buy": flood zone, wildfire, metro district, radon,
     sewer scope, lead paint, well and septic, HOA documents.
   Facts live at costfacts/<listing key> (public read, agents write).
   ========================================================================= */
(function () {
  const CU = window.CostUI = { hz: {}, demo: {}, inputs: { down: null, rate: null }, msg: {} };
  const C = window.MG_CONFIG || {};
  const H = () => window.HomeCost;
  const safeKey = k => String(k || "").replace(/[^A-Za-z0-9_\-]/g, "_").slice(0, 120);
  const cfg = () => (Store.costConfig || {});
  const stored = key => { const k = safeKey(key); return (Store.demo ? CU.demo[k] : (Store.costFacts || {})[k]) || null; };
  CU.facts = key => { const base = stored(key) || {}, hz = CU.hz[safeKey(key)]; return hz && hz.floodZone && !base.floodZone ? { ...base, floodZone: hz.floodZone } : { ...base }; };
  const L = () => (window.I18N && I18N.lang) || "en", t = (en, es) => L() === "es" ? es : en;
  const SRC = () => ({ mls: t("From the listing", "Del anuncio"), agent: t("Verified by agent", "Verificado por agente"), estimate: t("Estimate", "Estimado") });
  const ICON = { ok: "✓", warn: "!", check: "?" };

  CU.cardLine = l => { if (!H() || !l || !l.price) return ""; const tot = H().estimate(l, { lang: L() }, CU.facts(l.key), cfg()).total; return tot ? `<div class="cost-line">${t(`About ${money(tot)}/mo all-in`, `Aprox. ${money(tot)}/mes en total`)}</div>` : ""; };

  CU.html = function (l) {
    if (!H() || !l || !l.price) return "";
    const f = CU.facts(l.key), def = H().DEFAULTS;
    const down = CU.inputs.down ?? (cfg().down ?? def.down), rate = CU.inputs.rate ?? (cfg().rate ?? def.rate);
    const e = H().estimate(l, { down, rate, lang: L() }, f, cfg());
    lookupHazards(l);
    return `<section class="cost" id="costBox" data-cost-key="${esc(l.key)}" aria-labelledby="costH">
      <div class="cost-top"><h3 id="costH">${t("What it really costs", "Lo que realmente cuesta")}</h3><div class="cost-total"><b>${money(e.total)}</b><span>${t("/mo", "/mes")}</span></div></div>
      <div class="row2"><div><label for="costDown">${t("Down payment (%)", "Enganche (%)")}</label><input id="costDown" data-cost inputmode="decimal" value="${esc(down)}"></div><div><label for="costRate">${t("Interest rate (%)", "Tasa de interés (%)")}</label><input id="costRate" data-cost inputmode="decimal" value="${esc(rate)}"></div></div>
      <table class="cost-tbl"><tbody>${e.lines.map(x => `<tr><th scope="row">${esc(x.label)}<span class="cost-src ${x.source}">${SRC()[x.source]}</span><small>${esc(x.basis)}</small></th><td>${money(x.monthly)}</td></tr>`).join("")}</tbody></table>
      ${e.flags.map(x => `<p class="cost-flag">${esc(x.text)}</p>`).join("")}
      <h4 class="cost-h">${t("Checks before you buy", "Qué revisar antes de comprar")}</h4>
      <ul class="cost-checks">${e.checks.map(c => `<li class="${c.status}"><span class="cost-ic" aria-hidden="true">${ICON[c.status]}</span><div><strong>${esc(c.label)}</strong><span>${esc(c.note)}${c.link ? ` <a href="${esc(c.link)}" target="_blank" rel="noopener">${t("Look it up", "Consultar")}</a>` : ""}</span></div></li>`).join("")}</ul>
      <p class="addr cost-fine">${t("An estimate to help you compare homes, not a loan offer or an insurance quote. Taxes and dues come from the listing or your agent when we have them; everything marked “Estimate” is a rough figure. Utilities aren’t included.", "Un estimado para comparar casas, no una oferta de préstamo ni una cotización de seguro. Los impuestos y cuotas vienen del anuncio o de su agente cuando los tenemos; todo lo marcado “Estimado” es aproximado. No incluye servicios públicos.")}${e.updatedBy ? t(` Facts verified by ${esc(e.updatedBy)}${e.updatedAt ? ` on ${new Date(e.updatedAt).toLocaleDateString()}` : ""}.`, ` Datos verificados por ${esc(e.updatedBy)}${e.updatedAt ? ` el ${new Date(e.updatedAt).toLocaleDateString("es-US")}` : ""}.`) : ""}</p>
      <div class="quick"><a class="btn gold" href="https://nestkey.ai" target="_blank" rel="noopener">${t("Get pre-qualified", "Precalifíquese")}</a>${Store.isAgent ? `<button class="btn ghost" type="button" data-cost-edit="${esc(l.key)}">${stored(l.key) ? "Edit cost facts" : "Add cost facts"}</button>` : ""}</div>
      ${Store.isAgent && CU.editing === l.key ? editorHTML(l, f) : ""}
    </section>`;
  };

  function editorHTML(l, f) {
    const sel = (id, v, opts) => `<select id="${id}">${opts.map(([val, lab]) => `<option value="${val}" ${String(v || "") === val ? "selected" : ""}>${lab}</option>`).join("")}</select>`;
    const inp = (id, label, v, ph = "", type = "text") => `<div><label for="${id}">${label}</label><input id="${id}" type="${type}" value="${esc(v || "")}" placeholder="${esc(ph)}"></div>`;
    return `<div class="tourform cost-edit"><p class="addr">Verified facts show to every client who opens this home. Leave anything you haven’t confirmed blank.</p>
      <div class="row2">${inp("cfTax", "Annual property tax ($)", f.taxAnnual, l.taxAnnual ? `Listing says ${l.taxAnnual}` : "From the county tax bill")}${inp("cfTaxYr", "Tax year", f.taxYear, String(new Date().getFullYear() - 1))}</div>
      <div class="row2"><div><label for="cfMetro">Metro district</label>${sel("cfMetro", f.metroDistrict, [["", "Not checked"], ["yes", "Yes"], ["no", "No"]])}</div>${inp("cfMetroNote", "Metro district note", f.metroNote, "e.g. Sterling Ranch MD, 50 mills")}</div>
      <div class="row2">${inp("cfHoa", "HOA dues per month ($)", f.hoaMonthly, "All associations combined")}${inp("cfHoaNote", "What HOA covers", f.hoaNote, "e.g. Water, trash, exterior insurance")}</div>
      <div class="row2">${inp("cfFlood", "FEMA flood zone", f.floodZone, "e.g. X, AE")}${inp("cfFloodMo", "Flood insurance per month ($)", f.floodMonthly, "From a quote")}</div>
      <div class="row2"><div><label for="cfFire">Wildfire risk</label>${sel("cfFire", f.wildfire, [["", "Not checked"], ["low", "Low"], ["moderate", "Moderate"], ["high", "High"], ["very high", "Very high"]])}</div>${inp("cfIns", "Insurance quote per month ($)", f.insuranceMonthly, "Optional")}</div>
      <div class="row2">${inp("cfRadon", "Radon", f.radon, "e.g. Mitigation system installed 2022")}${inp("cfSewer", "Sewer scope", f.sewer, "e.g. Clear, scoped 10/2026")}</div>
      <div class="row2">${inp("cfWell", "Well and septic", f.wellSeptic, "e.g. Public water and sewer")}${inp("cfHoaDocs", "HOA documents", f.hoaDocs, "e.g. Reserves healthy, no special assessment")}</div>
      <div class="quick"><button class="btn gold" type="button" data-cost-save="${esc(l.key)}">Save facts</button><button class="btn ghost" type="button" data-cost-cancel>Cancel</button></div><p class="msg" role="status">${esc(CU.msg[l.key] || "")}</p></div>`;
  }

  // FEMA flood zone from the server (optional; needs HAZARDS_ENDPOINT).
  function lookupHazards(l) {
    const k = safeKey(l.key);
    if (!C.HAZARDS_ENDPOINT || CU.hz[k] || !isFinite(+l.lat) || !isFinite(+l.lng) || !+l.lat) return;
    CU.hz[k] = { pending: true };
    fetch(`${C.HAZARDS_ENDPOINT}?lat=${(+l.lat).toFixed(6)}&lng=${(+l.lng).toFixed(6)}`).then(r => r.ok ? r.json() : null).then(j => {
      CU.hz[k] = j && j.floodZone ? { floodZone: j.floodZone } : { none: true };
      if (j && j.floodZone) rerender(l.key);
    }).catch(() => { CU.hz[k] = { none: true }; });
  }

  async function rerender(key) {
    const box = document.getElementById("costBox"); if (!box || box.dataset.costKey !== String(key)) return;
    const l = await ListingProvider.get(key); if (!l) return;
    const focus = document.activeElement && document.activeElement.id;
    box.outerHTML = CU.html(l);
    if (focus) { const el = document.getElementById(focus); if (el) { el.focus(); if (el.setSelectionRange && el.value != null) { try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) {} } } }
  }
  CU.rerender = rerender;

  async function save(key) {
    const g = id => (document.getElementById(id) || {}).value || "";
    const n = v => { const x = String(v).replace(/[$,\s]/g, ""); return x && isFinite(+x) && +x >= 0 ? +x : ""; };
    const me = (Store.team || {})[Store.uid] || (Store.team || {})[Store.crmOwner] || {};
    const data = { listingKey: String(key), taxAnnual: n(g("cfTax")), taxYear: g("cfTaxYr").trim().slice(0, 4), metroDistrict: g("cfMetro"), metroNote: g("cfMetroNote").trim().slice(0, 200),
      hoaMonthly: n(g("cfHoa")), hoaNote: g("cfHoaNote").trim().slice(0, 200), floodZone: g("cfFlood").trim().toUpperCase().slice(0, 8), floodMonthly: n(g("cfFloodMo")),
      wildfire: g("cfFire"), insuranceMonthly: n(g("cfIns")), radon: g("cfRadon").trim().slice(0, 200), sewer: g("cfSewer").trim().slice(0, 200),
      wellSeptic: g("cfWell").trim().slice(0, 200), hoaDocs: g("cfHoaDocs").trim().slice(0, 300), agentId: Store.uid || Store.crmOwner || "", byName: me.name || "", at: new Date().toISOString() };
    Object.keys(data).forEach(k => { if (data[k] === "") delete data[k]; });
    const k = safeKey(key);
    if (Store.demo || !Store.db) { CU.demo[k] = data; CU.editing = null; rerender(key); return; }
    try { await Store.db.doc(`costfacts/${k}`).set(data); Store.costFacts = { ...(Store.costFacts || {}), [k]: data }; CU.editing = null; CU.msg[key] = ""; }
    catch (e) { CU.msg[key] = "Didn’t save. Check your connection and try again."; }
    rerender(key);
  }

  CU.watch = function (db) {
    if (CU.watching || !db) return; CU.watching = true;
    db.collection("costfacts").onSnapshot(sn => { const m = {}; sn.docs.forEach(d => { m[d.id] = d.data(); }); Store.costConfig = m.config || {}; delete m.config; Store.costFacts = m; Store.emit(); }, () => {});
  };
  CU.seedDemo = function () {
    CU.demo = {
      "S-1002": { metroDistrict: "no", hoaMonthly: 512, hoaNote: "Water, trash, gas, building insurance, and reserves", floodZone: "X", wildfire: "low", radon: "Tested 2.1 pCi/L in 2024", hoaDocs: "Reserves at 68% funded; no special assessment planned", byName: "Alex Rivera", at: new Date(Date.now() - 86400000 * 2).toISOString() },
      "S-1009": { taxAnnual: 6840, taxYear: "2025", metroDistrict: "no", floodZone: "X", wildfire: "low", sewer: "Clear, scoped 10/2026", byName: "Brandon Miller", at: new Date(Date.now() - 86400000).toISOString() },
      "S-1010": { floodZone: "AE", floodMonthly: 145, wildfire: "low", sewer: "Roots at the tap; seller credit offered", byName: "Brandon Miller", at: new Date().toISOString() }
    };
  };

  if (Store.pubDb) CU.watch(Store.pubDb);
  if (Store.demo && !Object.keys(CU.demo).length) CU.seedDemo();
  if (!document.getElementById("costStyles")) {
    const st = document.createElement("style"); st.id = "costStyles";
    st.textContent = `.cost{border:1px solid var(--line);border-radius:14px;padding:14px;margin:14px 0;background:var(--surface)}
.cost .row2{display:grid;grid-template-columns:1fr 1fr;gap:10px}.cost .row2>div{min-width:0}.cost input,.cost select{width:100%;box-sizing:border-box;min-width:0}.cost-src{white-space:nowrap}
.cost-top{display:flex;justify-content:space-between;align-items:baseline;gap:10px}.cost-top h3{margin:0;font-size:17px}.cost-total b{font-size:22px}.cost-total span{color:var(--ink-2);font-size:14px}
.cost-tbl{width:100%;border-collapse:collapse;margin:10px 0}.cost-tbl th{text-align:left;font-weight:500;padding:8px 0;border-top:1px solid var(--line);vertical-align:top}.cost-tbl td{text-align:right;padding:8px 0;border-top:1px solid var(--line);vertical-align:top;font-variant-numeric:tabular-nums;white-space:nowrap}
.cost-tbl small{display:block;color:var(--ink-2);font-size:12px;font-weight:400;margin-top:2px}.cost-src{display:inline-block;font-size:11px;font-weight:600;border-radius:999px;padding:1px 7px;margin-left:6px;vertical-align:1px;border:1px solid var(--line);color:var(--ink-2)}
.cost-src.agent{border-color:var(--gold);color:var(--ink)}.cost-src.mls{color:var(--ink)}.cost-flag{background:var(--bg);border-left:4px solid var(--gold);border-radius:8px;padding:8px 10px;margin:8px 0;font-size:14px}
.cost-h{margin:14px 0 6px;font-size:15px}.cost-checks{list-style:none;padding:0;margin:0}.cost-checks li{display:flex;align-items:flex-start;gap:10px;padding:7px 0;border-top:1px solid var(--line);font-size:14px}.cost-checks li div{display:flex;flex-direction:column}.cost-checks span{color:var(--ink-2)}
.cost-ic{flex:none;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:700;border:1.5px solid var(--line);color:var(--ink-2)}.cost-checks li.ok .cost-ic{border-color:#3a8a5c;color:#3a8a5c}.cost-checks li.warn .cost-ic{border-color:var(--gold);color:var(--ink);background:var(--bg)}
.cost-fine{font-size:12px;margin-top:10px}.cost-line{font-size:13px;color:var(--ink-2);margin-top:2px}.cost-edit{margin-top:12px}`;
    document.head.appendChild(st);
  }

  document.addEventListener("input", e => {
    if (!e.target.matches("[data-cost]")) return;
    const box = e.target.closest("#costBox"); if (!box) return;
    const dn = parseFloat((document.getElementById("costDown") || {}).value), rt = parseFloat((document.getElementById("costRate") || {}).value);
    if (isFinite(dn) && dn >= 0 && dn < 100) CU.inputs.down = dn; if (isFinite(rt) && rt >= 0 && rt < 25) CU.inputs.rate = rt;
    clearTimeout(CU.t); CU.t = setTimeout(() => rerender(box.dataset.costKey), 250);
  });
  document.addEventListener("click", e => {
    const el = e.target.closest("[data-cost-edit],[data-cost-save],[data-cost-cancel]"); if (!el) return;
    const box = el.closest("#costBox"), key = box && box.dataset.costKey;
    if (el.dataset.costEdit !== undefined) { CU.editing = el.dataset.costEdit; rerender(key); }
    else if (el.dataset.costSave !== undefined) save(el.dataset.costSave);
    else { CU.editing = null; rerender(key); }
  });
})();
