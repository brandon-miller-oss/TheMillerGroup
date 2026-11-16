/* =========================================================================
   The Miller Group: transaction guide in the client's app.
   Agent (transaction view):
     - Share the transaction with the client: address, contract dates, and
       document summaries. Commission, broker review, notes, and document
       links never leave the agent side.
     - Paste a document (inspection report, HOA rules, title commitment),
       let AI draft a plain-English summary, edit it, then share it.
     - See every question the client asked the guide, and add a note.
   Client (their app):
     - A timeline of their dates with what each one means and days left.
     - Document summaries their agent reviewed.
     - "Ask about your transaction": answers come from their dates and
       documents only; anything needing judgment is flagged for the agent.
   Data: boards/<client>/deal/<deal id> (shared copy), boards/<client>/guide/<id> (Q&A).
   ========================================================================= */
(function () {
  const CG = window.ClientGuide = { deals: {}, qa: {}, watching: false, agentQA: {}, agentSubs: {}, pushed: {}, demoShared: {}, demoQA: {}, draft: {}, msg: {}, busy: {} };
  const C = window.MG_CONFIG || {};
  const G = () => window.DealGuide;
  const L = () => (window.I18N && I18N.lang) || "en", tr = (en, es) => L() === "es" ? es : en;
  const now = () => new Date().toISOString();
  const today = () => typeof localDay === "function" ? localDay() : new Date().toLocaleDateString("en-CA");
  const newId = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const daysTo = d => Math.round((new Date(d + "T12:00:00") - new Date(today() + "T12:00:00")) / 86400000);
  const contact = id => (Store.crm.contacts || {})[id] || null;
  const agentInfo = () => { const a = window.AgentBrand ? AgentBrand.current(Store.crmOwner) : {}; const t = (Store.team || {})[Store.crmOwner] || {}; return { name: a.name || t.name || IDX.BROKER.name, phone: a.phone || t.phone || IDX.BROKER.phone, email: t.email || "", firm: a.brand ? `${a.display}, brokered by The Miller Group` : (IDX.BROKER.firm || "The Miller Group") }; };
  const clientOf = d => { const c = d && d.contactId ? contact(d.contactId) : null; return c ? { c, id: c.clientId || (Store.demo ? "demo-" + d.contactId : "") } : { c: null, id: "" }; };
  const fmtDay = d => L() === "es" ? new Date(d + "T12:00:00").toLocaleDateString("es-US", { weekday: "short", month: "short", day: "numeric" }) : (typeof dayLabel === "function" ? dayLabel(d) : d);
  const when = iso => iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";

  /* --------------------------- Agent: sharing --------------------------- */
  const sharedFor = (id, d) => G().shareable(d, agentInfo(), (d.clientDocs || []).filter(x => x.shared));
  const sig = s => JSON.stringify({ ...s, sharedAt: "" });
  async function push(id, d) {
    const { id: cid } = clientOf(d); if (!cid) return;
    const s = sharedFor(id, d), k = sig(s);
    if (CG.pushed[id] === k) return; CG.pushed[id] = k;
    if (Store.demo || !Store.db) { CG.demoShared[id] = s; return; }
    try { await Store.db.doc(`boards/${cid}/deal/${id}`).set(s); } catch (e) { delete CG.pushed[id]; }
  }
  async function unshare(id, d) {
    const { id: cid } = clientOf(d); delete CG.pushed[id];
    if (Store.demo || !Store.db) { delete CG.demoShared[id]; return; }
    if (cid) { try { await Store.db.doc(`boards/${cid}/deal/${id}`).delete(); } catch (e) {} }
  }
  // Keep the client's copy current whenever a shared transaction changes.
  let t; if (typeof Store !== "undefined") Store.onChange(() => { if (!Store.isAgent || !window.Office) return; clearTimeout(t); t = setTimeout(() => Object.entries(Office.deals || {}).forEach(([id, d]) => { if (d && d.shareClient && d.agentId === (Store.demo ? Store.crmOwner : Store.uid)) push(id, d); }), 800); });

  function watchQA(id, d) {
    const { id: cid } = clientOf(d); if (!cid || Store.demo || !Store.db || CG.agentSubs[cid]) return;
    CG.agentSubs[cid] = Store.db.collection(`boards/${cid}/guide`).onSnapshot(sn => { const m = {}; sn.docs.forEach(x => { m[x.id] = x.data(); }); CG.agentQA[cid] = m; Store.emit(); }, () => {});
  }
  const qaList = (cid, dealId) => Object.entries(Store.demo ? CG.demoQA : (CG.agentQA[cid] || {})).filter(([, x]) => x && x.dealId === dealId).sort((a, b) => (b[1].at || "").localeCompare(a[1].at || ""));
  CG.flagged = () => { if (!window.Office) return 0; let n = 0; Object.entries(Office.deals || {}).forEach(([id, d]) => { if (!d || !d.shareClient) return; const { id: cid } = clientOf(d); n += qaList(cid, id).filter(([, x]) => x.forAgent && !x.note).length; }); return n; };

  CG.dealHTML = function (id, d) {
    const { c, id: cid } = clientOf(d);
    let html = `<h3 class="agent-h">Client portal</h3>`;
    if (!c) return html + `<p class="addr">Link this transaction to a client in Edit to share it in their app.</p>`;
    if (!cid) return html + `<p class="addr">${esc(c.name.split(" ")[0])} doesn’t have an app account yet. Send them your home search link; once they sign in, link their account on the contact.</p>`;
    watchQA(id, d);
    const first = esc(c.name.split(" ")[0]);
    html += `<label class="check"><input type="checkbox" data-cg-share="${esc(id)}" ${d.shareClient ? "checked" : ""}> Show ${first} this transaction in their app: dates with plain-English explanations, documents you share below, and a guide that answers their questions</label>
      <p class="addr">Commission, broker review, notes, and document links stay private. The guide only explains; it won’t advise ${first} on decisions, and it flags those questions for you.</p>`;
    if (!d.shareClient) return html;
    const docs = d.clientDocs || [], dr = CG.draft[id] || {};
    html += `<h4 class="cg-h">Documents for ${first}</h4>${docs.length ? docs.map((x, i) => `<div class="pcard"><div class="pcard-top"><div><strong>${esc(x.title)}</strong><p>${x.shared ? `Shared ${when(x.at)}` : "Draft, not shared"}</p></div><div class="quick" style="margin:0">${x.shared ? `<button class="btn ghost small" data-cg-unpub="${esc(id)}|${i}">Unshare</button>` : `<button class="btn gold small" data-cg-pub="${esc(id)}|${i}">Share</button>`}<button class="btn ghost small" data-cg-deldoc="${esc(id)}|${i}">Delete</button></div></div><p class="addr" style="white-space:pre-wrap">${esc(x.summary)}</p></div>`).join("") : `<p class="addr">Nothing shared yet. Inspection reports, HOA documents, and title commitments are the usual ones.</p>`}
      <div class="tourform"><label for="cgT">Document</label><input id="cgT" placeholder="e.g. Inspection report" value="${esc(dr.title || "")}">
        <label for="cgX">Paste the text</label><textarea id="cgX" rows="4" placeholder="Paste the report or document text">${esc(dr.text || "")}</textarea>
        <div class="quick"><button class="btn ghost" data-cg-ai="${esc(id)}" ${CG.busy[id] ? "disabled" : ""}>${CG.busy[id] ? "Summarizing…" : "Draft a summary with AI"}</button></div>
        <label for="cgS">Summary ${first} will see</label><textarea id="cgS" rows="5" placeholder="Write or edit the plain-English summary">${esc(dr.summary || "")}</textarea>
        <div class="quick"><button class="btn gold" data-cg-adddoc="${esc(id)}">Share with ${first}</button><button class="btn ghost" data-cg-savedraft="${esc(id)}">Save as draft</button></div><p class="msg" role="status">${esc(CG.msg[id] || "")}</p></div>`;
    const qa = qaList(cid, id);
    html += `<h4 class="cg-h">${first}’s questions</h4>` + (qa.length ? qa.slice(0, 15).map(([qid, x]) => `<div class="pcard ${x.forAgent && !x.note ? "cg-flag" : ""}"><p><strong>${esc(x.q)}</strong></p><p class="addr" style="white-space:pre-wrap">${esc(x.a)}</p><p class="addr">${when(x.at)}${x.forAgent ? " · Flagged for you" : ""}</p>
      ${x.note ? `<p class="cg-note"><strong>Your note:</strong> ${esc(x.note)}</p>` : `<div class="cg-reply"><input id="cgN_${esc(qid)}" placeholder="Add a note ${first} will see under this answer" aria-label="Note"><button class="btn ghost small" data-cg-note="${esc(cid)}|${esc(qid)}">Add note</button></div>`}</div>`).join("") : `<p class="addr">No questions yet.</p>`);
    return html;
  };

  async function summarize(id) {
    const text = (document.getElementById("cgX") || {}).value || "", title = (document.getElementById("cgT") || {}).value || "";
    CG.draft[id] = { title, text, summary: (document.getElementById("cgS") || {}).value || "" };
    if (text.trim().length < 80) { CG.msg[id] = "Paste more of the document first."; return; }
    const d = Office.deals[id], side = d.side === "seller" ? "seller" : "buyer", es = (clientOf(d).c || {}).lang === "es";
    let ai = null; try { ai = window.claude && await window.claude.use("sample"); } catch (e) {}
    if (!ai) { CG.msg[id] = Store.demo ? "Demo: AI summaries work once the AI connection is set up. Write the summary yourself for now." : "AI isn’t connected. Write the summary yourself."; return; }
    CG.busy[id] = true; renderAgent();
    try {
      const r = await ai(`Summarize this document for a Colorado home ${side} in plain English, as their real estate agent would. 120 to 220 words. Start with the two or three things that matter most (cost, safety, deadlines), then the rest briefly. Don’t advise them what to decide, don’t add anything that isn’t in the document, and note anything that looks incomplete. Plain text, short paragraphs or simple dashes.${es ? " Write it in Spanish (neutral Latin American Spanish, usted), since this client prefers Spanish." : ""}\n\nDocument: ${title}\n\n${text.slice(0, 30000)}`, { maxTokens: 900 });
      CG.draft[id].summary = String(r.text || "").trim(); CG.msg[id] = "Review the draft and edit anything before you share it.";
    } catch (e) { CG.msg[id] = "The summary didn’t come through. Try again."; }
    CG.busy[id] = false;
  }
  function editDeal(id, fn) { const d = JSON.parse(JSON.stringify(Office.deals[id])); fn(d); Office._t.saveDeal(id, d); }

  /* ----------------------------- Client side ---------------------------- */
  function watchClient() {
    if (CG.watching || Store.demo || !Store.db || Store.isAgent || !Store.uid) return; CG.watching = true;
    Store.db.collection(`boards/${Store.uid}/deal`).onSnapshot(sn => { const m = {}; sn.docs.forEach(d => { m[d.id] = d.data(); }); CG.deals = m; Store.emit(); }, () => {});
    Store.db.collection(`boards/${Store.uid}/guide`).onSnapshot(sn => { const m = {}; sn.docs.forEach(d => { m[d.id] = d.data(); }); CG.qa = m; Store.emit(); }, () => {});
  }
  const myDeals = () => Object.entries(Store.demo ? CG.demoShared : CG.deals).filter(([, s]) => s && s.status !== "closed");
  const myQA = dealId => Object.entries(Store.demo ? CG.demoQA : CG.qa).filter(([, x]) => x && x.dealId === dealId).sort((a, b) => (b[1].at || "").localeCompare(a[1].at || ""));

  CG.clientHTML = function () {
    if (Store.isAgent && !Store.demo) return "";
    watchClient();
    const ds = myDeals(); if (!ds.length) return "";
    return ds.map(([id, s]) => {
      const left = s.deadlines.filter(x => !x.done && x.date >= today()), next = left[0];
      const done = s.deadlines.filter(x => x.done || x.date < today()).length;
      const qa = myQA(id).slice(0, 5);
      return `<section class="cg" aria-labelledby="cgH_${esc(id)}"><h3 class="agent-h" id="cgH_${esc(id)}">${s.side === "seller" ? tr("Your sale", "Su venta") : tr("Your purchase", "Su compra")}: ${esc(s.address)}</h3>
        ${next ? `<div class="cg-next"><span>${tr("Next up", "Lo que sigue")}</span><strong>${esc(G().label(next.label, L()))}</strong><b>${daysTo(next.date) === 0 ? tr("Today", "Hoy") : daysTo(next.date) === 1 ? tr("Tomorrow", "Mañana") : tr(`In ${daysTo(next.date)} days`, `En ${daysTo(next.date)} días`)}</b><small>${esc(fmtDay(next.date))}</small></div>` : `<div class="cg-next"><strong>${tr("All dates are behind you", "Ya pasaron todas las fechas")}</strong></div>`}
        <div class="cg-bar" role="progressbar" aria-label="${tr("Contract dates completed", "Fechas del contrato cumplidas")}" aria-valuemin="0" aria-valuemax="${s.deadlines.length}" aria-valuenow="${done}"><i style="width:${s.deadlines.length ? Math.round(done / s.deadlines.length * 100) : 0}%"></i></div>
        <ol class="cg-tl">${s.deadlines.map(x => { const past = x.done || x.date < today(); return `<li class="${past ? "past" : ""}"><details><summary><span>${esc(G().label(x.label, L()))}</span><time>${esc(fmtDay(x.date))}${past ? " ✓" : ""}</time></summary><p>${esc(G().explain(x.label, s.side, L()) || tr("Ask your agent what this date means for you.", "Pregunte a su agente qué significa esta fecha para usted."))}</p></details></li>`; }).join("")}</ol>
        ${s.docs && s.docs.length ? `<h4 class="cg-h">${tr(`Documents ${esc((s.agent.name || "your agent").split(" ")[0])} explained`, `Documentos que explicó ${esc((s.agent.name || "su agente").split(" ")[0])}`)}</h4>${s.docs.map(d => `<details class="cg-doc"><summary>${esc(d.title)}</summary><p>${esc(d.summary)}</p></details>`).join("")}` : ""}
        <h4 class="cg-h">${s.side === "seller" ? tr("Ask about your sale", "Pregunte sobre su venta") : tr("Ask about your purchase", "Pregunte sobre su compra")}</h4>
        <div class="cg-ask"><label class="sr" for="cgQ_${esc(id)}">${tr("Your question", "Su pregunta")}</label><textarea id="cgQ_${esc(id)}" rows="2" placeholder="${tr("e.g. What happens at the inspection deadline?", "p. ej., ¿Qué pasa en la fecha límite de inspección?")}"></textarea><button class="btn gold" data-cg-ask="${esc(id)}" ${CG.busy["q" + id] ? "disabled" : ""}>${CG.busy["q" + id] ? tr("Thinking…", "Pensando…") : tr("Ask", "Preguntar")}</button></div>
        ${CG.msg["q" + id] ? `<p class="msg" role="status">${esc(CG.msg["q" + id])}</p>` : ""}
        ${qa.map(([, x]) => `<div class="cg-qa"><p class="cg-q">${esc(x.q)}</p><p>${esc(x.a)}</p>${x.forAgent ? `<p class="addr">${tr(`${esc(s.agent.name || "Your agent")} can see this question${x.note ? "" : " and will follow up"}.`, `${esc(s.agent.name || "Su agente")} puede ver esta pregunta${x.note ? "" : " y le dará seguimiento"}.`)}</p>` : ""}${x.note ? `<p class="cg-note"><strong>${esc((s.agent.name || "Your agent").split(" ")[0])}:</strong> ${esc(x.note)}</p>` : ""}</div>`).join("")}
        <p class="addr cg-fine">${esc(L() === "es" ? G().DISCLAIMER_ES : G().DISCLAIMER)} ${tr(`Questions go to ${esc(s.agent.name || "your agent")} too.${s.agent.phone ? ` Call or text ${esc(s.agent.phone)} anytime.` : ""}`, `Las preguntas también le llegan a ${esc(s.agent.name || "su agente")}.${s.agent.phone ? ` Llame o mande un mensaje al ${esc(s.agent.phone)} cuando quiera.` : ""}`)}</p></section>`;
    }).join("");
  };

  async function ask(id) {
    const box = document.getElementById("cgQ_" + id), q = (box && box.value || "").trim();
    if (q.length < 3) return; if (q.length > 1500) { CG.msg["q" + id] = tr("Keep it under 1,500 characters.", "Use menos de 1,500 caracteres."); return; }
    const s = (Store.demo ? CG.demoShared : CG.deals)[id]; if (!s) return;
    CG.busy["q" + id] = true; CG.msg["q" + id] = ""; Store.emit();
    try {
      if (Store.demo || !C.GUIDE_ENDPOINT) {
        const r = G().localAnswer(s, q, L()), qid = newId("q");
        CG.demoQA[qid] = { dealId: id, q, a: r.answer, forAgent: r.forAgent, at: now() };
        if (!Store.demo) CG.msg["q" + id] = tr("The guide isn’t fully connected yet, so this answer only uses your dates.", "La guía aún no está conectada por completo, así que esta respuesta solo usa sus fechas.");
      } else {
        const token = window.MillerCloud ? await MillerCloud.token() : "";
        const res = await fetch(C.GUIDE_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({ dealId: id, question: q }) });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.error || tr("The guide didn’t answer. Try again.", "La guía no respondió. Inténtelo de nuevo."));
        CG.qa[j.id] = j.item;
      }
      if (box) box.value = "";
    } catch (e) { CG.msg["q" + id] = e.message || tr("The guide didn’t answer. Try again.", "La guía no respondió. Inténtelo de nuevo."); }
    CG.busy["q" + id] = false; Store.emit();
  }

  CG.seedDemo = function () {
    if (!window.Office || !Office.deals || !Office.deals.dd1 || CG.demoShared.dd1) return;
    const d = Office.deals.dd1;
    d.shareClient = true;
    d.clientDocs = [{ id: "cd1", title: "Inspection report", shared: true, at: now(), summary: "The inspector found the home in good overall shape for its age. The main items: the furnace is 22 years old and near the end of its life, the sewer scope shows roots at one joint, and two upstairs outlets aren’t grounded. Smaller items include a loose railing on the back steps and missing caulk at the kitchen sink.", text: "" }];
    CG.demoShared.dd1 = sharedFor("dd1", d);
    CG.demoQA.dq1 = { dealId: "dd1", q: "What happens after the inspection objection deadline?", a: "If the buyer sends an objection by that date, you and the buyer then have until the inspection resolution deadline to agree in writing on how the items will be handled. The contract spells out what happens if there’s no agreement. Brandon will walk you through your options.", forAgent: false, at: now() };
    CG.demoQA.dq2 = { dealId: "dd1", q: "Should we offer a credit for the furnace?", a: "That’s a decision to talk through with Brandon, since it depends on the buyer’s objection and your goals. I’ve flagged it for him.", forAgent: true, at: now() };
  };

  if (Store.demo) CG.seedDemo();
  if (!document.getElementById("cgStyles")) {
    const st = document.createElement("style"); st.id = "cgStyles";
    st.textContent = `.cg{border:1px solid var(--line);border-radius:14px;padding:4px 14px 12px;margin:12px 0;background:var(--surface)}.cg-h{margin:14px 0 6px;font-size:15px}
.cg-next{display:grid;grid-template-columns:1fr auto;gap:0 10px;background:var(--bg);border-radius:10px;padding:10px 12px;margin:6px 0}.cg-next span{grid-column:1/-1;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-2)}.cg-next b{text-align:right}.cg-next small{grid-column:1/-1;color:var(--ink-2)}
.cg-bar{height:6px;border-radius:99px;background:var(--line);overflow:hidden;margin:8px 0}.cg-bar i{display:block;height:100%;background:var(--gold)}
.cg-tl{list-style:none;padding:0;margin:0}.cg-tl li{border-top:1px solid var(--line)}.cg-tl summary{display:flex;justify-content:space-between;gap:10px;padding:8px 0;cursor:pointer}.cg-tl time{color:var(--ink-2);white-space:nowrap;font-size:14px}.cg-tl li.past summary span{color:var(--ink-2)}.cg-tl p,.cg-doc p{margin:0 0 10px;font-size:14px;white-space:pre-wrap}
.cg-doc{border-top:1px solid var(--line);padding:6px 0}.cg-doc summary{cursor:pointer;font-weight:500}.cg-ask{display:flex;gap:8px;align-items:flex-end}.cg-ask textarea{flex:1;padding:8px 10px;border:1px solid var(--line);border-radius:10px;background:var(--bg);color:var(--ink);font:inherit}
.cg-qa{border-top:1px solid var(--line);padding:8px 0;font-size:14px}.cg-qa p{margin:2px 0}.cg-q{font-weight:600}.cg-note{background:var(--bg);border-left:3px solid var(--gold);padding:6px 10px;border-radius:6px;font-size:14px}.cg-fine{font-size:12px}
.cg-flag{border-left:4px solid var(--gold)}.cg-reply{display:flex;gap:6px;margin-top:6px}.cg-reply input{flex:1;padding:6px 8px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink)}.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}`;
    document.head.appendChild(st);
  }

  document.addEventListener("change", e => {
    const id = e.target.dataset && e.target.dataset.cgShare; if (id === undefined) return;
    const on = e.target.checked; editDeal(id, d => { d.shareClient = on; });
    if (on) push(id, Office.deals[id]); else unshare(id, Office.deals[id]);
    renderAgent();
  });
  document.addEventListener("click", async e => {
    const el = e.target.closest("[data-cg-ai],[data-cg-adddoc],[data-cg-savedraft],[data-cg-pub],[data-cg-unpub],[data-cg-deldoc],[data-cg-note],[data-cg-ask]"); if (!el) return; const d = el.dataset;
    const val = id => (document.getElementById(id) || {}).value || "";
    if (d.cgAsk) { ask(d.cgAsk); return; }
    if (d.cgAi) { await summarize(d.cgAi); renderAgent(); return; }
    if (d.cgAdddoc || d.cgSavedraft) {
      const id = d.cgAdddoc || d.cgSavedraft, title = val("cgT").trim(), summary = val("cgS").trim();
      if (!title || !summary) { CG.draft[id] = { title, text: val("cgX"), summary }; CG.msg[id] = "Add a title and a summary."; renderAgent(); return; }
      editDeal(id, x => { x.clientDocs = (x.clientDocs || []).concat({ id: newId("cd"), title: title.slice(0, 120), summary: summary.slice(0, 4000), text: val("cgX").slice(0, 15000), shared: !!d.cgAdddoc, at: now() }); });
      CG.draft[id] = {}; CG.msg[id] = d.cgAdddoc ? "Shared." : "Saved as a draft.";
      if (d.cgAdddoc) push(id, Office.deals[id]); renderAgent(); return;
    }
    if (d.cgPub || d.cgUnpub || d.cgDeldoc) {
      const [id, i] = (d.cgPub || d.cgUnpub || d.cgDeldoc).split("|");
      editDeal(id, x => { if (d.cgDeldoc) x.clientDocs.splice(+i, 1); else { x.clientDocs[+i].shared = !!d.cgPub; x.clientDocs[+i].at = now(); } });
      push(id, Office.deals[id]); renderAgent(); return;
    }
    if (d.cgNote) {
      const [cid, qid] = d.cgNote.split("|"), note = val("cgN_" + qid).trim().slice(0, 1000); if (!note) return;
      if (Store.demo || !Store.db) { if (CG.demoQA[qid]) CG.demoQA[qid] = { ...CG.demoQA[qid], note, noteAt: now() }; }
      else { const cur = (CG.agentQA[cid] || {})[qid]; if (cur) { try { await Store.db.doc(`boards/${cid}/guide/${qid}`).set({ ...cur, note, noteAt: now() }); } catch (err) { if (typeof toast === "function") toast("The note didn’t save. Try again."); } } }
      renderAgent();
    }
  });
  CG._t = { push, sharedFor, myDeals, qaList };
})();
