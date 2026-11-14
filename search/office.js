/* =========================================================================
   The Miller Group — Office module for the agent tools.
   Loads after the main app script and uses its globals (Store, $, esc, money,
   short, renderAgent, contacts(), tasks() …).

   Back office:   Transactions + broker review, Company hub, My income,
                  Referrals, Follow-up emails, Partners, Brand library, Recruiting
   Agent tools:   Setup checklist, Contact import, Matching clients (reverse
                  prospecting), Likely to sell, Folders

   Data:
     deals/<id>                          transactions (agent sees own, broker all)
     company/plan, company/settings      commission plan, connections (broker edits)
     company/hub|partners|brand/items/*  shared office content (agents read, broker edits)
     agent/<uid>/crm/{referrals,expenses,recruits,emaillog}
   ========================================================================= */
(function () {
  const O = window.Office = {
    deals: {}, hub: {}, partners: {}, brand: {}, plan: {}, conn: {},
    watching: false, contactFolder: "", dealFolder: "", importRows: null, rp: { key: "", text: "" }, sending: ""
  };
  const newId = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const nowIso = () => new Date().toISOString();
  const yr = () => String(new Date().getFullYear());
  const S = () => Store.settings || {};
  const me = () => Store.crmOwner || Store.uid || "local";
  const isBroker = () => !!Store.isBroker;
  const C = window.MG_CONFIG || {};
  const firstName = n => String(n || "").trim().split(/\s+/)[0] || "";
  const opt = (list, val) => list.map(([v, t]) => `<option value="${esc(v)}" ${String(val) === String(v) ? "selected" : ""}>${esc(t)}</option>`).join("");
  const sheet = (title, body) => { $("#formBody").innerHTML = `<div class="sheettop"><h2>${esc(title)}</h2><button class="close" data-close aria-label="Close">×</button></div>${body}`; if (!$("#dlgForm").open) $("#dlgForm").showModal(); };
  const closeSheet = () => { if ($("#dlgForm").open) $("#dlgForm").close(); };
  const val = id => { const e = document.getElementById(id); return e ? (e.type === "checkbox" ? e.checked : String(e.value).trim()) : ""; };
  const daysUntil = d => d ? Math.round((new Date(d + "T12:00") - new Date(localDay() + "T12:00")) / 864e5) : null;
  const md = d => String(d || "").slice(5, 10);

  /* ---------- storage ---------- */
  function put(path, data) {
    if (!Store.db || Store.demo) return Promise.resolve();
    const ref = Store.db.doc(path);
    return Store.queue("o:" + path, () => data ? ref.set(data) : ref.delete());
  }
  function sub(path, key, cb) {
    Store.db.collection(path).onSnapshot(sn => { const m = {}; sn.docs.forEach(d => { m[d.id] = d.data(); }); O[key] = m; cb && cb(); Store.emit(); }, () => {});
  }
  O.watch = function () {
    if (O.watching) return; O.watching = true;
    ["referrals", "expenses", "recruits", "emaillog", "scripts"].forEach(k => { Store.crm[k] = Store.crm[k] || {}; });
    if (!Store.db) return;
    ["referrals", "expenses", "recruits", "emaillog", "scripts"].forEach(k => Store.db.collection(`agent/${Store.crmOwner}/crm/${k}`).onSnapshot(sn => {
      const m = {}; sn.docs.forEach(d => { m[d.id] = d.data(); }); Store.crm[k] = m; Store.emit();
    }, () => {}));
    sub("deals", "deals");
    ["hub", "partners", "brand"].forEach(k => sub(`company/${k}/items`, k));
    Store.db.doc("company/plan").onSnapshot(d => { O.plan = d.exists ? d.data() : {}; Store.emit(); }, () => {});
    Store.db.doc("company/settings").onSnapshot(d => { O.conn = d.exists ? d.data() : {}; Store.emit(); }, () => {});
  };
  ["referrals", "expenses", "recruits", "emaillog", "scripts"].forEach(k => { if (typeof Store !== "undefined" && Store.crm) Store.crm[k] = Store.crm[k] || {}; });
  const crm = k => Object.entries(Store.crm[k] || {}).filter(([, v]) => v).map(([id, v]) => ({ id, ...v }));
  function saveDeal(id, d) {
    id = id || newId("d");
    if (d) { d.agentId = d.agentId || me(); d.updatedAt = nowIso(); O.deals[id] = d; } else delete O.deals[id];
    Store.emit(); put(`deals/${id}`, d); return id;
  }
  function saveCompany(kind, id, d) {
    id = id || newId(kind[0]);
    if (d) O[kind][id] = { ...d, updatedAt: nowIso() }; else delete O[kind][id];
    Store.emit(); put(`company/${kind}/items/${id}`, d ? O[kind][id] : null); return id;
  }
  function saveCompanyDoc(name, patch) {
    const key = name === "plan" ? "plan" : "conn";
    O[key] = { ...O[key], ...patch, updatedAt: nowIso() }; Store.emit();
    put(`company/${name}`, O[key]);
  }
  const markSetting = (k, v = true) => { if (!S()[k]) Store.saveSettings({ [k]: v }); };

  /* ===================================================================
     1. TRANSACTIONS + BROKER REVIEW
     =================================================================== */
  const DEAL_STATUS = [["active", "Active"], ["pending", "Under contract"], ["closed", "Closed"], ["fell", "Fell through"]];
  const SIDES = [["buyer", "Buyer side"], ["seller", "Listing side"], ["both", "Both sides"], ["lease", "Lease"]];
  const REVIEW = { none: "Not submitted", submitted: "Waiting on broker", changes: "Changes requested", approved: "Approved" };
  // Typical Colorado contract dates. Every date comes from the signed contract; nothing is calculated.
  const DEADLINES = ["Earnest money due", "Record title deadline", "Off-record title deadline", "Seller’s property disclosure deadline", "Inspection objection deadline", "Inspection resolution deadline", "Loan application deadline", "Loan terms deadline", "Appraisal deadline", "Loan conditions deadline", "Closing date", "Possession date"];
  const DOCS = ["Executed contract to buy and sell", "Earnest money receipt", "Brokerage relationship disclosure", "Seller’s property disclosure", "Lead-based paint disclosure (homes built before 1978)", "Square footage disclosure", "Inspection objection and resolution", "Appraisal", "Signed closing statement", "Commission disbursement authorization"];
  const myDeals = () => Object.entries(O.deals).filter(([, d]) => d && d.agentId === me()).map(([id, d]) => ({ id, ...d }));
  const dealGCI = d => { const p = parseMoney(d.price); const amt = parseMoney(d.commissionAmount); return amt || p * (Number(d.commissionPct ?? S().commissionRate ?? 2.5) / 100); };
  function upcomingDeadlines(days = 7) {
    const out = [];
    myDeals().filter(d => d.status === "pending" || d.status === "active").forEach(d => (d.deadlines || []).forEach((x, i) => {
      if (!x.date || x.done) return; const n = daysUntil(x.date);
      if (n !== null && n <= days) out.push({ d, x, i, n });
    }));
    return out.sort((a, b) => a.n - b.n);
  }
  function dealsHTML() {
    const ds = myDeals().filter(d => !O.dealFolder || (d.folders || []).includes(O.dealFolder)).sort((a, b) => (a.closeDate || "9999").localeCompare(b.closeDate || "9999"));
    const due = upcomingDeadlines(7);
    let html = `<div class="quick"><button class="btn gold" data-o-newdeal>New transaction</button>${O.conn.esignUrl ? `<a class="btn ghost" style="text-align:center;text-decoration:none" href="${esc(O.conn.esignUrl)}" target="_blank" rel="noopener">${esc(O.conn.esignName || "eSign")}</a>` : ""}</div>`;
    html += foldersStrip(myDeals(), "deal");
    if (due.length) html += `<div class="stage-h">Deadlines this week<span>${due.length}</span></div>` + due.map(({ d, x, n }) => `<button class="notif ${n < 0 ? "fresh" : ""}" data-panel="o-deal:${d.id}"><strong>${esc(x.label)}</strong> · ${esc(d.address)}<time>${n < 0 ? `Overdue ${-n} ${-n === 1 ? "day" : "days"}` : n === 0 ? "Today" : `In ${n} ${n === 1 ? "day" : "days"}`} · ${dayLabel(x.date)}</time></button>`).join("");
    if (!ds.length) return html + `<div class="empty"><strong>No transactions yet</strong>Add a deal when a contract is signed to track its dates, documents, and broker review.</div>`;
    DEAL_STATUS.forEach(([s, t]) => {
      const list = ds.filter(d => (d.status || "active") === s); if (!list.length) return;
      html += `<div class="stage-h">${t}<span>${list.length}</span></div>` + list.map(d => {
        const docs = d.docs || [], done = docs.filter(x => x.done).length;
        const next = (d.deadlines || []).filter(x => x.date && !x.done).sort((a, b) => a.date.localeCompare(b.date))[0];
        return `<div class="pcard"><div class="pcard-top"><div><strong>${esc(d.address || "Untitled deal")}</strong><p>${esc(d.clientName || "")}${d.clientName ? " · " : ""}${esc((SIDES.find(x => x[0] === d.side) || SIDES[0])[1])}${d.price ? " · " + short(parseMoney(d.price)) : ""}</p>
          <p>${done}/${docs.length} documents · ${esc(REVIEW[(d.review || {}).state || "none"])}${next ? ` · Next: ${esc(next.label)} ${dayLabel(next.date)}` : ""}</p></div></div>
          <div class="links"><button data-panel="o-deal:${d.id}">Open</button></div></div>`;
      }).join("");
    });
    return html;
  }
  function openDealForm(id, preset = {}) {
    const d = id ? { ...O.deals[id] } : { side: "buyer", status: "pending", commissionPct: S().commissionRate ?? 2.5, ...preset };
    const cs = contacts();
    sheet(id ? "Edit transaction" : "New transaction", `<form id="oDealForm">
      <label for="dAddr">Property address</label><input id="dAddr" required value="${esc(d.address || "")}">
      <div class="row2"><div><label for="dSide">Side</label><select id="dSide">${opt(SIDES, d.side)}</select></div><div><label for="dStatus">Status</label><select id="dStatus">${opt(DEAL_STATUS, d.status)}</select></div></div>
      <label for="dContact">Client</label><select id="dContact"><option value="">Not in contacts</option>${cs.map(c => `<option value="${esc(c.id)}" ${d.contactId === c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select>
      <label for="dClient">Client name on the contract</label><input id="dClient" value="${esc(d.clientName || "")}">
      <div class="row2"><div><label for="dPrice">Contract price</label><input id="dPrice" inputmode="decimal" placeholder="$650K" value="${esc(d.price ? short(parseMoney(d.price)) : "")}"></div><div><label for="dPct">Commission (%)</label><input id="dPct" inputmode="decimal" value="${esc(d.commissionPct ?? "")}"></div></div>
      <div class="row2"><div><label for="dContract">Contract date</label><input id="dContract" type="date" value="${esc(d.contractDate || "")}"></div><div><label for="dClose">Closing date</label><input id="dClose" type="date" value="${esc(d.closeDate || "")}"></div></div>
      <label for="dRef">Referral fee paid out (%)</label><input id="dRef" inputmode="decimal" placeholder="0" value="${esc(d.referralPct || "")}">
      <label for="dFolders">Folders</label><input id="dFolders" placeholder="Spring sellers, Relocation" value="${esc((d.folders || []).join(", "))}">
      <label for="dNotes">Notes</label><textarea id="dNotes" rows="3">${esc(d.notes || "")}</textarea>
      <div class="actions"><button class="btn gold" type="submit">Save</button>${id ? `<button class="btn ghost" type="button" data-o-deldeal="${id}">Delete</button>` : ""}</div></form>`);
    $("#dContact").addEventListener("change", e => { const c = Store.crm.contacts[e.target.value]; if (c && !$("#dClient").value) $("#dClient").value = c.name; });
    $("#oDealForm").addEventListener("submit", e => {
      e.preventDefault();
      const out = { ...d, address: val("dAddr"), side: val("dSide"), status: val("dStatus"), contactId: val("dContact"), clientName: val("dClient"),
        price: parseMoney(val("dPrice")) || "", commissionPct: parseFloat(val("dPct")) || 0, contractDate: val("dContract"), closeDate: val("dClose"),
        referralPct: parseFloat(val("dRef")) || 0, folders: splitList(val("dFolders")), notes: val("dNotes"), createdAt: d.createdAt || nowIso() };
      if (!out.deadlines) out.deadlines = DEADLINES.map(label => ({ label, date: label === "Closing date" ? out.closeDate : "", done: false }));
      else out.deadlines = out.deadlines.map(x => x.label === "Closing date" && !x.date ? { ...x, date: out.closeDate } : x);
      if (!out.docs) out.docs = DOCS.map(label => ({ label, done: false, url: "" }));
      if (!out.review) out.review = { state: "none" };
      const nid = saveDeal(id, out); closeSheet();
      if (!id) { agentPanel = "o-deal:" + nid; renderAgent(); }
    });
  }
  function dealHTML(id) {
    const d = O.deals[id], back = `<button class="back" data-panel="o-deals">‹ Transactions</button>`;
    if (!d) return back + `<div class="empty"><strong>Transaction not found</strong>It may have been deleted.</div>`;
    const rv = d.review || { state: "none" }, mine = d.agentId === me();
    const agentName = (Store.team[d.agentId] || {}).name || "";
    const gci = dealGCI(d), fee = brokerFee(d), ref = gci * (Number(d.referralPct || 0) / 100);
    return `${back}<div class="colhead"><h2>${esc(d.address)}</h2><button class="btn ghost" data-o-editdeal="${id}">Edit</button></div>
      <p class="addr">${esc(d.clientName || "")}${agentName && !mine ? ` · Agent: ${esc(agentName)}` : ""} · ${esc((SIDES.find(x => x[0] === d.side) || SIDES[0])[1])} · ${esc((DEAL_STATUS.find(x => x[0] === d.status) || DEAL_STATUS[0])[1])}${d.price ? " · " + money(parseMoney(d.price)) : ""}</p>
      <div class="stats"><div><b>${short(gci)}</b><span>Commission</span></div><div><b>${short(fee)}</b><span>Brokerage fees</span></div><div><b>${short(ref)}</b><span>Referral out</span></div><div><b>${short(gci - fee - ref)}</b><span>Your net</span></div></div>
      <div class="cmares"><p>Broker review</p><b style="font-size:24px">${esc(REVIEW[rv.state] || REVIEW.none)}</b>${rv.note ? `<p>“${esc(rv.note)}”</p>` : ""}
        <div class="quick" style="margin:10px 0 0">${mine && rv.state !== "submitted" && rv.state !== "approved" ? `<button class="btn gold" data-o-submit="${id}">Submit for review</button>` : ""}
        ${isBroker() && rv.state === "submitted" ? `<button class="btn gold" data-o-approve="${id}">Approve</button><button class="btn ghost" data-o-changes="${id}">Request changes</button>` : ""}
        ${O.conn.esignUrl ? `<a class="btn ghost" style="text-align:center;text-decoration:none" href="${esc(O.conn.esignUrl)}" target="_blank" rel="noopener">Open ${esc(O.conn.esignName || "eSign")}</a>` : ""}</div></div>
      <h3 class="agent-h">Contract dates</h3><p class="addr">Enter each date exactly as written in the signed contract.</p>
      ${(d.deadlines || []).map((x, i) => { const n = daysUntil(x.date); return `<div class="task ${x.done ? "done" : ""} ${!x.done && n !== null && n < 0 ? "overdue" : ""}"><input type="checkbox" data-o-dl="${id}|${i}" ${x.done ? "checked" : ""} aria-label="Mark ${esc(x.label)} done">
        <div class="tt"><span>${esc(x.label)}</span><p>${x.date ? `${dayLabel(x.date)}${!x.done && n < 0 ? " · Overdue" : ""}` : "No date"}</p></div><input type="date" style="width:150px;padding:6px;border:1px solid var(--line);border-radius:8px;background:var(--bg)" aria-label="Date for ${esc(x.label)}" data-o-dldate="${id}|${i}" value="${esc(x.date || "")}"></div>`; }).join("")}
      <div class="quick" style="margin-top:6px"><button class="btn ghost small" data-o-adddl="${id}">Add a date</button></div>
      <h3 class="agent-h">Documents</h3><p class="addr">Check each item off once it’s in the file. Paste a link to where the signed copy is stored.</p>
      ${(d.docs || []).map((x, i) => `<div class="task ${x.done ? "done" : ""}"><input type="checkbox" data-o-doc="${id}|${i}" ${x.done ? "checked" : ""} aria-label="${esc(x.label)} received">
        <div class="tt"><span>${esc(x.label)}</span>${x.url ? `<p><a href="${esc(x.url)}" target="_blank" rel="noopener">Open document</a></p>` : ""}</div><input style="width:150px;padding:6px;border:1px solid var(--line);border-radius:8px;background:var(--bg)" placeholder="Link" aria-label="Link for ${esc(x.label)}" data-o-docurl="${id}|${i}" value="${esc(x.url || "")}"></div>`).join("")}
      <div class="quick" style="margin-top:6px"><button class="btn ghost small" data-o-adddoc="${id}">Add a document</button></div>
      ${d.notes ? `<h3 class="agent-h">Notes</h3><p class="remarks">${esc(d.notes)}</p>` : ""}`;
  }
  function editDeal(id, fn) { const d = structuredClone(O.deals[id]); if (!d) return; fn(d); saveDeal(id, d); }
  function reviewHTML() {
    const list = Object.entries(O.deals).filter(([, d]) => d && (d.review || {}).state === "submitted").map(([id, d]) => ({ id, ...d }));
    const recent = Object.entries(O.deals).filter(([, d]) => d && ["approved", "changes"].includes((d.review || {}).state)).sort((a, b) => (b[1].review.at || "").localeCompare(a[1].review.at || "")).slice(0, 10);
    const card = (id, d) => { const docs = d.docs || []; return `<div class="pcard"><div class="pcard-top"><div><strong>${esc(d.address)}</strong><p>${esc((Store.team[d.agentId] || {}).name || "Agent")} · ${docs.filter(x => x.done).length}/${docs.length} documents · ${esc(REVIEW[(d.review || {}).state])}</p></div></div><div class="links"><button data-panel="o-deal:${id}">Review</button></div></div>`; };
    return (list.length ? `<div class="stage-h">Waiting on you<span>${list.length}</span></div>` + list.map(d => card(d.id, d)).join("") : `<div class="empty"><strong>Nothing to review</strong>Transactions agents submit show up here.</div>`) +
      (recent.length ? `<div class="stage-h">Recently reviewed<span>${recent.length}</span></div>` + recent.map(([id, d]) => card(id, d)).join("") : "");
  }

  /* ===================================================================
     2. COMPANY HUB  (announcements, policies, forms, links, plan, eSign)
     =================================================================== */
  const HUB_TYPES = [["announcement", "Announcement"], ["policy", "Policy"], ["form", "Form or template"], ["training", "Training"], ["link", "Link"]];
  function hubHTML() {
    const items = Object.entries(O.hub).filter(([, x]) => x).map(([id, x]) => ({ id, ...x })).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.createdAt || "").localeCompare(a.createdAt || ""));
    const read = S().readItems || {};
    let html = isBroker() ? `<div class="quick"><button class="btn gold" data-o-newhub>Add to hub</button><button class="btn ghost" data-o-plan>Commission plan</button><button class="btn ghost" data-o-conn>Connections</button></div>` : "";
    html += planCardHTML();
    if (!items.length) return html + `<div class="empty"><strong>Nothing here yet</strong>${isBroker() ? "Add your policy manual, contracts, forms, and announcements." : "Your broker will post policies, forms, and announcements here."}</div>`;
    HUB_TYPES.forEach(([t, label]) => {
      const list = items.filter(x => x.type === t); if (!list.length) return;
      html += `<div class="stage-h">${label}s<span>${list.length}</span></div>` + list.map(x => `<div class="pcard"><div class="pcard-top"><div><strong>${x.pinned ? "📌 " : ""}${esc(x.title)}</strong>${x.body ? `<p style="white-space:pre-wrap">${esc(x.body)}</p>` : ""}<p>${when(x.createdAt)}${x.mustRead ? (read[x.id] ? " · Read" : " · Please read") : ""}</p></div></div>
        <div class="links">${x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">Open</a>` : ""}${x.mustRead && !read[x.id] ? `<button data-o-read="${x.id}">Mark as read</button>` : ""}${isBroker() ? `<button data-o-edithub="${x.id}">Edit</button>` : ""}</div></div>`).join("");
    });
    return html;
  }
  function planCardHTML() {
    const p = O.plan;
    if (!p.name && !p.flatFee) return isBroker() ? `<p class="note-c">Set your commission plan so agents see their fees and net income.</p>` : "";
    return `<div class="cmares"><p>Commission plan</p><b style="font-size:24px">${esc(p.name || "Flat fee plan")}</b><p>${p.flatFee ? `${money(p.flatFee)} per transaction` : ""}${p.eoFee ? ` · ${money(p.eoFee)} E&O` : ""}${p.monthlyFee ? ` · ${money(p.monthlyFee)}/month` : ""}${p.cap ? ` · Fees cap at ${money(p.cap)} a year` : ""}</p>${p.notes ? `<p>${esc(p.notes)}</p>` : ""}</div>`;
  }
  function openHubForm(id) {
    const x = id ? { ...O.hub[id] } : { type: "announcement" };
    sheet(id ? "Edit item" : "Add to hub", `<form id="oHubForm"><label for="hType">Type</label><select id="hType">${opt(HUB_TYPES, x.type)}</select>
      <label for="hTitle">Title</label><input id="hTitle" required value="${esc(x.title || "")}">
      <label for="hBody">Text</label><textarea id="hBody" rows="4">${esc(x.body || "")}</textarea>
      <label for="hUrl">Link to the document (Google Drive, Dropbox, etc.)</label><input id="hUrl" type="url" value="${esc(x.url || "")}">
      <label class="check"><input type="checkbox" id="hPin" ${x.pinned ? "checked" : ""}> Pin to the top</label>
      <label class="check"><input type="checkbox" id="hMust" ${x.mustRead ? "checked" : ""}> Agents must mark this read</label>
      <div class="actions"><button class="btn gold" type="submit">Save</button>${id ? `<button class="btn ghost" type="button" data-o-delhub="${id}">Delete</button>` : ""}</div></form>`);
    $("#oHubForm").addEventListener("submit", e => { e.preventDefault(); saveCompany("hub", id, { ...x, type: val("hType"), title: val("hTitle"), body: val("hBody"), url: val("hUrl"), pinned: val("hPin"), mustRead: val("hMust"), createdAt: x.createdAt || nowIso() }); closeSheet(); });
  }
  function openPlanForm() {
    const p = O.plan;
    sheet("Commission plan", `<form id="oPlanForm"><label for="pnName">Plan name</label><input id="pnName" placeholder="Flat fee, 100% commission" value="${esc(p.name || "")}">
      <div class="row2"><div><label for="pnFee">Fee per transaction</label><input id="pnFee" inputmode="decimal" placeholder="$495" value="${esc(p.flatFee || "")}"></div><div><label for="pnEo">E&O fee per transaction</label><input id="pnEo" inputmode="decimal" value="${esc(p.eoFee || "")}"></div></div>
      <div class="row2"><div><label for="pnMonth">Monthly fee</label><input id="pnMonth" inputmode="decimal" value="${esc(p.monthlyFee || "")}"></div><div><label for="pnCap">Yearly fee cap</label><input id="pnCap" inputmode="decimal" placeholder="Optional" value="${esc(p.cap || "")}"></div></div>
      <label for="pnNotes">Notes for agents</label><textarea id="pnNotes" rows="3">${esc(p.notes || "")}</textarea>
      <div class="actions"><button class="btn gold" type="submit">Save plan</button></div></form>`);
    $("#oPlanForm").addEventListener("submit", e => { e.preventDefault(); saveCompanyDoc("plan", { name: val("pnName"), flatFee: parseMoney(val("pnFee")), eoFee: parseMoney(val("pnEo")), monthlyFee: parseMoney(val("pnMonth")), cap: parseMoney(val("pnCap")), notes: val("pnNotes") }); closeSheet(); });
  }
  function openConnForm() {
    const c = O.conn;
    sheet("Connections", `<form id="oConnForm"><p class="addr">Links every agent sees. Signing stays in your eSign service; this puts it one tap away from each transaction.</p>
      <label for="cnEsName">eSign service name</label><input id="cnEsName" placeholder="Your association’s eSign" value="${esc(c.esignName || "")}">
      <label for="cnEsUrl">eSign sign-in link</label><input id="cnEsUrl" type="url" value="${esc(c.esignUrl || "")}">
      <label for="cnMls">MLS sign-in link</label><input id="cnMls" type="url" placeholder="https://www.recolorado.com" value="${esc(c.mlsUrl || "")}">
      <label for="cnTrain">Training link</label><input id="cnTrain" type="url" placeholder="The Road to Closed" value="${esc(c.trainingUrl || "")}">
      <div class="actions"><button class="btn gold" type="submit">Save</button></div></form>`);
    $("#oConnForm").addEventListener("submit", e => { e.preventDefault(); saveCompanyDoc("settings", { esignName: val("cnEsName"), esignUrl: val("cnEsUrl"), mlsUrl: val("cnMls"), trainingUrl: val("cnTrain") }); closeSheet(); });
  }

  /* ===================================================================
     3. MY INCOME
     =================================================================== */
  function brokerFee(d) { const p = O.plan || {}; return Number(p.flatFee || 0) + Number(p.eoFee || 0); }
  function incomeStats(agentId) {
    const y = yr();
    const closed = Object.entries(O.deals).filter(([, d]) => d && d.agentId === agentId && d.status === "closed" && (d.closeDate || "").startsWith(y)).map(([id, d]) => ({ id, ...d })).sort((a, b) => (a.closeDate || "").localeCompare(b.closeDate || ""));
    let fees = 0; const cap = Number((O.plan || {}).cap || 0);
    const rows = closed.map(d => { const g = dealGCI(d); let f = brokerFee(d); if (cap) { f = Math.max(0, Math.min(f, cap - fees)); } fees += f; const r = g * (Number(d.referralPct || 0) / 100); return { d, g, f, r, net: g - f - r }; });
    const monthsSoFar = new Date().getMonth() + 1, monthly = Number((O.plan || {}).monthlyFee || 0) * monthsSoFar;
    const exp = agentId === me() ? crm("expenses").filter(x => (x.date || "").startsWith(y)) : [];
    const sum = (a, k) => a.reduce((t, x) => t + (Number(x[k]) || 0), 0);
    const gross = sum(rows, "g"), fee = sum(rows, "f") + monthly, ref = sum(rows, "r"), expenses = exp.reduce((t, x) => t + parseMoney(x.amount), 0);
    return { rows, gross, fee, monthly, ref, net: gross - fee - ref, expenses, exp, after: gross - fee - ref - expenses };
  }
  function incomeHTML() {
    const s = incomeStats(me());
    const card = (n, t) => `<div><b>${short(n)}</b><span>${t}</span></div>`;
    let html = `<p class="addr">${yr()} so far, from closed transactions${O.plan.name ? ` and the ${esc(O.plan.name)} plan` : ""}. This is a record for your books, not a statement of payment.</p>
      <div class="stats">${card(s.gross, "Gross commission")}${card(s.fee, "Brokerage fees")}${card(s.net, "Net income")}${card(s.after, "After expenses")}</div>
      <div class="quick"><button class="btn gold" data-o-newexp>Add expense</button><button class="btn ghost" data-o-incomecsv>Download CSV</button></div>`;
    html += `<h3 class="agent-h">Closings</h3>` + (s.rows.length ? `<div class="scroll"><table class="mtable"><thead><tr><th>Property</th><th>Closed</th><th>Commission</th><th>Fees</th><th>Referral</th><th>Net</th></tr></thead><tbody>${s.rows.map(r => `<tr><td>${esc(r.d.address)}</td><td>${esc(r.d.closeDate || "")}</td><td>${short(r.g)}</td><td>${short(r.f)}</td><td>${short(r.r)}</td><td>${short(r.net)}</td></tr>`).join("")}</tbody></table></div>` : `<p class="addr">No closed transactions this year yet.</p>`);
    if (s.monthly) html += `<p class="addr">Includes ${money(s.monthly)} in monthly fees so far.</p>`;
    html += `<h3 class="agent-h">Expenses</h3>` + (s.exp.length ? s.exp.sort((a, b) => (b.date || "").localeCompare(a.date || "")).map(x => `<div class="pcard"><div class="pcard-top"><div><strong>${money(parseMoney(x.amount))} · ${esc(x.category || "Other")}</strong><p>${esc(x.date || "")}${x.note ? " · " + esc(x.note) : ""}</p></div><button class="remove" data-o-delexp="${x.id}">Delete</button></div></div>`).join("") : `<p class="addr">No expenses logged this year.</p>`);
    if (isBroker()) {
      const ids = [...new Set(Object.values(O.deals).filter(Boolean).map(d => d.agentId))];
      const per = ids.map(id => ({ id, s: incomeStats(id) }));
      html += `<h3 class="agent-h">Brokerage (broker only)</h3><p class="addr">Fees collected from every agent’s closings this year: <strong>${money(per.reduce((t, x) => t + x.s.fee, 0))}</strong></p>` +
        `<div class="scroll"><table class="mtable"><thead><tr><th>Agent</th><th>Closings</th><th>Volume</th><th>Fees</th></tr></thead><tbody>${per.map(x => `<tr><td>${esc((Store.team[x.id] || {}).name || "Agent")}</td><td>${x.s.rows.length}</td><td>${short(x.s.rows.reduce((t, r) => t + parseMoney(r.d.price), 0))}</td><td>${short(x.s.fee)}</td></tr>`).join("")}</tbody></table></div>`;
    }
    return html;
  }
  const EXP_CATS = ["Marketing", "MLS and association dues", "Licensing and education", "Vehicle and mileage", "Phone and software", "Client gifts", "Signs and supplies", "Other"];
  function openExpenseForm() {
    sheet("Add expense", `<form id="oExpForm"><div class="row2"><div><label for="eAmt">Amount</label><input id="eAmt" required inputmode="decimal" placeholder="$120"></div><div><label for="eDate">Date</label><input id="eDate" type="date" value="${localDay()}"></div></div>
      <label for="eCat">Category</label><select id="eCat">${opt(EXP_CATS.map(c => [c, c]), "Marketing")}</select>
      <label for="eNote">Note</label><input id="eNote"><div class="actions"><button class="btn gold" type="submit">Save</button></div></form>`);
    $("#oExpForm").addEventListener("submit", e => { e.preventDefault(); Store.saveCrm("expenses", null, { amount: parseMoney(val("eAmt")), date: val("eDate"), category: val("eCat"), note: val("eNote"), createdAt: nowIso() }); closeSheet(); });
  }
  async function incomeCSV() {
    const s = incomeStats(me());
    const rows = [["Type", "Property or category", "Date", "Commission", "Brokerage fees", "Referral", "Net or amount"],
      ...s.rows.map(r => ["Closing", r.d.address, r.d.closeDate, Math.round(r.g), Math.round(r.f), Math.round(r.r), Math.round(r.net)]),
      ...s.exp.map(x => ["Expense", x.category, x.date, "", "", "", -parseMoney(x.amount)])];
    await saveCSV(`income-${yr()}.csv`, rows);
  }
  async function saveCSV(name, rows) {
    const csv = rows.map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    try { const dl = await window.claude?.use?.("downloads"); if (dl) await dl.save({ filename: name, data: csv }); } catch (e) {}
  }

  /* ===================================================================
     4. REFERRALS
     =================================================================== */
  const REF_STATUS = [["sent", "Sent"], ["accepted", "Accepted"], ["contract", "Under contract"], ["closed", "Closed"], ["paid", "Fee paid"], ["lost", "Didn’t close"]];
  function referralsHTML() {
    const rs = crm("referrals").sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    const open = r => !["paid", "lost"].includes(r.status);
    const owedIn = rs.filter(r => r.direction === "out" && open(r)).reduce((t, r) => t + parseMoney(r.expectedFee), 0);
    const owedOut = rs.filter(r => r.direction === "in" && open(r)).reduce((t, r) => t + parseMoney(r.expectedFee), 0);
    let html = `<p class="addr">Referral fees in Colorado are paid broker to broker under a written agreement, never to an unlicensed person.</p>
      <div class="stats"><div><b>${short(owedIn)}</b><span>Owed to you</span></div><div><b>${short(owedOut)}</b><span>You owe</span></div><div><b>${rs.filter(r => r.direction === "out").length}</b><span>Sent out</span></div><div><b>${rs.filter(r => r.direction === "in").length}</b><span>Received</span></div></div>
      <div class="quick"><button class="btn gold" data-o-newref>New referral</button></div>`;
    if (!rs.length) return html + `<div class="empty"><strong>No referrals yet</strong>Track clients you send to other agents, and ones they send you.</div>`;
    return html + rs.map(r => `<div class="pcard"><div class="pcard-top"><div><strong>${esc(r.client || "Client")} · ${r.direction === "out" ? "sent to" : "from"} ${esc(r.agent || "agent")}</strong><p>${esc(r.brokerage || "")}${r.market ? " · " + esc(r.market) : ""} · ${r.feePct ? r.feePct + "% fee" : ""}${r.expectedFee ? " · " + money(parseMoney(r.expectedFee)) : ""}</p></div>
      <select data-o-refstatus="${r.id}" aria-label="Status">${opt(REF_STATUS, r.status)}</select></div><div class="links">${telLink(r.phone)}${mailLink(r.email)}<button data-o-editref="${r.id}">Edit</button></div></div>`).join("");
  }
  function openReferralForm(id) {
    const r = id ? { ...Store.crm.referrals[id] } : { direction: "out", status: "sent", feePct: 25 };
    sheet(id ? "Edit referral" : "New referral", `<form id="oRefForm"><label for="rDir">Direction</label><select id="rDir">${opt([["out", "I’m sending a client out"], ["in", "Another agent sent me a client"]], r.direction)}</select>
      <label for="rClient">Client</label><input id="rClient" required value="${esc(r.client || "")}">
      <div class="row2"><div><label for="rAgent">Other agent</label><input id="rAgent" value="${esc(r.agent || "")}"></div><div><label for="rBrk">Their brokerage</label><input id="rBrk" value="${esc(r.brokerage || "")}"></div></div>
      <div class="row2"><div><label for="rPhone">Agent phone</label><input id="rPhone" type="tel" value="${esc(r.phone || "")}"></div><div><label for="rEmail">Agent email</label><input id="rEmail" type="email" value="${esc(r.email || "")}"></div></div>
      <label for="rMarket">Market</label><input id="rMarket" placeholder="Phoenix, AZ" value="${esc(r.market || "")}">
      <div class="row2"><div><label for="rPct">Fee (%)</label><input id="rPct" inputmode="decimal" value="${esc(r.feePct ?? "")}"></div><div><label for="rFee">Expected fee</label><input id="rFee" inputmode="decimal" placeholder="$3,000" value="${esc(r.expectedFee ? short(parseMoney(r.expectedFee)) : "")}"></div></div>
      <label for="rStatus">Status</label><select id="rStatus">${opt(REF_STATUS, r.status)}</select>
      <label for="rNotes">Notes</label><textarea id="rNotes" rows="2">${esc(r.notes || "")}</textarea>
      <div class="actions"><button class="btn gold" type="submit">Save</button>${id ? `<button class="btn ghost" type="button" data-o-delref="${id}">Delete</button>` : ""}</div></form>`);
    $("#oRefForm").addEventListener("submit", e => { e.preventDefault(); Store.saveCrm("referrals", id, { ...r, direction: val("rDir"), client: val("rClient"), agent: val("rAgent"), brokerage: val("rBrk"), phone: val("rPhone"), email: val("rEmail"), market: val("rMarket"), feePct: parseFloat(val("rPct")) || 0, expectedFee: parseMoney(val("rFee")), status: val("rStatus"), notes: val("rNotes"), createdAt: r.createdAt || nowIso() }); closeSheet(); });
  }

  /* ===================================================================
     5. FOLLOW-UP EMAILS
     =================================================================== */
  const DEFAULT_TEMPLATES = {
    anniversary: { subject: "Happy home anniversary, {first_name}!", body: "Hi {first_name},\n\nIt’s been {years} since you got the keys to {address}. I hope it’s been a great home.\n\nIf you ever want to know what it’s worth today, or have questions about projects or refinancing, I’m always happy to help.\n\n{agent_name}" },
    birthday: { subject: "Happy birthday, {first_name}!", body: "Hi {first_name},\n\nWishing you a happy birthday and a great year ahead.\n\n{agent_name}" },
    checkin: { subject: "Checking in", body: "Hi {first_name},\n\nI wanted to check in and see how things are going. If anything real estate related is on your mind, I’m here to help.\n\n{agent_name}" }
  };
  const tmpl = k => ({ ...DEFAULT_TEMPLATES[k], ...((S().followups || {}).templates || {})[k] });
  const fill = (s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => v[k] ?? "");
  function followupsDue(daysAhead = 14) {
    const f = S().followups || {}, out = [], today = localDay(), y = Number(today.slice(0, 4));
    const cs = Object.fromEntries(contacts().map(c => [c.id, c]));
    const sentKey = (cid, kind, year) => crm("emaillog").some(l => l.contactId === cid && l.kind === kind && String(l.year) === String(year));
    const inWindow = mmdd => { for (let i = 0; i <= daysAhead; i++) { const d = new Date(today + "T12:00"); d.setDate(d.getDate() + i); if (d.toLocaleDateString("en-CA").slice(5) === mmdd) return { i, date: d.toLocaleDateString("en-CA") }; } return null; };
    if (f.anniversary !== false) myDeals().filter(d => d.status === "closed" && d.closeDate && d.contactId && cs[d.contactId]).forEach(d => {
      const w = inWindow(md(d.closeDate)), years = y - Number(d.closeDate.slice(0, 4));
      if (w && years >= 1) out.push({ kind: "anniversary", c: cs[d.contactId], date: w.date, days: w.i, vars: { years: `${years} ${years === 1 ? "year" : "years"}`, address: d.address }, year: y });
    });
    if (f.birthday !== false) Object.values(cs).filter(c => c.birthday).forEach(c => { const w = inWindow(md(c.birthday)); if (w) out.push({ kind: "birthday", c, date: w.date, days: w.i, vars: {}, year: y }); });
    const every = Number(f.checkinDays || 0);
    if (every) Object.values(cs).filter(c => c.email && c.role !== "other").forEach(c => {
      const last = c.lastContacted || c.createdAt || ""; if (!last) return;
      const since = Math.round((Date.now() - new Date(last).getTime()) / 864e5);
      if (since >= every) out.push({ kind: "checkin", c, date: today, days: 0, vars: {}, year: today });
    });
    return out.filter(x => x.c.email && !x.c.doNotContact && !sentKey(x.c.id, x.kind, x.year)).sort((a, b) => a.days - b.days);
  }
  function followupsHTML() {
    const f = S().followups || {}, due = followupsDue(14);
    const canSend = !!C.EMAIL_ENDPOINT;
    let html = `<div class="tourform"><label class="check"><input type="checkbox" data-o-fu="anniversary" ${f.anniversary !== false ? "checked" : ""}> Home anniversaries (from closed transactions)</label>
      <label class="check"><input type="checkbox" data-o-fu="birthday" ${f.birthday !== false ? "checked" : ""}> Birthdays (from contacts)</label>
      <div class="row2"><div><label for="fuDays">Check in when I haven’t emailed in</label><select id="fuDays" data-o-fu="checkinDays">${opt([["0", "Off"], ["60", "60 days"], ["90", "90 days"], ["180", "6 months"], ["365", "1 year"]], String(f.checkinDays || 0))}</select></div>
      <div><label for="fuAuto">Sending</label><select id="fuAuto" data-o-fu="autoSend" ${canSend ? "" : "disabled"}>${opt([["", "I review and send"], ["1", "Send anniversaries and birthdays automatically"]], f.autoSend ? "1" : "")}</select></div></div>
      ${canSend ? "" : `<p class="addr">Email sending isn’t connected yet, so Send opens your email app instead.</p>`}
      <div class="quick" style="margin-top:10px"><button class="btn ghost small" data-o-tmpl="anniversary">Edit anniversary email</button><button class="btn ghost small" data-o-tmpl="birthday">Edit birthday email</button><button class="btn ghost small" data-o-tmpl="checkin">Edit check-in email</button></div></div>`;
    html += `<div class="stage-h">Due in the next 2 weeks<span>${due.length}</span></div>` + (due.length ? due.map((x, i) => `<div class="pcard"><div class="pcard-top"><div><strong>${esc(x.c.name)}</strong><p>${{ anniversary: "Home anniversary", birthday: "Birthday", checkin: "Check-in" }[x.kind]} · ${x.days === 0 ? "Today" : dayLabel(x.date)}${x.vars.address ? " · " + esc(x.vars.address) : ""}</p></div></div>
      <div class="links"><button data-o-fusend="${i}" ${O.sending === String(i) ? "disabled" : ""}>${O.sending === String(i) ? "Sending…" : "Review and send"}</button><button data-o-fuskip="${i}">Skip</button></div></div>`).join("") : `<p class="addr">Nothing due. Add birthdays to contacts and link closed transactions to contacts to fill this in.</p>`);
    const log = crm("emaillog").sort((a, b) => (b.sentAt || "").localeCompare(a.sentAt || "")).slice(0, 10);
    if (log.length) html += `<div class="stage-h">Recently sent<span>${log.length}</span></div>` + log.map(l => `<p class="addr">${when(l.sentAt)} · ${esc(l.to || "")} · ${esc(l.subject || "")}${l.skipped ? " · Skipped" : l.auto ? " · Automatic" : ""}</p>`).join("");
    return html;
  }
  O._due = [];
  function openSendForm(i) {
    const x = O._due[i]; if (!x) return;
    const t = tmpl(x.kind), v = { first_name: firstName(x.c.name), agent_name: IDX.BROKER.name, ...x.vars };
    sheet("Review email", `<form id="oSendForm"><p class="addr">To ${esc(x.c.name)} · ${esc(x.c.email)}</p>
      <label for="sSubj">Subject</label><input id="sSubj" required value="${esc(fill(t.subject, v))}">
      <label for="sBody">Message</label><textarea id="sBody" rows="9" style="width:100%">${esc(fill(t.body, v))}</textarea>
      <div class="actions"><button class="btn gold" type="submit">${C.EMAIL_ENDPOINT ? "Send" : "Open in email app"}</button></div><p class="msg" id="sMsg" role="status"></p></form>`);
    $("#oSendForm").addEventListener("submit", async e => {
      e.preventDefault(); const subject = val("sSubj"), text = val("sBody"), m = $("#sMsg");
      if (!C.EMAIL_ENDPOINT) { location.href = `mailto:${encodeURIComponent(x.c.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`; logSend(x, subject, false); closeSheet(); return; }
      m.textContent = "Sending…";
      const ok = await sendEmail({ to: x.c.email, toName: x.c.name, subject, text });
      if (ok === true) { logSend(x, subject, false); closeSheet(); toast("Email sent"); } else m.textContent = ok;
    });
  }
  function logSend(x, subject, skipped) {
    Store.saveCrm("emaillog", null, { contactId: x.c.id, kind: x.kind, year: x.year, to: x.c.email, subject, sentAt: nowIso(), skipped: !!skipped });
    if (!skipped) { const c = Store.crm.contacts[x.c.id]; if (c) Store.saveCrm("contacts", x.c.id, { ...c, lastContacted: nowIso() }); }
  }
  async function sendEmail(body) {
    try {
      const token = await window.MillerCloud?.token?.();
      const r = await fetch(C.EMAIL_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token || ""}` }, body: JSON.stringify(body) });
      if (r.ok) return true;
      const j = await r.json().catch(() => ({})); return j.error || "That didn’t send. Try again.";
    } catch (e) { return "That didn’t send. Check your connection."; }
  }
  function openTemplateForm(k) {
    const t = tmpl(k);
    sheet("Edit email", `<form id="oTmplForm"><p class="addr">You can use {first_name}, {agent_name}${k === "anniversary" ? ", {years}, and {address}" : ""}.</p>
      <label for="tSubj">Subject</label><input id="tSubj" required value="${esc(t.subject)}"><label for="tBody">Message</label><textarea id="tBody" rows="9" style="width:100%">${esc(t.body)}</textarea>
      <div class="actions"><button class="btn gold" type="submit">Save</button><button class="btn ghost" type="button" data-o-tmplreset="${k}">Reset to default</button></div></form>`);
    $("#oTmplForm").addEventListener("submit", e => { e.preventDefault(); const f = S().followups || {}; Store.saveSettings({ followups: { ...f, templates: { ...(f.templates || {}), [k]: { subject: val("tSubj"), body: val("tBody") } } } }); closeSheet(); });
  }

  /* ===================================================================
     6. PREFERRED PARTNERS   7. BRAND LIBRARY
     =================================================================== */
  const PARTNER_CATS = ["Lender", "Title and closing", "Home warranty", "Insurance", "Inspector", "Appraiser", "1031 exchange", "Property management", "Contractor", "Stager and photographer", "Attorney", "Other"];
  function partnersHTML() {
    const ps = Object.entries(O.partners).filter(([, x]) => x).map(([id, x]) => ({ id, ...x })).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    let html = `<p class="note-c">Offer clients at least three choices where you can, and never accept anything of value for a referral (RESPA Section 8). If you or the brokerage has a business tie to a partner, give the client a written Affiliated Business Arrangement disclosure.</p>`;
    if (isBroker()) html += `<div class="quick"><button class="btn gold" data-o-newpartner>Add partner</button></div>`;
    if (!ps.length) return html + `<div class="empty"><strong>No partners yet</strong>${isBroker() ? "Add lenders, title, inspectors, and other vendors your agents trust." : "Your broker will add trusted vendors here."}</div>`;
    PARTNER_CATS.forEach(cat => {
      const list = ps.filter(p => (p.category || "Other") === cat); if (!list.length) return;
      html += `<div class="stage-h">${esc(cat)}<span>${list.length}</span></div>` + list.map(p => `<div class="pcard"><div class="pcard-top"><div><strong>${esc(p.name)}</strong><p>${esc(p.company || "")}${p.affiliated ? " · Affiliated business: disclosure required" : ""}</p>${p.notes ? `<p>${esc(p.notes)}</p>` : ""}</div></div>
        <div class="links">${telLink(p.phone)}${mailLink(p.email)}${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">Website</a>` : ""}${isBroker() ? `<button data-o-editpartner="${p.id}">Edit</button>` : ""}</div></div>`).join("");
    });
    return html;
  }
  function openPartnerForm(id) {
    const p = id ? { ...O.partners[id] } : { category: "Lender" };
    sheet(id ? "Edit partner" : "Add partner", `<form id="oPartnerForm"><label for="ptCat">Category</label><select id="ptCat">${opt(PARTNER_CATS.map(c => [c, c]), p.category)}</select>
      <div class="row2"><div><label for="ptName">Contact name</label><input id="ptName" required value="${esc(p.name || "")}"></div><div><label for="ptCo">Company</label><input id="ptCo" value="${esc(p.company || "")}"></div></div>
      <div class="row2"><div><label for="ptPhone">Phone</label><input id="ptPhone" type="tel" value="${esc(p.phone || "")}"></div><div><label for="ptEmail">Email</label><input id="ptEmail" type="email" value="${esc(p.email || "")}"></div></div>
      <label for="ptUrl">Website</label><input id="ptUrl" type="url" value="${esc(p.url || "")}"><label for="ptNotes">Notes for agents</label><textarea id="ptNotes" rows="2">${esc(p.notes || "")}</textarea>
      <label class="check"><input type="checkbox" id="ptAff" ${p.affiliated ? "checked" : ""}> The brokerage or an agent has an ownership or business tie to this partner</label>
      <div class="actions"><button class="btn gold" type="submit">Save</button>${id ? `<button class="btn ghost" type="button" data-o-delpartner="${id}">Delete</button>` : ""}</div></form>`);
    $("#oPartnerForm").addEventListener("submit", e => { e.preventDefault(); saveCompany("partners", id, { ...p, category: val("ptCat"), name: val("ptName"), company: val("ptCo"), phone: val("ptPhone"), email: val("ptEmail"), url: val("ptUrl"), notes: val("ptNotes"), affiliated: val("ptAff") }); closeSheet(); });
  }
  const BRAND_KINDS = [["logo", "Logos"], ["template", "Templates"], ["guide", "Brand guidelines"], ["photo", "Photos"], ["video", "Videos"], ["other", "Other"]];
  function brandHTML() {
    const bs = Object.entries(O.brand).filter(([, x]) => x).map(([id, x]) => ({ id, ...x }));
    const sw = (n, c) => `<div style="flex:1;min-width:90px"><div style="height:46px;border-radius:10px;border:1px solid var(--line);background:${c}"></div><p class="addr" style="margin:4px 0 0">${n}<br>${c}</p></div>`;
    let html = `<div class="cmares"><p>The Miller Group brand</p><div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px">${sw("Midnight Black", "#141A26")}${sw("Estate Gold", "#B8935A")}${sw("Linen", "#F4EFE7")}</div><p>Headlines in Cormorant Garamond, body text in Inter. Use the brokerage name with your name on every ad, as Colorado requires.</p></div>`;
    if (isBroker()) html += `<div class="quick"><button class="btn gold" data-o-newbrand>Add to library</button></div>`;
    if (!bs.length) return html + `<p class="addr">${isBroker() ? "Add logo files, Canva templates, and the brand guide as links." : "Logos and templates will appear here."}</p>`;
    BRAND_KINDS.forEach(([k, label]) => {
      const list = bs.filter(b => b.kind === k); if (!list.length) return;
      html += `<div class="stage-h">${label}<span>${list.length}</span></div>` + list.map(b => `<div class="pcard"><div class="pcard-top"><div><strong>${esc(b.title)}</strong>${b.notes ? `<p>${esc(b.notes)}</p>` : ""}</div></div><div class="links">${b.url ? `<a href="${esc(b.url)}" target="_blank" rel="noopener">Open</a>` : ""}${isBroker() ? `<button data-o-editbrand="${b.id}">Edit</button>` : ""}</div></div>`).join("");
    });
    return html;
  }
  function openBrandForm(id) {
    const b = id ? { ...O.brand[id] } : { kind: "logo" };
    sheet(id ? "Edit item" : "Add to library", `<form id="oBrandForm"><label for="bKind">Type</label><select id="bKind">${opt(BRAND_KINDS, b.kind)}</select>
      <label for="bTitle">Title</label><input id="bTitle" required value="${esc(b.title || "")}"><label for="bUrl">Link</label><input id="bUrl" type="url" required value="${esc(b.url || "")}">
      <label for="bNotes">Notes</label><input id="bNotes" placeholder="When to use it" value="${esc(b.notes || "")}">
      <div class="actions"><button class="btn gold" type="submit">Save</button>${id ? `<button class="btn ghost" type="button" data-o-delbrand="${id}">Delete</button>` : ""}</div></form>`);
    $("#oBrandForm").addEventListener("submit", e => { e.preventDefault(); saveCompany("brand", id, { ...b, kind: val("bKind"), title: val("bTitle"), url: val("bUrl"), notes: val("bNotes") }); closeSheet(); });
  }

  /* ===================================================================
     8. RECRUITING  (broker only)
     =================================================================== */
  const REC_STAGES = [["prospect", "Prospect"], ["talking", "In conversation"], ["offer", "Offer sent"], ["joined", "Joined"], ["passed", "Passed"]];
  function recruitingHTML() {
    if (!isBroker()) return `<div class="empty"><strong>Broker only</strong>Recruiting is visible to the broker.</div>`;
    const rs = crm("recruits");
    let html = `<div class="quick"><button class="btn gold" data-o-newrec>Add prospect</button></div>`;
    if (!rs.length) return html + `<div class="empty"><strong>No prospects yet</strong>Track agents you’re talking with, where they are now, and who referred them.</div>`;
    REC_STAGES.forEach(([s, t]) => {
      const list = rs.filter(r => (r.stage || "prospect") === s); if (!list.length) return;
      html += `<div class="stage-h">${t}<span>${list.length}</span></div>` + list.map(r => `<div class="pcard"><div class="pcard-top"><div><strong>${esc(r.name)}</strong><p>${esc(r.brokerage || "")}${r.volume ? " · " + esc(r.volume) + " last year" : ""}${r.referredBy ? " · Referred by " + esc(r.referredBy) : ""}</p>${r.next ? `<p>Follow up ${dayLabel(r.next)}</p>` : ""}</div>
        <select data-o-recstage="${r.id}" aria-label="Stage">${opt(REC_STAGES, r.stage)}</select></div><div class="links">${telLink(r.phone)}${mailLink(r.email)}${s === "joined" ? `<button data-newagent>Give agent access</button>` : ""}<button data-o-editrec="${r.id}">Edit</button></div></div>`).join("");
    });
    return html;
  }
  function openRecruitForm(id) {
    const r = id ? { ...Store.crm.recruits[id] } : { stage: "prospect" };
    const agents = Object.values(Store.team).filter(Boolean).map(a => a.name).filter(Boolean);
    sheet(id ? "Edit prospect" : "Add prospect", `<form id="oRecForm"><label for="rcName">Name</label><input id="rcName" required value="${esc(r.name || "")}">
      <div class="row2"><div><label for="rcPhone">Phone</label><input id="rcPhone" type="tel" value="${esc(r.phone || "")}"></div><div><label for="rcEmail">Email</label><input id="rcEmail" type="email" value="${esc(r.email || "")}"></div></div>
      <div class="row2"><div><label for="rcBrk">Current brokerage</label><input id="rcBrk" value="${esc(r.brokerage || "")}"></div><div><label for="rcVol">Volume last year</label><input id="rcVol" placeholder="$8M" value="${esc(r.volume || "")}"></div></div>
      <label for="rcRef">Referred by</label><input id="rcRef" list="rcAgents" value="${esc(r.referredBy || "")}"><datalist id="rcAgents">${agents.map(a => `<option value="${esc(a)}">`).join("")}</datalist>
      <div class="row2"><div><label for="rcStage">Stage</label><select id="rcStage">${opt(REC_STAGES, r.stage)}</select></div><div><label for="rcNext">Next follow-up</label><input id="rcNext" type="date" value="${esc(r.next || "")}"></div></div>
      <label for="rcNotes">Notes</label><textarea id="rcNotes" rows="3">${esc(r.notes || "")}</textarea>
      <div class="actions"><button class="btn gold" type="submit">Save</button>${id ? `<button class="btn ghost" type="button" data-o-delrec="${id}">Delete</button>` : ""}</div></form>`);
    $("#oRecForm").addEventListener("submit", e => { e.preventDefault(); Store.saveCrm("recruits", id, { ...r, name: val("rcName"), phone: val("rcPhone"), email: val("rcEmail"), brokerage: val("rcBrk"), volume: val("rcVol"), referredBy: val("rcRef"), stage: val("rcStage"), next: val("rcNext"), notes: val("rcNotes"), createdAt: r.createdAt || nowIso() }); closeSheet(); });
  }

  /* ===================================================================
     P1. SETUP CHECKLIST
     =================================================================== */
  function setupSteps() {
    const p = Store.site || {}, s = S(), hub = Object.entries(O.hub).filter(([, x]) => x && x.mustRead), read = s.readItems || {};
    return [
      { done: !!(p.name && p.phone && p.slug), label: "Fill in your profile and pick your link name", go: "settings" },
      { done: !!p.nrds, label: "Add your NRDS ID", go: "settings" },
      { done: !hub.length || hub.every(([id]) => read[id]), label: "Read the company policies", go: "o-hub" },
      { done: contacts().length >= 5, label: "Import or add at least 5 contacts", go: "o-import" },
      { done: !!s.sharedLink, label: "Share your personal link with a client", go: "settings" },
      { done: !!s.gciGoal, label: "Set your yearly GCI goal", go: "biz" },
      { done: !!s.didMarketing, label: "Make your first marketing graphic", go: "marketing" },
      { done: !!s.followups, label: "Turn on follow-up emails", go: "o-followups" },
      { done: myDeals().length > 0, label: "Add your first transaction", go: "o-deals" }
    ];
  }
  O.homeTop = function () {
    let html = "";
    const steps = setupSteps(), done = steps.filter(x => x.done).length;
    if (!S().setupHidden && done < steps.length) {
      const next = steps.find(x => !x.done);
      html += `<div class="cmares"><p>Get started · ${done} of ${steps.length} done</p><div class="bar"><span style="width:${(done / steps.length * 100).toFixed(0)}%"></span></div>
        <div class="quick" style="margin:8px 0 0"><button class="btn gold" data-panel="${next.go}">Next: ${esc(next.label)}</button><button class="btn ghost" data-panel="o-setup">See all</button></div></div>`;
    }
    const dl = upcomingDeadlines(3);
    if (dl.length) html += dl.slice(0, 3).map(({ d, x, n }) => `<button class="notif fresh" data-panel="o-deal:${d.id}"><strong>${esc(x.label)}</strong> · ${esc(d.address)}<time>${n < 0 ? "Overdue" : n === 0 ? "Today" : `In ${n} ${n === 1 ? "day" : "days"}`}</time></button>`).join("");
    const fu = followupsDue(0).length; if (fu) html += `<button class="notif" data-panel="o-followups"><strong>${fu} follow-up ${fu === 1 ? "email" : "emails"}</strong> due today</button>`;
    if (isBroker()) { const q = Object.values(O.deals).filter(d => d && (d.review || {}).state === "submitted").length; if (q) html += `<button class="notif fresh" data-panel="o-review"><strong>${q} ${q === 1 ? "transaction" : "transactions"}</strong> waiting for your review</button>`; }
    const unread = Object.entries(O.hub).filter(([id, x]) => x && x.mustRead && !(S().readItems || {})[id]).length;
    if (unread) html += `<button class="notif" data-panel="o-hub"><strong>${unread} company ${unread === 1 ? "item" : "items"}</strong> to read</button>`;
    return html;
  };
  function setupHTML() {
    const steps = setupSteps();
    return steps.map(x => `<div class="task ${x.done ? "done" : ""}"><input type="checkbox" disabled ${x.done ? "checked" : ""} aria-label="${x.done ? "Done" : "Not done"}"><div class="tt"><span>${esc(x.label)}</span></div>${x.done ? "" : `<button data-panel="${x.go}">Start</button>`}</div>`).join("") +
      `<div class="quick" style="margin-top:12px">${O.conn.trainingUrl ? `<a class="btn ghost" style="text-align:center;text-decoration:none" href="${esc(O.conn.trainingUrl)}" target="_blank" rel="noopener">Training</a>` : ""}<button class="btn ghost" data-o-hidesetup>${S().setupHidden ? "Show on home" : "Hide from home"}</button></div>`;
  }

  /* ===================================================================
     P2. CONTACT IMPORT
     =================================================================== */
  function parseCSV(text) {
    const rows = []; let row = [], cell = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
      else if (ch === '"') q = true;
      else if (ch === ",") { row.push(cell); cell = ""; }
      else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
      else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(r => r.some(c => c.trim()));
  }
  const FIELD_GUESS = { name: /^(full ?name|name|contact)$/i, first: /^first/i, last: /^last|surname/i, email: /e-?mail/i, phone: /phone|mobile|cell/i, role: /^(type|role|category)$/i, birthday: /birth/i, purchased: /purchase|closed?.?date|bought/i, address: /address|street/i, folders: /tag|group|folder|label/i, notes: /note|comment/i };
  function mapRows(rows) {
    const head = rows[0].map(h => h.trim()), idx = {};
    Object.entries(FIELD_GUESS).forEach(([k, re]) => { const i = head.findIndex(h => re.test(h)); if (i >= 0) idx[k] = i; });
    const get = (r, k) => idx[k] != null ? String(r[idx[k]] || "").trim() : "";
    const roleOf = v => /sell/i.test(v) && /buy/i.test(v) ? "both" : /sell|list/i.test(v) ? "seller" : /buy/i.test(v) ? "buyer" : v ? "other" : "buyer";
    const dateOf = v => { if (!v) return ""; if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10); const m = v.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/); if (!m) return ""; let y = m[3] || "2000"; if (y.length === 2) y = (Number(y) > 40 ? "19" : "20") + y; return `${y}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`; };
    return { idx, head, list: rows.slice(1).map(r => ({ name: get(r, "name") || [get(r, "first"), get(r, "last")].filter(Boolean).join(" "), email: get(r, "email").toLowerCase(), phone: get(r, "phone"), role: roleOf(get(r, "role")), birthday: dateOf(get(r, "birthday")), purchaseDate: dateOf(get(r, "purchased")), listingAddress: get(r, "address"), folders: splitList(get(r, "folders")), notes: get(r, "notes") })).filter(c => c.name || c.email) };
  }
  function importHTML() {
    let html = `<p class="addr">Upload a CSV exported from your phone, Gmail, Outlook, or another CRM. Columns like Name (or First and Last), Email, Phone, Type, Birthday, Purchase date, Address, Tags, and Notes are picked up automatically. Contacts with an email already in your list are skipped.</p>
      <div class="tourform"><label for="oImpFile">CSV file</label><input id="oImpFile" type="file" accept=".csv,text/csv"></div>`;
    if (O.importRows) {
      const m = O.importRows, have = new Set(contacts().map(c => (c.email || "").toLowerCase()).filter(Boolean));
      const fresh = m.list.filter(c => !c.email || !have.has(c.email)), dup = m.list.length - fresh.length;
      html += `<div class="cmares"><p>Ready to import</p><b style="font-size:26px">${fresh.length} contacts</b><p>${dup ? `${dup} already in your contacts will be skipped. ` : ""}Matched columns: ${Object.keys(m.idx).map(k => esc(m.head[m.idx[k]])).join(", ") || "none"}</p></div>
        ${fresh.slice(0, 5).map(c => `<p class="addr">${esc(c.name)} · ${esc(c.email || "no email")} · ${esc(c.role)}</p>`).join("")}${fresh.length > 5 ? `<p class="addr">…and ${fresh.length - 5} more</p>` : ""}
        <div class="quick" style="margin-top:10px"><button class="btn gold" data-o-doimport ${fresh.length ? "" : "disabled"}>Import ${fresh.length}</button><button class="btn ghost" data-o-cancelimport>Cancel</button></div>`;
    }
    return html;
  }
  function doImport() {
    const have = new Set(contacts().map(c => (c.email || "").toLowerCase()).filter(Boolean));
    let n = 0;
    O.importRows.list.forEach(c => { if (c.email && have.has(c.email)) return; if (c.email) have.add(c.email); Store.saveCrm("contacts", null, { ...c, name: c.name || c.email, buyerStage: "lead", sellerStage: "prospect", createdAt: nowIso(), updatedAt: nowIso(), source: "import" }); n++; });
    O.importRows = null; toast(`Imported ${n} contacts`); agentPanel = "contacts"; renderAgent();
  }

  /* ===================================================================
     P3. MATCHING CLIENTS (reverse prospecting)
     =================================================================== */
  function matchesFilters(l, f = {}) {
    if (f.maxPrice && l.price > +f.maxPrice) return false;
    if (f.minBeds && l.beds < +f.minBeds) return false;
    if (f.type && l.type !== f.type) return false;
    if (f.status === "Pending" && l.status !== "Pending") return false;
    if (f.text) { const t = f.text.toLowerCase(); if (![l.city, l.hood, l.address, l.zip].some(v => String(v || "").toLowerCase().includes(t))) return false; }
    return true;
  }
  function matchingClients(l) {
    const out = new Map(), add = (key, rec, why) => { const cur = out.get(key) || { ...rec, why: [] }; cur.why.push(why); out.set(key, cur); };
    Object.entries(Store.clients).forEach(([cid, c]) => {
      Object.values(c.searches || {}).filter(Boolean).forEach(sv => { if (matchesFilters(l, sv.filters)) add(cid, { cid, name: nameOf(cid) }, `Saved search “${sv.name}”`); });
      const loved = clientItems(cid).filter(i => i.reaction === "love").map(i => listingSync(i.key)).filter(Boolean);
      if (loved.some(x => x.key !== l.key && x.hood === l.hood && Math.abs(x.price - l.price) / l.price <= 0.15)) add(cid, { cid, name: nameOf(cid) }, `Loved a similar home in ${l.hood}`);
    });
    contacts().filter(c => isBuyer(c) && c.buyerStage !== "closed" && !c.doNotContact).forEach(c => {
      const b = parseMoney(c.budget), area = String(c.area || "").toLowerCase();
      const fitsBudget = b && l.price <= b * 1.05 && l.price >= b * 0.6, fitsArea = area && [l.hood, l.city].some(v => v && area.includes(String(v).toLowerCase()));
      if (fitsBudget && (fitsArea || !area)) { const key = c.clientId || "c:" + c.id; add(key, { cid: c.clientId || "", contactId: c.id, name: c.name, email: c.email, phone: c.phone }, `Budget ${short(b)}${fitsArea ? `, wants ${l.hood}` : ""}`); }
    });
    return [...out.values()];
  }
  function rpHTML(key) {
    const pool = marketingPool();
    const l = key ? listingSync(key) : null;
    let html = `<div class="tourform"><label for="oRpPick">Listing</label><select id="oRpPick" data-o-rppick>${`<option value="">Choose a listing</option>` + pool.map(p => `<option value="${esc(p.key)}" ${p.key === key ? "selected" : ""}>${esc(p.address)} · ${short(p.price)}${p.exclusive ? " · Off-market" : ""}</option>`).join("")}</select></div>`;
    if (!l) return html + `<p class="addr">Pick a listing to see which clients’ saved searches, loved homes, and budgets fit it.</p>`;
    const ms = matchingClients(l), inApp = ms.filter(m => m.cid);
    if (!O.rp.text || O.rp.key !== key) { O.rp = { key, text: `I just saw ${l.address} in ${l.hood} at ${short(l.price)} and thought of you. Want to take a look?` }; }
    html += `<div class="cmares"><p>${esc(l.address)}</p><b style="font-size:26px">${ms.length} matching ${ms.length === 1 ? "client" : "clients"}</b><p>${short(l.price)} · ${l.beds} bd · ${esc(l.hood)}</p></div>`;
    if (!ms.length) return html + `<p class="addr">No saved searches, loved homes, or buyer budgets fit this one yet.</p>`;
    html += ms.map(m => `<div class="pcard"><div class="pcard-top"><div><strong>${esc(m.name)}</strong><p>${m.why.map(esc).join(" · ")}</p></div></div><div class="links">${m.cid ? `<button data-panel="thread:${esc(m.cid)}">Message</button>` : ""}${telLink(m.phone)}${m.email ? mailLink(m.email, l.address) : ""}</div></div>`).join("");
    if (inApp.length) html += `<h3 class="agent-h">Message everyone in the app</h3><div class="tourform"><textarea id="oRpText" rows="3" style="width:100%;padding:10px 12px;border:1px solid var(--line);border-radius:8px;background:var(--surface)">${esc(O.rp.text)}</textarea></div>
      <div class="quick" style="margin-top:8px"><button class="btn gold" data-o-rpsend="${esc(key)}">Send to ${inApp.length} ${inApp.length === 1 ? "client" : "clients"}</button></div><p class="addr">Each client gets their own private message with the home attached.</p>`;
    return html;
  }

  /* ===================================================================
     P4. LIKELY TO SELL
     =================================================================== */
  function likelyToSell() {
    const ds = myDeals().filter(d => d.status === "closed" && d.contactId && (d.side === "buyer" || d.side === "both"));
    const bought = {}; ds.forEach(d => { const cur = bought[d.contactId]; if (!cur || d.closeDate > cur.closeDate) bought[d.contactId] = d; });
    const now = Date.now(), recent = 30 * 864e5;
    return contacts().filter(c => !c.doNotContact && c.role !== "other").map(c => {
      let score = 0; const why = [];
      const pd = c.purchaseDate || (bought[c.id] || {}).closeDate;
      if (pd) {
        const yrs = (now - new Date(pd + "T12:00").getTime()) / (365.25 * 864e5);
        if (yrs >= 5 && yrs < 12) { score += 40; why.push(`Owned ${Math.floor(yrs)} years`); }
        else if (yrs >= 12) { score += 25; why.push(`Owned ${Math.floor(yrs)}+ years`); }
        else if (yrs >= 3) { score += 12; why.push(`Owned ${Math.floor(yrs)} years`); }
      }
      if (isSeller(c) && ["prospect", "prep"].includes(c.sellerStage)) { score += 30; why.push("Seller prospect"); }
      if (c.clientId) {
        const act = clientItems(c.clientId).filter(i => now - new Date(i.updatedAt || i.addedAt || 0).getTime() < recent).length;
        if (act) { score += Math.min(25, act * 5); why.push(`Active in the app (${act} recent saves)`); }
      }
      if (/(baby|retir|job|relocat|divorc|downsiz|upsiz|estate|empty nest)/i.test(c.notes || "")) { score += 15; why.push("Life change in notes"); }
      const last = c.lastContacted || c.updatedAt || c.createdAt;
      if (score && last && now - new Date(last).getTime() > 180 * 864e5) { score += 10; why.push("No contact in 6+ months"); }
      return { c, score, why };
    }).filter(x => x.score >= 20).sort((a, b) => b.score - a.score).slice(0, 30);
  }
  function likelyHTML() {
    const list = likelyToSell();
    let html = `<p class="addr">A simple score from your own data: how long they’ve owned, seller stage, recent app activity, life changes in notes, and time since you last reached out. Add purchase dates and birthdays to contacts to sharpen it.</p>`;
    if (!list.length) return html + `<div class="empty"><strong>No one stands out yet</strong>Add purchase dates to past clients, or link closed buyer transactions to contacts.</div>`;
    return html + list.map(x => `<div class="pcard"><div class="pcard-top"><div><strong>${esc(x.c.name)}</strong><p>${x.why.map(esc).join(" · ")}</p></div><span class="badge" style="background:var(--accent);font-size:13px;height:auto;padding:2px 8px">${Math.min(100, x.score)}</span></div>
      <div class="links">${telLink(x.c.phone)}${mailLink(x.c.email)}<button data-newtask="${x.c.id}">Add task</button><button data-editcontact="${x.c.id}">Edit</button></div></div>`).join("");
  }

  /* ===================================================================
     P5. FOLDERS (contacts and transactions)
     =================================================================== */
  function splitList(v) { return [...new Set(String(v || "").split(",").map(s => s.trim()).filter(Boolean))].slice(0, 12); }
  function foldersStrip(items, kind) {
    const names = [...new Set(items.flatMap(x => x.folders || []))].sort();
    if (!names.length) return "";
    const cur = kind === "deal" ? O.dealFolder : O.contactFolder;
    return `<div class="sstrip"><button class="schip ${!cur ? "on" : ""}" data-o-folder="${kind}|">All</button>${names.map(n => `<button class="schip ${cur === n ? "on" : ""}" data-o-folder="${kind}|${esc(n)}">${esc(n)} <span class="addr">${items.filter(x => (x.folders || []).includes(n)).length}</span></button>`).join("")}</div>`;
  }
  O.contactsTop = () => `<div class="quick"><button class="btn ghost" data-panel="o-import">Import contacts</button><button class="btn ghost" data-panel="o-likely">Likely to sell</button></div>` + foldersStrip(contacts(), "contact");
  O.filterContacts = cs => O.contactFolder ? cs.filter(c => (c.folders || []).includes(O.contactFolder)) : cs;
  O.contactFields = c => `<label for="cFolders">Folders</label><input id="cFolders" placeholder="Past clients, Sphere, Farm" value="${esc((c.folders || []).join(", "))}">
      <div class="row2"><div><label for="cBday">Birthday</label><input id="cBday" type="date" value="${esc(c.birthday || "")}"></div><div><label for="cPurch">Bought their home</label><input id="cPurch" type="date" value="${esc(c.purchaseDate || "")}"></div></div>
      <label class="check"><input type="checkbox" id="cDnc" ${c.doNotContact ? "checked" : ""}> Do not contact (no follow-up emails or outreach)</label>`;
  O.contactValues = () => ({ folders: splitList(val("cFolders")), birthday: val("cBday"), purchaseDate: val("cPurch"), doNotContact: !!val("cDnc") });

  /* ===================================================================
     MENU, PANELS, EVENTS
     =================================================================== */
  O.counts = function () {
    return {
      deadlines: upcomingDeadlines(7).length,
      review: Object.values(O.deals).filter(d => d && (d.review || {}).state === "submitted").length,
      referrals: crm("referrals").filter(r => !["paid", "lost"].includes(r.status)).length,
      followups: followupsDue(0).length,
      unread: Object.entries(O.hub).filter(([id, x]) => x && x.mustRead && !(S().readItems || {})[id]).length,
      recruits: crm("recruits").filter(r => !["joined", "passed"].includes(r.stage)).length
    };
  };
  O.menuHTML = function (row) {
    const open = myDeals().filter(d => d.status === "pending").length;
    return `<h3 class="agent-h">Office</h3><div class="menu">
      ${row("o-deals", "Transactions", open ? `${open} under contract` : "")}${isBroker() ? row("o-review", "Broker review", (() => { const q = Object.values(O.deals).filter(d => d && (d.review || {}).state === "submitted").length; return q ? `${q} waiting` : ""; })()) : ""}${row("o-income", "My income")}${row("o-referrals", "Referrals", crm("referrals").filter(r => !["paid", "lost"].includes(r.status)).length || "")}${row("o-followups", "Follow-up emails", followupsDue(14).length || "")}
      ${row("o-hub", "Company hub")}${row("o-partners", "Preferred partners")}${row("o-brand", "Brand library")}${isBroker() ? row("o-recruiting", "Recruiting", crm("recruits").filter(r => !["joined", "passed"].includes(r.stage)).length || "") : ""}
    </div><h3 class="agent-h">Prospecting</h3><div class="menu">${row("o-rp", "Matching clients")}${row("o-likely", "Likely to sell")}${row("o-import", "Import contacts")}${row("o-setup", "Get started checklist")}</div>`;
  };
  O.render = function (panel, head) {
    const [p, arg] = panel.includes(":") ? [panel.slice(0, panel.indexOf(":")), panel.slice(panel.indexOf(":") + 1)] : [panel, ""];
    if (!p.startsWith("o-")) return null;
    O._due = followupsDue(14);
    switch (p) {
      case "o-deals": return head("Transactions") + dealsHTML();
      case "o-deal": return dealHTML(arg);
      case "o-review": return head("Broker review") + reviewHTML();
      case "o-hub": return head("Company hub") + hubHTML();
      case "o-income": return head("My income") + incomeHTML();
      case "o-referrals": return head("Referrals") + referralsHTML();
      case "o-followups": return head("Follow-up emails") + followupsHTML();
      case "o-partners": return head("Preferred partners") + partnersHTML();
      case "o-brand": return head("Brand library") + brandHTML();
      case "o-recruiting": return head("Recruiting") + recruitingHTML();
      case "o-setup": return head("Get started") + setupHTML();
      case "o-import": return head("Import contacts") + importHTML();
      case "o-rp": return head("Matching clients") + rpHTML(arg);
      case "o-likely": return head("Likely to sell") + likelyHTML();
    }
    return null;
  };

  document.addEventListener("click", e => {
    // Track setup steps done elsewhere in the app
    if (e.target.closest("[data-mkpng],[data-mkcaps]")) markSetting("didMarketing");
    if (e.target.closest("[data-share],[data-copymine],[data-copylink]")) markSetting("sharedLink");
    const t = e.target.closest("[data-o-newdeal],[data-o-editdeal],[data-o-deldeal],[data-o-submit],[data-o-approve],[data-o-changes],[data-o-adddl],[data-o-adddoc],[data-o-newhub],[data-o-edithub],[data-o-delhub],[data-o-read],[data-o-plan],[data-o-conn],[data-o-newexp],[data-o-delexp],[data-o-incomecsv],[data-o-newref],[data-o-editref],[data-o-delref],[data-o-tmpl],[data-o-tmplreset],[data-o-fusend],[data-o-fuskip],[data-o-newpartner],[data-o-editpartner],[data-o-delpartner],[data-o-newbrand],[data-o-editbrand],[data-o-delbrand],[data-o-newrec],[data-o-editrec],[data-o-delrec],[data-o-hidesetup],[data-o-doimport],[data-o-cancelimport],[data-o-rpsend],[data-o-folder],[data-o-rpfor]");
    if (!t) return;
    const d = t.dataset;
    if (d.oNewdeal !== undefined) openDealForm(null);
    else if (d.oEditdeal !== undefined) openDealForm(d.oEditdeal);
    else if (d.oDeldeal !== undefined) { if (confirm("Delete this transaction?")) { saveDeal(d.oDeldeal, null); closeSheet(); agentPanel = "o-deals"; renderAgent(); } }
    else if (d.oSubmit !== undefined) editDeal(d.oSubmit, x => { x.review = { state: "submitted", at: nowIso() }; });
    else if (d.oApprove !== undefined) editDeal(d.oApprove, x => { x.review = { state: "approved", at: nowIso(), by: Store.uid }; });
    else if (d.oChanges !== undefined) { const note = prompt("What needs to change?"); if (note) editDeal(d.oChanges, x => { x.review = { state: "changes", note, at: nowIso(), by: Store.uid }; }); }
    else if (d.oAdddl !== undefined) { const label = prompt("Name this date"); if (label) editDeal(d.oAdddl, x => { x.deadlines = [...(x.deadlines || []), { label, date: "", done: false }]; }); }
    else if (d.oAdddoc !== undefined) { const label = prompt("Name this document"); if (label) editDeal(d.oAdddoc, x => { x.docs = [...(x.docs || []), { label, done: false, url: "" }]; }); }
    else if (d.oNewhub !== undefined) openHubForm(null);
    else if (d.oEdithub !== undefined) openHubForm(d.oEdithub);
    else if (d.oDelhub !== undefined) { if (confirm("Delete this item?")) { saveCompany("hub", d.oDelhub, null); closeSheet(); } }
    else if (d.oRead !== undefined) Store.saveSettings({ readItems: { ...(S().readItems || {}), [d.oRead]: nowIso() } });
    else if (d.oPlan !== undefined) openPlanForm();
    else if (d.oConn !== undefined) openConnForm();
    else if (d.oNewexp !== undefined) openExpenseForm();
    else if (d.oDelexp !== undefined) Store.saveCrm("expenses", d.oDelexp, null);
    else if (d.oIncomecsv !== undefined) incomeCSV();
    else if (d.oNewref !== undefined) openReferralForm(null);
    else if (d.oEditref !== undefined) openReferralForm(d.oEditref);
    else if (d.oDelref !== undefined) { if (confirm("Delete this referral?")) { Store.saveCrm("referrals", d.oDelref, null); closeSheet(); } }
    else if (d.oTmpl !== undefined) openTemplateForm(d.oTmpl);
    else if (d.oTmplreset !== undefined) { const f = S().followups || {}, tm = { ...(f.templates || {}) }; delete tm[d.oTmplreset]; Store.saveSettings({ followups: { ...f, templates: tm } }); closeSheet(); }
    else if (d.oFusend !== undefined) openSendForm(+d.oFusend);
    else if (d.oFuskip !== undefined) { const x = O._due[+d.oFuskip]; if (x) logSend(x, "", true); }
    else if (d.oNewpartner !== undefined) openPartnerForm(null);
    else if (d.oEditpartner !== undefined) openPartnerForm(d.oEditpartner);
    else if (d.oDelpartner !== undefined) { if (confirm("Delete this partner?")) { saveCompany("partners", d.oDelpartner, null); closeSheet(); } }
    else if (d.oNewbrand !== undefined) openBrandForm(null);
    else if (d.oEditbrand !== undefined) openBrandForm(d.oEditbrand);
    else if (d.oDelbrand !== undefined) { if (confirm("Delete this item?")) { saveCompany("brand", d.oDelbrand, null); closeSheet(); } }
    else if (d.oNewrec !== undefined) openRecruitForm(null);
    else if (d.oEditrec !== undefined) openRecruitForm(d.oEditrec);
    else if (d.oDelrec !== undefined) { if (confirm("Delete this prospect?")) { Store.saveCrm("recruits", d.oDelrec, null); closeSheet(); } }
    else if (d.oHidesetup !== undefined) Store.saveSettings({ setupHidden: !S().setupHidden });
    else if (d.oDoimport !== undefined) doImport();
    else if (d.oCancelimport !== undefined) { O.importRows = null; renderAgent(); }
    else if (d.oRpsend !== undefined) {
      const l = listingSync(d.oRpsend), txt = ($("#oRpText") || {}).value || O.rp.text; if (!l || !txt.trim()) return;
      const ids = [...new Set(matchingClients(l).map(m => m.cid).filter(Boolean))];
      if (!confirm(`Send this to ${ids.length} ${ids.length === 1 ? "client" : "clients"}?`)) return;
      ids.forEach(cid => Store.sendMessage(cid, "agent", txt.trim(), l.key)); toast(`Sent to ${ids.length}`);
    }
    else if (d.oRpfor !== undefined) { if ($("#dlgListing").open) $("#dlgListing").close(); agentPanel = "o-rp:" + d.oRpfor; if (location.hash !== "#agent") location.hash = "agent"; else renderAgent(); window.scrollTo(0, 0); }
    else if (d.oFolder !== undefined) { const [k, n] = d.oFolder.split("|"); if (k === "deal") O.dealFolder = n; else O.contactFolder = n; renderAgent(); }
  });
  document.addEventListener("change", e => {
    const t = e.target, d = t.dataset;
    if (d.oDl) { const [id, i] = d.oDl.split("|"); editDeal(id, x => { x.deadlines[+i].done = t.checked; }); }
    else if (d.oDldate) { const [id, i] = d.oDldate.split("|"); editDeal(id, x => { x.deadlines[+i].date = t.value; if (x.deadlines[+i].label === "Closing date") x.closeDate = t.value; }); }
    else if (d.oDoc) { const [id, i] = d.oDoc.split("|"); editDeal(id, x => { x.docs[+i].done = t.checked; }); }
    else if (d.oDocurl) { const [id, i] = d.oDocurl.split("|"); editDeal(id, x => { x.docs[+i].url = t.value.trim(); }); }
    else if (d.oRefstatus) { const r = Store.crm.referrals[d.oRefstatus]; if (r) Store.saveCrm("referrals", d.oRefstatus, { ...r, status: t.value }); }
    else if (d.oRecstage) { const r = Store.crm.recruits[d.oRecstage]; if (r) Store.saveCrm("recruits", d.oRecstage, { ...r, stage: t.value }); }
    else if (d.oFu) { const f = { anniversary: true, birthday: true, ...(S().followups || {}) }; f[d.oFu] = t.type === "checkbox" ? t.checked : d.oFu === "autoSend" ? !!t.value : Number(t.value); Store.saveSettings({ followups: f }); }
    else if (t.matches("[data-o-rppick]")) { agentPanel = "o-rp:" + t.value; renderAgent(); }
    else if (t.id === "oImpFile" && t.files && t.files[0]) {
      const r = new FileReader();
      r.onload = () => { const rows = parseCSV(String(r.result || "")); if (rows.length < 2) { toast("That file has no rows"); return; } O.importRows = mapRows(rows); renderAgent(); };
      r.readAsText(t.files[0]);
    }
  });
  document.addEventListener("input", e => { if (e.target.id === "oRpText") O.rp.text = e.target.value; });

  // Sample office content for demo mode (nothing is saved).
  O.seedDemo = function () {
    if (O.seeded) return; O.seeded = true;
    ["referrals", "expenses", "recruits", "emaillog", "scripts"].forEach(k => { Store.crm[k] = Store.crm[k] || {}; });
    const d = n => { const x = new Date(); x.setDate(x.getDate() + n); return x.toLocaleDateString("en-CA"); };
    const ago = (y, n = 0) => { const x = new Date(); x.setFullYear(x.getFullYear() - y); x.setDate(x.getDate() + n); return x.toLocaleDateString("en-CA"); };
    const y = new Date().getFullYear(), ts = nowIso();
    const dl = (pairs) => DEADLINES.map(label => ({ label, date: pairs[label] || "", done: false }));
    const docs = (n) => DOCS.map((label, i) => ({ label, done: i < n, url: "" }));
    O.plan = { name: "Flat fee plan", flatFee: 495, eoFee: 50, monthlyFee: 0, cap: 0, notes: "Keep 100% of your commission. One flat fee per closed transaction." };
    O.conn = { esignName: "Association eSign", esignUrl: "https://example.com/esign", mlsUrl: "https://www.recolorado.com" };
    O.deals = {
      dd1: { agentId: "demo-broker", address: "2210 S Fillmore St", side: "seller", status: "pending", clientName: "Tom and Alicia Grant", contactId: "dct3", price: 1180000, commissionPct: 2.5, contractDate: d(-10), closeDate: d(18),
        deadlines: dl({ "Earnest money due": d(-8), "Inspection objection deadline": d(2), "Inspection resolution deadline": d(5), "Appraisal deadline": d(9), "Closing date": d(18) }), docs: docs(4), review: { state: "none" }, folders: ["Spring sellers"], createdAt: ts },
      dd2: { agentId: "demo-agent", address: "4021 Raleigh St", side: "buyer", status: "pending", clientName: "Dana Whitfield", price: 875000, commissionPct: 2.5, contractDate: d(-6), closeDate: d(25),
        deadlines: dl({ "Earnest money due": d(-4), "Inspection objection deadline": d(1), "Closing date": d(25) }), docs: docs(6), review: { state: "submitted", at: ts }, createdAt: ts },
      dd3: { agentId: "demo-broker", address: "1440 N Gaylord St", side: "buyer", status: "closed", clientName: "Marcus Lee", contactId: "dct4", price: 910000, commissionPct: 2.5, closeDate: `${y}-03-14`, referralPct: 0, docs: docs(10), deadlines: dl({}), review: { state: "approved", at: ts }, createdAt: ts },
      dd4: { agentId: "demo-broker", address: "88 Vine St", side: "seller", status: "closed", clientName: "Past client", price: 640000, commissionPct: 2.5, closeDate: `${y}-07-02`, referralPct: 25, docs: docs(10), deadlines: dl({}), review: { state: "approved", at: ts }, createdAt: ts }
    };
    O.hub = {
      h1: { type: "announcement", title: "Welcome to The Miller Group", body: "Office meeting the first Tuesday of each month. Bring one listing or buyer update.", pinned: true, createdAt: ts },
      h2: { type: "policy", title: "Policy and Procedures Manual", url: "https://example.com/ppm", mustRead: true, createdAt: ts },
      h3: { type: "form", title: "Independent Contractor Agreement", url: "https://example.com/ica", createdAt: ts },
      h4: { type: "training", title: "Transaction file checklist walkthrough", body: "How to submit a complete file for broker review.", createdAt: ts }
    };
    O.partners = {
      p1: { category: "Lender", name: "Sample Lender", company: "Front Range Home Loans", phone: "303-555-0110", notes: "Fast pre-approvals." },
      p2: { category: "Title and closing", name: "Sample Closer", company: "Mile High Title", phone: "303-555-0120" },
      p3: { category: "Inspector", name: "Sample Inspector", company: "Peak Home Inspections", phone: "720-555-0130" }
    };
    O.brand = { b1: { kind: "logo", title: "Primary logo", url: "https://example.com/logo", notes: "Use on light backgrounds." }, b2: { kind: "template", title: "Just listed social template", url: "https://example.com/template" } };
    Store.crm.referrals = { r1: { direction: "out", client: "The Parks", agent: "Sample Agent", brokerage: "Desert Realty", market: "Phoenix, AZ", feePct: 25, expectedFee: 3200, status: "contract", createdAt: ts } };
    Store.crm.expenses = { e1: { amount: 450, date: d(-12), category: "Marketing", note: "Open house signs" }, e2: { amount: 210, date: d(-30), category: "MLS and association dues" } };
    Store.crm.recruits = { rc1: { name: "Casey Morgan", brokerage: "Big Box Realty", volume: "$9M", stage: "talking", referredBy: "Alex Rivera", next: d(3), createdAt: ts } };
    const c = Store.crm.contacts;
    if (c.dct4) c.dct4 = { ...c.dct4, birthday: "1985-" + d(0).slice(5), folders: ["Past clients"] };
    if (c.dct3) c.dct3 = { ...c.dct3, folders: ["Spring sellers"] };
    c.dct6 = { name: "Renee Ortiz", email: "renee@example.com", phone: "720-555-0166", role: "seller", sellerStage: "prospect", buyerStage: "lead", purchaseDate: ago(8), notes: "Kids moving out, may downsize.", folders: ["Sphere"], createdAt: ts, updatedAt: ago(1) };
    Store.settings = { ...Store.settings, followups: { anniversary: true, birthday: true, checkinDays: 0 } };
    Store.emit();
  };
  // office.js can load before or after Store finishes starting up; cover both.
  if (typeof Store !== "undefined") {
    if (Store.demo) O.seedDemo();
    if (Store.isAgent && Store.db) O.watch();
    Store.emit();
  }
  // test hooks
  O._t = { parseCSV, mapRows, matchingClients, likelyToSell, followupsDue, incomeStats, setupSteps, saveDeal, saveCompany, saveCompanyDoc, fill, tmpl };
})();
