/* =========================================================================
   The Miller Group: homeowner portal (after closing).
   Client (their app):
     - Home value from their agent, with "Ask for an updated value"
     - Equity, from a loan they enter (it stays in their own account)
     - This month's Colorado home care, checked off as they go
     - Property tax due dates and the odd-year protest window
     - Their closing documents, and a monthly reminder email they control
   Agent ("Homeowners" panel):
     - Set up a portal for a past client (closed buyer deals shared in the
       app become portals automatically), update the value, add documents,
       and see value requests.
   Data: boards/<client>/home/<id>
   ========================================================================= */
(function () {
  const HO = window.Homeowner = { homes: {}, agentHomes: {}, subs: {}, watching: false, demo: {}, msg: {}, open: {} };
  const HC = () => window.HomeCare;
  const L = () => (window.I18N && I18N.lang) || "en";
  const t = (en, es) => L() === "es" ? es : en;
  const now = () => new Date().toISOString();
  const today = () => typeof localDay === "function" ? localDay() : new Date().toLocaleDateString("en-CA");
  const newId = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const usd = n => "$" + Math.round(n).toLocaleString("en-US");
  const httpsOk = u => /^https:\/\/[^\s"<>]+$/i.test(String(u || ""));
  const contact = id => (Store.crm.contacts || {})[id] || null;
  const cidOf = (c, cId) => c && (c.clientId || (Store.demo ? "demo-" + cId : ""));
  const fmt = d => d ? new Date(d + "T12:00:00").toLocaleDateString(L() === "es" ? "es-US" : "en-US", { month: "long", day: "numeric", year: "numeric" }) : "";
  const agentInfo = () => { const tm = (Store.team || {})[Store.crmOwner] || {}; return { name: tm.name || IDX.BROKER.name, phone: tm.phone || IDX.BROKER.phone, email: tm.email || "" }; };

  /* ------------------------------ Storage ------------------------------ */
  async function putHome(cid, id, h) {
    if (Store.demo || !Store.db) { HO.demo[id] = h ? { ...h, _cid: cid } : null; if (!h) delete HO.demo[id]; Store.emit(); return; }
    const ref = Store.db.doc(`boards/${cid}/home/${id}`);
    await Store.queue("ho:" + id, () => h ? ref.set(h) : ref.delete());
  }
  // Agent: watch the home docs of every client with an app account.
  function watchAgent() {
    if (Store.demo || !Store.db || !Store.isAgent) return;
    Object.entries(Store.crm.contacts || {}).forEach(([, c]) => {
      if (!c || !c.clientId || HO.subs[c.clientId]) return;
      HO.subs[c.clientId] = Store.db.collection(`boards/${c.clientId}/home`).onSnapshot(sn => { const m = {}; sn.docs.forEach(d => { m[d.id] = { ...d.data(), _cid: c.clientId }; }); HO.agentHomes[c.clientId] = m; Store.emit(); }, () => {});
    });
  }
  const agentList = () => Store.demo ? Object.entries(HO.demo).filter(([, h]) => h) : Object.values(HO.agentHomes).flatMap(m => Object.entries(m));
  HO.requests = () => agentList().filter(([, h]) => h.valueRequestAt && (!h.value || (h.value.at || "") < h.valueRequestAt)).length;

  // A closed buyer transaction shared in the app becomes a homeowner portal.
  let tm; if (typeof Store !== "undefined") Store.onChange(() => { if (!Store.isAgent || !window.Office) return; clearTimeout(tm); tm = setTimeout(autoCreate, 900); });
  function autoCreate() {
    Object.entries(Office.deals || {}).forEach(([id, d]) => {
      if (!d || d.status !== "closed" || d.side === "seller" || !d.shareClient || d.homeCreated) return;
      if (d.agentId !== (Store.demo ? Store.crmOwner : Store.uid)) return;
      const c = contact(d.contactId), cid = cidOf(c, d.contactId); if (!cid) return;
      const hid = "h" + id;
      putHome(cid, hid, baseHome(c, { address: d.address, purchasePrice: Number(d.price) || 0, purchaseDate: d.closeDate || "" }));
      const x = JSON.parse(JSON.stringify(d)); x.homeCreated = true; Office._t.saveDeal(id, x);
    });
  }
  function baseHome(c, o) {
    const a = agentInfo();
    return { address: o.address || "", city: o.city || "", type: o.type || "", year: o.year || "", sqft: o.sqft || "", lot: o.lot || "", purchasePrice: Number(o.purchasePrice) || 0, purchaseDate: o.purchaseDate || "",
      email: (c && c.email) || "", firstName: ((c && c.name) || "").split(" ")[0], lang: (c && c.lang) || "en", remind: !!(c && c.email && !c.doNotContact), agentId: Store.demo ? Store.crmOwner : Store.uid,
      agent: { name: a.name, phone: a.phone, email: a.email }, done: {}, docs: [], createdAt: now() };
  }

  /* ------------------------------ Agent panel ------------------------------ */
  HO.agentHTML = function () {
    watchAgent();
    const homes = agentList().sort((a, b) => (b[1].valueRequestAt || "").localeCompare(a[1].valueRequestAt || ""));
    const has = new Set(homes.map(([, h]) => h._cid));
    const eligible = Object.entries(Store.crm.contacts || {}).filter(([cId, c]) => c && (c.buyerStage === "closed" || c.purchaseDate) && cidOf(c, cId) && !has.has(cidOf(c, cId)));
    const noApp = Object.values(Store.crm.contacts || {}).filter(c => c && (c.buyerStage === "closed" || c.purchaseDate) && !c.clientId).length;
    let html = `<p class="addr">After closing, clients keep a portal for their home: the value you give them, their equity, Colorado home care each month, property tax dates and the protest window in odd years, and their documents. It’s the reason they open your app in year three.</p>`;
    html += homes.length ? homes.map(([id, h]) => {
      const s = HC().summary(h, today()), req = h.valueRequestAt && (!h.value || (h.value.at || "") < h.valueRequestAt), o = HO.open[id];
      return `<div class="pcard ${req ? "cg-flag" : ""}"><div class="pcard-top"><div><strong>${esc(h.address)}</strong><p>${esc(h.firstName || "")}${s.years != null ? ` · ${s.years < 1 ? "Under a year" : Math.floor(s.years) + (Math.floor(s.years) === 1 ? " year" : " years")}` : ""}${s.value ? ` · Value ${usd(s.value)} (${esc(fmt(s.valueDate))})` : " · No value sent yet"}${h.remind ? " · Monthly reminders on" : ""}${h.lang === "es" ? " · Español" : ""}</p></div>${req ? `<span class="cv-st">Value requested</span>` : ""}</div>
        <div class="quick"><button class="btn ${req ? "gold" : "ghost"} small" data-ho-open="${esc(id)}|value">Send a value</button><button class="btn ghost small" data-ho-open="${esc(id)}|doc">Add a document</button><button class="btn ghost small" data-ho-del="${esc(id)}">Remove</button></div>
        ${o === "value" ? `<div class="tourform"><div class="row2"><div><label for="hoV">Estimated value ($)</label><input id="hoV" inputmode="numeric" value="${s.value ? Math.round(s.value) : ""}"></div><div><label for="hoVd">As of</label><input id="hoVd" type="date" value="${esc(today())}"></div></div><label for="hoVn">Note to ${esc(h.firstName || "them")}</label><input id="hoVn" placeholder="e.g. Based on three sales on your street since spring"><p class="addr">Use your CMA. This shows as your estimate, not an appraisal.</p><div class="quick"><button class="btn gold" data-ho-value="${esc(id)}">Send</button></div></div>` : ""}
        ${o === "doc" ? `<div class="tourform"><label for="hoDt">Title</label><input id="hoDt" placeholder="e.g. Closing statement"><label for="hoDu">Link (https)</label><input id="hoDu" placeholder="Where the file is stored"><p class="addr">Only share links to the client’s own documents.</p><div class="quick"><button class="btn gold" data-ho-doc="${esc(id)}">Add</button></div><p class="msg">${esc(HO.msg[id] || "")}</p></div>` : ""}</div>`;
    }).join("") : `<div class="empty"><strong>No homeowner portals yet</strong>Set one up for a past client below. Shared buyer transactions become portals when they close.</div>`;
    if (eligible.length) html += `<h3 class="agent-h">Past clients with the app</h3>` + eligible.map(([cId, c]) => HO.open["new:" + cId] ? `<div class="pcard"><strong>${esc(c.name)}</strong><div class="tourform"><label for="hoA">Address</label><input id="hoA" value="${esc(c.listingAddress || "")}">
        <div class="row2"><div><label for="hoP">Purchase price ($)</label><input id="hoP" inputmode="numeric" value="${esc(String(c.salePrice || "").replace(/[^\d.KMkm]/g, ""))}"></div><div><label for="hoPd">Purchase date</label><input id="hoPd" type="date" value="${esc(c.purchaseDate || c.closeDate || "")}"></div></div>
        <div class="row2"><div><label for="hoTy">Home type</label><select id="hoTy"><option>Single Family Residence</option><option>Townhouse</option><option>Condominium</option></select></div><div><label for="hoLang">Language</label><select id="hoLang"><option value="en">English</option><option value="es" ${c.lang === "es" ? "selected" : ""}>Español</option></select></div></div>
        <div class="quick"><button class="btn gold" data-ho-create="${esc(cId)}">Set up portal</button><button class="btn ghost" data-ho-open="new:${esc(cId)}|">Cancel</button></div><p class="msg">${esc(HO.msg["new:" + cId] || "")}</p></div></div>`
      : `<div class="pcard"><div class="pcard-top"><div><strong>${esc(c.name)}</strong><p>${esc(c.listingAddress || c.area || "")}${c.purchaseDate ? ` · Bought ${esc(fmt(c.purchaseDate))}` : ""}</p></div><button class="btn ghost small" data-ho-open="new:${esc(cId)}|new">Set up</button></div></div>`).join("");
    if (noApp) html += `<p class="addr">${noApp} past ${noApp === 1 ? "client doesn’t" : "clients don’t"} have the app yet. Send them your home search link; once they sign in and you link their account on the contact, they show up here.</p>`;
    return html;
  };
  const parseAmt = v => { const s = String(v || "").trim().toUpperCase().replace(/[$,\s]/g, ""); const m = /^([\d.]+)([KM]?)$/.exec(s); if (!m) return 0; return +m[1] * (m[2] === "M" ? 1e6 : m[2] === "K" ? 1e3 : 1); };
  HO._parse = parseAmt;

  /* ------------------------------ Client view ------------------------------ */
  function watchClient() {
    if (HO.watching || Store.demo || !Store.db || Store.isAgent || !Store.uid) return; HO.watching = true;
    Store.db.collection(`boards/${Store.uid}/home`).onSnapshot(sn => { const m = {}; sn.docs.forEach(d => { m[d.id] = d.data(); }); HO.homes = m; Store.emit(); }, () => {});
  }
  const myHomes = () => Object.entries(Store.demo ? HO.demo : HO.homes).filter(([, h]) => h);
  HO.hasHome = () => myHomes().length > 0;
  HO.clientHTML = function () {
    if (Store.isAgent && !Store.demo) return "";
    watchClient();
    return myHomes().map(([id, h]) => {
      const d = today(), m = new Date(d + "T12:00:00").getMonth() + 1, s = HC().summary(h, d);
      const list = HC().tasks(h, m, L()), next = HC().tasks(h, m % 12 + 1, L()), notes = HC().taxNotes(d, L());
      const key = k => `${k}-${d.slice(0, 7)}`, done = h.done || {};
      const a = h.agent || {}, first = (a.name || t("your agent", "su agente")).split(" ")[0];
      const yrs = s.years == null ? "" : s.years < 1 ? t("Your first year", "Su primer año") : t(`${Math.floor(s.years)} ${Math.floor(s.years) === 1 ? "year" : "years"} in your home`, `${Math.floor(s.years)} ${Math.floor(s.years) === 1 ? "año" : "años"} en su casa`);
      const reqd = h.valueRequestAt && (!h.value || (h.value.at || "") < h.valueRequestAt);
      return `<section class="ho" aria-labelledby="hoH_${esc(id)}"><h3 class="agent-h" id="hoH_${esc(id)}">${t("Your home", "Su casa")}: ${esc(h.address)}</h3>${yrs ? `<p class="addr" style="margin-top:-6px">${esc(yrs)}</p>` : ""}
        <div class="ho-stats"><div><span>${t("Estimated value", "Valor estimado")}</span><b>${s.value ? usd(s.value) : "—"}</b><small>${s.value ? esc(t(`${first}’s estimate, ${fmt(s.valueDate)}`, `Estimado de ${first}, ${fmt(s.valueDate)}`)) : esc(t("Not estimated yet", "Aún sin estimar"))}</small></div>
          <div><span>${t("Equity", "Plusvalía")}</span><b>${s.equity != null ? usd(s.equity) : "—"}</b><small>${s.balance != null ? esc(t(`Loan balance about ${usd(s.balance)}`, `Saldo del préstamo aprox. ${usd(s.balance)}`)) : esc(t("Add your loan below", "Agregue su préstamo abajo"))}</small></div></div>
        ${h.value && h.value.note ? `<p class="cg-note"><strong>${esc(first)}:</strong> ${esc(h.value.note)}</p>` : ""}
        <div class="quick"><button class="btn ${reqd ? "ghost" : "gold"}" data-ho-ask="${esc(id)}" ${reqd ? "disabled" : ""}>${reqd ? t("Value requested", "Valor solicitado") : t("Ask for an updated value", "Pedir un valor actualizado")}</button><button class="btn ghost" data-ho-chat="sell">${t("Thinking of selling?", "¿Piensa vender?")}</button></div>
        ${notes.map(n => `<div class="ho-tax ${n.urgent ? "urgent" : ""}"><strong>${esc(n.title)}</strong><span>${esc(n.text)}</span>${n.key === "protest" ? `<button class="btn ghost small" data-ho-chat="protest">${t("Ask for comparable sales", "Pedir ventas comparables")}</button>` : ""}</div>`).join("")}
        <h4 class="cg-h">${t(`This month (${HC().MONTHS.en[m - 1]})`, `Este mes (${HC().MONTHS.es[m - 1]})`)}</h4>
        <ul class="ho-tasks">${list.map(x => `<li><label class="check"><input type="checkbox" data-ho-task="${esc(id)}|${esc(key(x.key))}" ${done[key(x.key)] ? "checked" : ""}> <span>${esc(x.text)}</span></label></li>`).join("") || `<li class="addr">${t("Nothing this month. Enjoy it.", "Nada este mes. Disfrútelo.")}</li>`}</ul>
        ${next.length ? `<details class="cg-doc"><summary>${t("Coming up next month", "El próximo mes")}</summary><ul class="ho-next">${next.map(x => `<li>${esc(x.text)}</li>`).join("")}</ul></details>` : ""}
        ${(h.docs || []).length ? `<h4 class="cg-h">${t("Your documents", "Sus documentos")}</h4><ul class="ho-docs">${h.docs.filter(x => httpsOk(x.url)).map(x => `<li><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title)}</a></li>`).join("")}</ul>` : ""}
        <details class="cg-doc" ${HO.open["loan:" + id] ? "open" : ""}><summary>${t("My mortgage (for equity)", "Mi hipoteca (para la plusvalía)")}</summary><div class="tourform">
          <div class="row2"><div><label for="hoLa_${esc(id)}">${t("Original loan ($)", "Préstamo original ($)")}</label><input id="hoLa_${esc(id)}" inputmode="numeric" value="${esc((h.loan || {}).amount || "")}"></div><div><label for="hoLr_${esc(id)}">${t("Rate (%)", "Tasa (%)")}</label><input id="hoLr_${esc(id)}" inputmode="decimal" value="${esc((h.loan || {}).rate || "")}"></div></div>
          <div class="row2"><div><label for="hoLt_${esc(id)}">${t("Term (years)", "Plazo (años)")}</label><input id="hoLt_${esc(id)}" inputmode="numeric" value="${esc((h.loan || {}).termYears || 30)}"></div><div><label for="hoLs_${esc(id)}">${t("First payment", "Primer pago")}</label><input id="hoLs_${esc(id)}" type="date" value="${esc((h.loan || {}).start || "")}"></div></div>
          <p class="addr">${t(`Stays in your account. ${first} can see it so they can help with refinance questions.`, `Se guarda en su cuenta. ${first} puede verlo para ayudarle con preguntas de refinanciamiento.`)}</p><div class="quick"><button class="btn gold" data-ho-loan="${esc(id)}">${t("Save", "Guardar")}</button></div></div></details>
        <label class="check ho-remind"><input type="checkbox" data-ho-remind="${esc(id)}" ${h.remind ? "checked" : ""}> ${t("Email me this checklist at the start of each month", "Enviarme esta lista por correo al inicio de cada mes")}</label>
        <p class="addr cg-fine">${t(`Values are ${first}’s estimate, not an appraisal. Home care tips are general; hire licensed pros for gas, electrical, and roof work.`, `Los valores son un estimado de ${first}, no un avalúo. Los consejos son generales; contrate profesionales con licencia para trabajos de gas, electricidad y techo.`)}</p></section>`;
    }).join("");
  };

  async function updateMine(id, fn) {
    const src = Store.demo ? HO.demo : HO.homes, h = JSON.parse(JSON.stringify(src[id] || {})); fn(h); h.updatedAt = now();
    if (Store.demo || !Store.db) { HO.demo[id] = h; Store.emit(); return; }
    HO.homes[id] = h; Store.emit();
    const { _cid, ...clean } = h;
    try { await Store.db.doc(`boards/${Store.uid}/home/${id}`).set(clean); } catch (e) { if (typeof toast === "function") toast(t("That didn’t save. Try again.", "No se guardó. Inténtelo de nuevo.")); }
  }
  async function updateAgent(id, fn) {
    const pair = agentList().find(([k]) => k === id); if (!pair) return;
    const h = JSON.parse(JSON.stringify(pair[1])), cid = h._cid; delete h._cid; fn(h); h.updatedAt = now();
    if (Store.demo) { HO.demo[id] = { ...h, _cid: cid }; Store.emit(); return; }
    await putHome(cid, id, h);
  }

  HO.seedDemo = function () {
    if (Object.keys(HO.demo).length) return;
    const y = new Date().getFullYear(), pd = `${y - 2}-03-14`;
    HO.demo.hdemo = { _cid: "demo-dct4", address: "1440 N Gaylord St", city: "Denver", type: "Single Family Residence", year: 1912, purchasePrice: 910000, purchaseDate: pd, email: "marcus@example.com", firstName: "Marcus", lang: "en", remind: true, agentId: "demo-broker",
      agent: { name: "Brandon Miller", phone: IDX.BROKER.phone }, value: { amount: 968000, date: `${y}-10-02`, at: `${y}-10-02T12:00:00Z`, note: "Two similar homes on Gaylord sold in September, both above $950K." },
      loan: { amount: 728000, rate: 6.375, termYears: 30, start: `${y - 2}-05-01` }, done: {}, docs: [{ title: "Closing statement", url: "https://example.com/docs/closing-statement.pdf" }, { title: "Home warranty", url: "https://example.com/docs/warranty.pdf" }], createdAt: now() };
  };

  if (Store.demo) HO.seedDemo();
  if (!document.getElementById("hoStyles")) {
    const st = document.createElement("style"); st.id = "hoStyles";
    st.textContent = `.ho{border:1px solid var(--line);border-radius:14px;padding:4px 14px 12px;margin:12px 0;background:var(--surface)}.ho-stats{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:8px 0}.ho-stats>div{background:var(--bg);border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;min-width:0}
.ho-stats span{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-2)}.ho-stats b{font-size:22px}.ho-stats small{color:var(--ink-2);font-size:12px}
.ho-tax{display:flex;flex-direction:column;gap:4px;border-left:4px solid var(--line);background:var(--bg);border-radius:8px;padding:8px 10px;margin:8px 0;font-size:14px}.ho-tax.urgent{border-left-color:var(--gold)}.ho-tax .btn{align-self:flex-start;margin-top:4px}
.ho-tasks,.ho-next,.ho-docs{list-style:none;padding:0;margin:0}.ho-tasks li{border-top:1px solid var(--line);padding:6px 0;font-size:14px}.ho-tasks .check{display:flex;gap:8px;align-items:flex-start}.ho-next li{font-size:14px;padding:3px 0;color:var(--ink-2)}.ho-docs li{padding:4px 0}.ho-remind{margin:10px 0;font-size:14px}`;
    document.head.appendChild(st);
  }

  const rerender = () => { if (typeof renderAgent === "function" && Store.isAgent && agentPanel === "homeowners") renderAgent(); else Store.emit(); };
  document.addEventListener("click", async e => {
    const el = e.target.closest("[data-ho-open],[data-ho-value],[data-ho-doc],[data-ho-del],[data-ho-create],[data-ho-ask],[data-ho-chat],[data-ho-loan]"); if (!el) return; const d = el.dataset;
    const val = id => (document.getElementById(id) || {}).value || "";
    if (d.hoOpen !== undefined) { const [id, what] = d.hoOpen.split("|"); HO.open[id] = HO.open[id] === what || !what ? null : what; rerender(); return; }
    if (d.hoValue) { const amt = parseAmt(val("hoV")); if (!amt) return; await updateAgent(d.hoValue, h => { h.value = { amount: amt, date: val("hoVd") || today(), note: val("hoVn").trim().slice(0, 300), at: now() }; }); HO.open[d.hoValue] = null; if (typeof toast === "function") toast("Value sent"); rerender(); return; }
    if (d.hoDoc) { const title = val("hoDt").trim(), url = val("hoDu").trim(); if (!title || !httpsOk(url)) { HO.msg[d.hoDoc] = "Add a title and an https link."; rerender(); return; } await updateAgent(d.hoDoc, h => { h.docs = (h.docs || []).concat({ title: title.slice(0, 120), url: url.slice(0, 500), at: now() }); }); HO.open[d.hoDoc] = null; HO.msg[d.hoDoc] = ""; rerender(); return; }
    if (d.hoDel) { if (!confirm("Remove this homeowner portal? The client won’t see it anymore.")) return; const pair = agentList().find(([k]) => k === d.hoDel); if (pair) await putHome(pair[1]._cid, d.hoDel, null); rerender(); return; }
    if (d.hoCreate) {
      const c = contact(d.hoCreate), cid = cidOf(c, d.hoCreate), address = val("hoA").trim();
      if (!address) { HO.msg["new:" + d.hoCreate] = "Add the address."; rerender(); return; }
      const h = baseHome({ ...c, lang: val("hoLang") }, { address, purchasePrice: parseAmt(val("hoP")), purchaseDate: val("hoPd"), type: val("hoTy") });
      await putHome(cid, newId("h"), h); HO.open["new:" + d.hoCreate] = null; if (typeof toast === "function") toast("Portal set up"); rerender(); return;
    }
    if (d.hoAsk) { await updateMine(d.hoAsk, h => { h.valueRequestAt = now(); }); if (Store.sendMessage && Store.uid && !Store.demo) Store.sendMessage(Store.uid, "client", t("Could you send me an updated value for my home?", "¿Me puede enviar un valor actualizado de mi casa?"), ""); if (typeof toast === "function") toast(t("Request sent", "Solicitud enviada")); return; }
    if (d.hoChat) { const msg = { sell: t("I’m starting to think about selling. Could we talk?", "Estoy pensando en vender. ¿Podemos hablar?"), protest: t("Could you send me comparable sales for my property tax appeal?", "¿Me puede enviar ventas comparables para apelar mi valor de impuestos?") }[d.hoChat]; if (typeof openClientChat === "function") openClientChat("", msg); return; }
    if (d.hoLoan) { const id = d.hoLoan, n = v => { const x = parseFloat(String(v).replace(/[$,]/g, "")); return isFinite(x) && x > 0 ? x : ""; };
      await updateMine(id, h => { h.loan = { amount: n(val("hoLa_" + id)), rate: n(val("hoLr_" + id)), termYears: n(val("hoLt_" + id)) || 30, start: val("hoLs_" + id) }; }); HO.open["loan:" + id] = false; return; }
  });
  document.addEventListener("change", e => {
    const d = e.target.dataset || {};
    if (d.hoTask) { const [id, k] = d.hoTask.split("|"), on = e.target.checked; updateMine(id, h => { h.done = h.done || {}; if (on) h.done[k] = today(); else delete h.done[k]; }); }
    else if (d.hoRemind) { const on = e.target.checked; updateMine(d.hoRemind, h => { h.remind = on; h.remindChangedAt = now(); }); }
  });
  HO._t = { agentList, autoCreate, myHomes };
})();
