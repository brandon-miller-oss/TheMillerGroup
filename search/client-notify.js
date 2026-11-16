/* =========================================================================
   The Miller Group: client updates (notifications).
   - Showings: when a showing day for a client is scheduled or changed, the
     agent gets "Send Jordan an update?" with a preview (or it sends on its
     own in automatic mode). Canceling a day the client knows about offers a
     cancellation note. The server reminds clients the day before.
   - Showing requests can be scheduled in one step from the request card.
   - Transactions: send milestone updates, or turn on day-before reminders
     for inspection, appraisal, loan terms, closing, and possession dates.
   - Channels: the client's app (inbox), email (with a calendar file), and
     text (only with recorded consent, 8 AM to 9 PM).
   - Clients see updates in the app, add showings to their calendar, confirm
     or ask for a new time, and choose email or text updates.
   Private stop notes (lockbox codes) are never included.
   ========================================================================= */
(function () {
  const CN = window.ClientNotify = { cancels: {}, timers: {}, inbox: {}, demoInbox: [], watching: false, open: {}, msg: {} };
  const C = window.MG_CONFIG || {};
  const T = () => window.NotifyTemplates;
  const L = () => (window.I18N && I18N.lang) || "en", tr = (en, es) => L() === "es" ? es : en;
  const now = () => new Date().toISOString();
  const today = () => typeof localDay === "function" ? localDay() : new Date().toLocaleDateString("en-CA");
  const newId = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const settings = () => ({ mode: "ask", reminders: true, ...((Store.settings || {}).clientUpdates || {}) });
  const contact = id => (Store.crm.contacts || {})[id] || null;
  const agentInfo = () => { const a = window.AgentBrand ? AgentBrand.current(Store.crmOwner) : { name: IDX.BROKER.name, phone: IDX.BROKER.phone, firm: IDX.BROKER.firm || "The Miller Group" }; return { name: a.name, phone: a.phone, business: a.brand ? a.display : "", byline: a.byline || "", firm: a.firm }; };

  /* ------------------------------ Showings ------------------------------ */
  const stopAddr = k => { const l = typeof listingSync === "function" ? listingSync(k) : null; return l ? `${l.address}${l.city ? ", " + l.city : ""}` : (typeof addrOf === "function" ? addrOf(k) : ""); };
  const sig = t => t ? `${t.date}|${(t.stops || []).map(s => `${s.listingKey}@${s.time || ""}`).join(",")}` : "";
  const tourData = (id, t) => ({ id, date: t.date, client: (contact(t.contactId) || {}).name || "", stops: (t.stops || []).map(s => ({ address: stopAddr(s.listingKey), time: s.time || "" })), agent: agentInfo() });
  // A tour needs an update when it has a client, a date today or later, homes, and changes the client hasn't been sent.
  CN.tourNeeds = (id, t) => { t = t || Store.crm.tours[id]; if (!t || !t.contactId || !contact(t.contactId) || !t.date || t.date < today() || !(t.stops || []).length) return null; const s = sig(t); if (s === t.notifiedSig || s === t.dismissedSig) return null; return t.notifiedSig ? "showing_updated" : "showing_scheduled"; };
  CN.pendingTours = () => Object.entries(Store.crm.tours || {}).filter(([id, t]) => t && CN.tourNeeds(id, t)).map(([id, t]) => ({ id, t, event: CN.tourNeeds(id, t) }));
  CN.count = () => CN.pendingTours().length + Object.keys(CN.cancels).length;

  const origSave = Store.saveTour.bind(Store);
  const quietSave = (id, t) => origSave(id, t);
  Store.saveTour = function (id, tour) {
    const prev = id && this.crm.tours[id] ? JSON.parse(JSON.stringify(this.crm.tours[id])) : null;
    const rid = origSave(id, tour);
    try {
      if (!tour && prev && prev.notifiedSig && prev.contactId && prev.date >= today()) CN.cancels[rid] = { ...prev, id: rid };
      else if (tour && settings().mode === "auto" && CN.tourNeeds(rid, tour)) { clearTimeout(CN.timers[rid]); CN.timers[rid] = setTimeout(() => { if (CN.tourNeeds(rid)) CN.sendTour(rid, { auto: true }); }, 15000); }
    } catch (e) { /* never block saving */ }
    return rid;
  };

  CN.sendTour = async function (id, o = {}) {
    const t = Store.crm.tours[id], event = CN.tourNeeds(id, t); if (!event) return null;
    const res = await deliver(t.contactId, event, tourData(id, t), { channels: o.channels, tourId: id });
    const cur = Store.crm.tours[id]; if (cur) quietSave(id, { ...cur, stops: (cur.stops || []).map(s => ({ ...s, address: stopAddr(s.listingKey) || s.address || "" })), notifiedSig: sig(cur), notifiedAt: now(), dismissedSig: "" });
    return res;
  };
  CN.skipTour = id => { const t = Store.crm.tours[id]; if (t) quietSave(id, { ...t, dismissedSig: sig(t) }); };
  CN.sendCancel = async function (id, o = {}) { const t = CN.cancels[id]; if (!t) return; delete CN.cancels[id]; return deliver(t.contactId, "showing_canceled", tourData(id, t), { channels: o.channels, tourId: id }); };

  /* ------------------------------ Delivery ------------------------------ */
  // Which channels can reach this contact, and why not when they can't.
  CN.channels = function (c) {
    const n = (c && c.notify) || {};
    return {
      app: c && c.clientId ? { ok: true } : { ok: false, why: "No app account linked" },
      email: !c || c.doNotContact ? { ok: false, why: "Do not contact" } : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email || "") ? { ok: false, why: "No email on file" } : n.email === false ? { ok: false, why: "Client turned off email updates" } : { ok: true },
      sms: !c || c.doNotContact ? { ok: false, why: "Do not contact" } : !(c.phone || "").replace(/\D/g, "") ? { ok: false, why: "No mobile number" } : !(n.sms && n.smsConsentAt) ? { ok: false, why: "No text consent on file" } : { ok: true }
    };
  };
  async function deliver(contactId, event, data, o = {}) {
    const c = contact(contactId); if (!c) throw new Error("That contact wasn’t found.");
    const msg = T().compose(event, { ...data, client: c.name, agent: data.agent || agentInfo(), lang: c.lang === "es" ? "es" : "en" });
    const can = CN.channels(c), want = o.channels || Object.keys(can).filter(k => can[k].ok);
    const results = {}, id = newId("n");
    // App inbox
    if (want.includes("app")) {
      if (!can.app.ok) results.app = can.app.why;
      else {
        const item = { event, title: msg.title, text: msg.text, ics: msg.ics || "", tourId: o.tourId || "", dealId: o.dealId || "", from: (data.agent || agentInfo()).name, at: now(), read: false };
        if (Store.demo || !Store.db) { CN.demoInbox.unshift({ id, ...item }); results.app = "Sent"; }
        else { try { await Store.db.doc(`boards/${c.clientId}/inbox/${id}`).set(item); results.app = "Sent"; } catch (e) { results.app = "Didn’t send"; } }
      }
    }
    // Email and text go through the server, which looks up the contact itself and checks consent.
    const remote = want.filter(k => k === "email" || k === "sms");
    remote.filter(k => !can[k].ok).forEach(k => { results[k] = can[k].why; });
    const go = remote.filter(k => can[k].ok);
    if (go.length) {
      if (Store.demo || !C.NOTIFY_ENDPOINT) go.forEach(k => { results[k] = Store.demo ? "Demo: not sent" : "Email and text sending isn’t connected yet"; });
      else {
        try {
          const token = window.MillerCloud ? await MillerCloud.token() : "";
          const r = await fetch(C.NOTIFY_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({ contactId, channels: go, subject: msg.subject, text: msg.text, sms: msg.sms, ics: msg.ics || "" }) });
          const j = await r.json().catch(() => ({}));
          go.forEach(k => { results[k] = r.ok ? (j[k] || "Sent") : (j.error || "Didn’t send"); });
        } catch (e) { go.forEach(k => { results[k] = "Didn’t send. Check your connection."; }); }
      }
    }
    Store.saveCrm("notices", null, { contactId, event, title: msg.title, subject: msg.subject, text: msg.text, results, tourId: o.tourId || "", dealId: o.dealId || "", at: now(), auto: !!o.auto });
    return { msg, results };
  }
  CN.deliver = deliver;
  const summary = r => Object.entries(r || {}).map(([k, v]) => `${{ app: "App", email: "Email", sms: "Text" }[k]}: ${v}`).join(" · ");

  /* ------------------------------ Agent UI ------------------------------ */
  function chanBoxes(key, c) {
    const can = CN.channels(c);
    return `<div class="cn-ch">${[["app", "App"], ["email", "Email"], ["sms", "Text"]].map(([k, t]) => `<label title="${esc(can[k].ok ? "" : can[k].why)}"><input type="checkbox" data-cn-ch="${esc(key)}|${k}" ${can[k].ok ? "checked" : "disabled"}> ${t}${can[k].ok ? "" : ` <span class="addr">(${esc(can[k].why.toLowerCase())})</span>`}</label>`).join("")}</div>`;
  }
  const picked = key => [...document.querySelectorAll(`[data-cn-ch^="${key}|"]`)].filter(x => x.checked).map(x => x.dataset.cnCh.split("|").pop());
  function card(key, c, msg, actions) {
    const open = CN.open[key];
    return `<div class="cn-card" role="region" aria-label="Client update"><div class="cn-top"><div><strong>${esc(msg.title)}</strong><p>Send ${esc((c && c.name || "your client").split(" ")[0])} an update?</p></div><button class="remove" data-cn-toggle="${esc(key)}">${open ? "Hide preview" : "Preview"}</button></div>
      ${open ? `<pre class="cn-pre">${esc(msg.text)}</pre>${msg.ics ? `<p class="addr">Includes a calendar file.</p>` : ""}` : ""}
      ${chanBoxes(key, c)}<div class="quick">${actions}</div>${CN.msg[key] ? `<p class="msg" role="status">${esc(CN.msg[key])}</p>` : ""}</div>`;
  }
  CN.tourBanner = function (id) {
    const t = Store.crm.tours[id], ev = CN.tourNeeds(id, t);
    let html = "";
    if (ev) { const c = contact(t.contactId), msg = T().compose(ev, { ...tourData(id, t), client: c.name, lang: c.lang }); html += card("tour:" + id, c, msg, `<button class="btn gold" data-cn-sendtour="${id}">Send update</button><button class="btn ghost" data-cn-skiptour="${id}">Not now</button>`); }
    else if (t && t.contactId && t.notifiedAt) html += `<p class="addr cn-ok">✓ ${esc((contact(t.contactId) || {}).name || "Client")} was sent these details ${when(t.notifiedAt)}.</p>`;
    else if (t && !t.contactId) html += `<p class="addr">Pick a client to send them their showing times.</p>`;
    return html;
  };
  CN.homeHTML = function () {
    const n = CN.count(); if (!n) return "";
    return `<button class="notif fresh" data-panel="client-updates"><strong>${n} client ${n === 1 ? "update" : "updates"} ready to send</strong><time>Showing times your clients haven’t been sent yet</time></button>`;
  };
  CN.panelHTML = function () {
    const s = settings(), list = CN.pendingTours(), cancels = Object.values(CN.cancels);
    const log = Object.entries(Store.crm.notices || {}).filter(([, x]) => x).map(([id, x]) => ({ id, ...x })).sort((a, b) => (b.at || "").localeCompare(a.at || "")).slice(0, 30);
    let html = `<p class="addr">Keep clients in the loop automatically: showing times, changes, reminders the day before, and key dates on their transaction. Updates go to their app, email, and (with their consent) text.</p>`;
    html += `<div class="tourform"><label for="cnMode">When I schedule or change showings</label><select id="cnMode" data-cn-set="mode"><option value="ask" ${s.mode !== "auto" ? "selected" : ""}>Ask me before sending</option><option value="auto" ${s.mode === "auto" ? "selected" : ""}>Send automatically (15 seconds after my last change)</option></select>
      <label class="check"><input type="checkbox" data-cn-set="reminders" ${s.reminders !== false ? "checked" : ""}> Remind clients the day before their showings (sent at 8 AM)</label>
      <p class="addr">${C.NOTIFY_ENDPOINT ? "Email" + (C.SMS_ENABLED ? " and text" : "") + " sending is connected." : "Email and text sending turns on once the server is connected; app updates work now."} Texts only go to clients with consent on file, between 8 AM and 9 PM.</p></div>`;
    html += `<h3 class="agent-h">Ready to send <span class="addr">${list.length + cancels.length}</span></h3>`;
    html += list.length || cancels.length ? list.map(({ id, t, event }) => { const c = contact(t.contactId); return card("tour:" + id, c, T().compose(event, { ...tourData(id, t), lang: c && c.lang, client: c.name }), `<button class="btn gold" data-cn-sendtour="${id}">Send update</button><button class="btn ghost" data-panel="tour:${id}">Open showing day</button><button class="btn ghost" data-cn-skiptour="${id}">Not now</button>`); }).join("")
      + cancels.map(t => { const c = contact(t.contactId); return card("cancel:" + t.id, c, T().compose("showing_canceled", { ...tourData(t.id, t), client: c ? c.name : "", lang: c && c.lang }), `<button class="btn gold" data-cn-sendcancel="${t.id}">Send cancellation</button><button class="btn ghost" data-cn-dropcancel="${t.id}">Don’t send</button>`); }).join("")
      : `<div class="empty"><strong>All caught up</strong>Updates appear here when you schedule or change a client’s showings.</div>`;
    html += `<h3 class="agent-h">Send a quick update</h3><div class="tourform"><label for="cnTo">Client</label><select id="cnTo"><option value="">Choose a client</option>${contacts().map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("")}</select>
      <label for="cnSubj">Subject</label><input id="cnSubj" placeholder="An update on your search"><label for="cnMsg">Message</label><textarea id="cnMsg" rows="3" placeholder="Short and clear. Texts are trimmed to about 300 characters."></textarea>
      <div class="quick"><button class="btn gold" data-cn-custom>Send</button></div><p class="msg" id="cnCustomMsg" role="status"></p></div>`;
    html += `<h3 class="agent-h">Sent</h3>` + (log.length ? log.map(x => `<div class="pcard"><div class="pcard-top"><div><strong>${esc(x.title || x.subject)}</strong><p>${esc((contact(x.contactId) || {}).name || "Client")} · ${when(x.at)}${x.auto ? " · automatic" : ""}</p></div></div><p class="addr">${esc(summary(x.results))}</p></div>`).join("") : `<p class="addr">Nothing sent yet.</p>`);
    return html;
  };
  CN.dealHTML = function (id, d) {
    const c = d.contactId ? contact(d.contactId) : null, dates = (d.deadlines || []).filter(x => x.date && T().CLIENT_DATES.includes(x.label));
    if (!c) return `<h3 class="agent-h">Client updates</h3><p class="addr">Link this transaction to a client in Edit to send them updates on key dates.</p>`;
    return `<h3 class="agent-h">Client updates</h3><label class="check"><input type="checkbox" data-cn-dealauto="${esc(id)}" ${d.clientUpdates ? "checked" : ""}> Remind ${esc(c.name.split(" ")[0])} the day before key dates (${T().CLIENT_DATES.map(x => x.replace(/ (deadline|date)$/i, "").toLowerCase()).join(", ")})</label>
      ${dates.length ? `<div class="tourform"><div class="row2"><div><label for="cnDl">Send an update about</label><select id="cnDl">${dates.map((x, i) => `<option value="${i}">${esc(x.label)} · ${dayLabel(x.date)}</option>`).join("")}</select></div><div><label for="cnDlNote">Note (optional)</label><input id="cnDlNote" placeholder="e.g. The inspector arrives at 9."></div></div>
        ${chanBoxes("deal:" + id, c)}<div class="quick"><button class="btn ghost" data-cn-milestone="${esc(id)}">Send update</button></div>${CN.msg["deal:" + id] ? `<p class="msg" role="status">${esc(CN.msg["deal:" + id])}</p>` : ""}</div>` : `<p class="addr">Add contract dates to send milestone updates.</p>`}`;
  };
  // Contact form: how this client gets updates, and text consent.
  CN.contactFields = c => { const n = c.notify || {}; return `<fieldset class="cn-fs"><legend>Client updates</legend><label for="cnLang">Language for updates</label><select id="cnLang"><option value="en">English</option><option value="es" ${c.lang === "es" ? "selected" : ""}>Español</option></select><label class="check"><input type="checkbox" id="cnEmail" ${n.email !== false ? "checked" : ""}> Email updates</label>
    <label class="check"><input type="checkbox" id="cnSms" ${n.sms ? "checked" : ""}> Text updates</label><label class="check"><input type="checkbox" id="cnConsent" ${n.smsConsentAt ? "checked" : ""}> ${esc((c.name || "This client").split(" ")[0])} agreed to receive texts${n.smsConsentAt ? ` (recorded ${new Date(n.smsConsentAt).toLocaleDateString()}${n.smsConsentSource ? ", " + esc(n.smsConsentSource) : ""})` : ""}</label>
    <input type="hidden" id="cnConsentAt" value="${esc(n.smsConsentAt || "")}"><input type="hidden" id="cnConsentSrc" value="${esc(n.smsConsentSource || "")}"><p class="addr">Only check this if they told you yes, in writing or out loud. Texts need consent under federal law (TCPA).</p></fieldset>`; };
  CN.contactValues = () => { const g = id => document.getElementById(id); if (!g("cnEmail")) return {}; const consent = g("cnConsent").checked, was = g("cnConsentAt").value;
    return { lang: g("cnLang") ? g("cnLang").value : "en", notify: { email: g("cnEmail").checked, sms: g("cnSms").checked && consent, smsConsentAt: consent ? (was || now()) : "", smsConsentSource: consent ? (g("cnConsentSrc").value || "Recorded by agent") : "" } }; };

  /* Showing request → scheduled showing in one step */
  CN.requestForm = r => `<div class="cn-req"><label class="addr" for="cnRqD_${esc(r.rid)}">Schedule it</label><input type="date" id="cnRqD_${esc(r.rid)}" value="${esc(today())}"><input type="time" id="cnRqT_${esc(r.rid)}" aria-label="Time"><button class="btn ghost small" data-cn-schedule="${esc(r.cid)}|${esc(r.rid)}">Add to showings</button></div>`;
  function scheduleRequest(cid, rid) {
    const r = ((Store.leads[cid] || {}).requests || {})[rid]; if (!r) return;
    const date = document.getElementById("cnRqD_" + rid).value, time = document.getElementById("cnRqT_" + rid).value;
    if (!date) return;
    let c = Object.entries(Store.crm.contacts).find(([, x]) => x && (x.clientId === cid || (r.email && x.email === r.email)));
    let contactId = c ? c[0] : Store.saveCrm("contacts", null, { name: r.name || "New client", email: r.email || "", phone: r.phone || "", role: "buyer", buyerStage: "touring", clientId: cid, source: "Showing request", createdAt: now(), updatedAt: now() });
    const cont = contact(contactId);
    let [tid, tour] = Object.entries(Store.crm.tours).find(([, t]) => t && t.contactId === contactId && t.date === date) || [];
    const stop = { listingKey: r.listingKey, time: time || "", note: "" };
    if (tour) { const tt = JSON.parse(JSON.stringify(tour)); tt.stops = (tt.stops || []).filter(s => s.listingKey !== r.listingKey).concat(stop).sort((a, b) => (a.time || "99").localeCompare(b.time || "99")); tt.updatedAt = now(); Store.saveTour(tid, tt); }
    else tid = Store.saveTour(null, { name: `${cont.name} showings`, date, contactId, clientId: cont.clientId || "", stops: [stop], shared: !!cont.clientId, createdAt: now() });
    Store.setLeadStatus(cid, rid, "showing");
    agentPanel = "tour:" + tid; renderAgent(); window.scrollTo(0, 0);
  }

  /* ------------------------------ Client UI ------------------------------ */
  function watchInbox() {
    if (CN.watching || !Store.db || Store.demo || Store.isAgent || !Store.uid) return; CN.watching = true;
    Store.db.collection(`boards/${Store.uid}/inbox`).onSnapshot(sn => { const m = {}; sn.docs.forEach(d => { m[d.id] = d.data(); }); CN.inbox = m; Store.emit(); }, () => {});
    Store.db.doc(`boards/${Store.uid}/prefs/notify`).get().then(s => { if (s.exists) { CN.prefs = s.data(); Store.emit(); } }).catch(() => {});
  }
  const items = () => (Store.demo ? CN.demoInbox.map(x => [x.id, x]) : Object.entries(CN.inbox)).filter(([, x]) => x).sort((a, b) => (b[1].at || "").localeCompare(a[1].at || ""));
  CN.unread = () => items().filter(([, x]) => !x.read).length;
  CN.clientHTML = function () {
    if (Store.isAgent && !Store.demo) return "";
    watchInbox();
    const list = items().slice(0, 8), p = CN.prefs || {};
    if (!list.length && !Store.uid && !Store.demo) return "";
    return `<h3 class="agent-h">${tr("Updates from", "Novedades de")} ${esc(IDX.BROKER.name.split(" ")[0])}${CN.unread() ? ` <span class="cn-dot">${CN.unread()} ${tr("new", "nuevas")}</span>` : ""}</h3>
      ${list.length ? list.map(([id, x]) => `<div class="client cn-item ${x.read ? "" : "fresh"}"><h3>${esc(x.title)}</h3><p class="addr" style="margin:2px 0 6px">${when(x.at)}</p><pre class="cn-pre">${esc(String(x.text || "").split("\n\n").slice(1, -1).join("\n\n") || x.text)}</pre>
        <div class="quick">${x.ics ? `<button class="btn ghost" data-cn-ics="${esc(id)}">${tr("Add to calendar", "Agregar al calendario")}</button>` : ""}${/^showing_(scheduled|updated|reminder)$/.test(x.event) ? `<button class="btn ghost" data-cn-reply="${esc(id)}|confirm">${tr("Confirm", "Confirmar")}</button><button class="btn ghost" data-cn-reply="${esc(id)}|change">${tr("Need a different time", "Necesito otro horario")}</button>` : ""}${!x.read ? `<button class="btn ghost" data-cn-read="${esc(id)}">${tr("Mark read", "Marcar como leída")}</button>` : ""}</div>${x.response ? `<p class="addr">${tr("You replied:", "Usted respondió:")} ${esc(x.response === "confirm" ? tr("Confirmed", "Confirmado") : tr("Asked for a different time", "Pidió otro horario"))}</p>` : ""}</div>`).join("")
        : `<p class="addr">${tr("Showing times and updates on your purchase or sale appear here.", "Aquí aparecen los horarios de visitas y las novedades de su compra o venta.")}</p>`}
      <details class="cn-prefs"><summary>${tr("How I get updates", "Cómo recibo las novedades")}</summary><div class="tourform"><label class="check"><input type="checkbox" id="cnPE" ${p.email !== false ? "checked" : ""}> ${tr("Email", "Correo electrónico")}</label>
        <label class="check"><input type="checkbox" id="cnPS" ${p.sms ? "checked" : ""}> ${tr("Text messages", "Mensajes de texto")}</label><label for="cnPP">${tr("Mobile number", "Número de celular")}</label><input id="cnPP" type="tel" autocomplete="tel" value="${esc(p.phone || "")}">
        <p class="addr">${tr(`By turning on texts, you agree that ${esc(IDX.BROKER.name)} of ${esc(IDX.BROKER.firm || "The Miller Group")} may send you automated texts about your showings and transaction. Consent isn’t a condition of any purchase. Message frequency varies; message and data rates may apply. Reply STOP to opt out, HELP for help.`, `Al activar los mensajes de texto, usted acepta que ${esc(IDX.BROKER.name)} de ${esc(IDX.BROKER.firm || "The Miller Group")} le envíe mensajes de texto automáticos sobre sus visitas y su transacción. El consentimiento no es condición para ninguna compra. La frecuencia de los mensajes varía; pueden aplicarse tarifas de mensajes y datos. Responda STOP para cancelar y HELP para ayuda.`)}</p>
        <div class="quick"><button class="btn gold" data-cn-saveprefs>${tr("Save", "Guardar")}</button></div><p class="msg" id="cnPrefsMsg" role="status"></p></div></details>`;
  };
  async function markRead(id, extra = {}) {
    if (Store.demo) { const x = CN.demoInbox.find(i => i.id === id); if (x) Object.assign(x, { read: true }, extra); Store.emit(); return; }
    CN.inbox[id] = { ...CN.inbox[id], read: true, ...extra }; Store.emit();
    try { await Store.db.doc(`boards/${Store.uid}/inbox/${id}`).set(CN.inbox[id]); } catch (e) {}
  }

  /* ------------------------------ Styles ------------------------------ */
  if (!document.getElementById("cnStyles")) {
    const st = document.createElement("style"); st.id = "cnStyles";
    st.textContent = `.cn-card{background:var(--surface);border:1px solid var(--line);border-left:4px solid var(--gold);border-radius:12px;padding:12px 14px;margin:10px 0}.cn-top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.cn-top p{margin:2px 0 0;font-size:13px;color:var(--ink-2)}
.cn-pre{white-space:pre-wrap;font:14px/1.5 var(--sans);background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:10px 12px;margin:8px 0;max-height:260px;overflow:auto}
.cn-ch{display:flex;flex-wrap:wrap;gap:6px 16px;margin:8px 0;font-size:14px}.cn-ok{margin:8px 0}.cn-fs{border:1px solid var(--line);border-radius:10px;padding:8px 12px;margin:10px 0}.cn-fs legend{font-weight:600;padding:0 4px}
.cn-req{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:8px}.cn-req input{padding:6px 8px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink)}
.cn-dot{font:600 12px var(--sans);background:var(--accent,var(--gold));color:#fff;border-radius:999px;padding:2px 8px;vertical-align:middle}.cn-item.fresh{border-left:4px solid var(--gold)}.cn-prefs{margin:10px 0}.cn-prefs summary{cursor:pointer;font-weight:600}`;
    document.head.appendChild(st);
  }

  /* ------------------------------ Events ------------------------------ */
  document.addEventListener("click", async e => {
    const el = e.target.closest("[data-cn-toggle],[data-cn-sendtour],[data-cn-skiptour],[data-cn-sendcancel],[data-cn-dropcancel],[data-cn-custom],[data-cn-milestone],[data-cn-schedule],[data-cn-ics],[data-cn-reply],[data-cn-read],[data-cn-saveprefs]"); if (!el) return; const d = el.dataset;
    if (d.cnToggle !== undefined) { CN.open[d.cnToggle] = !CN.open[d.cnToggle]; renderAgent(); }
    else if (d.cnSendtour !== undefined) { const key = "tour:" + d.cnSendtour, ch = picked(key); if (!ch.length) { CN.msg[key] = "Pick at least one way to send it."; renderAgent(); return; } el.disabled = true; try { const r = await CN.sendTour(d.cnSendtour, { channels: ch }); CN.msg[key] = ""; CN.lastSent = r ? summary(r.results) : ""; if (typeof toast === "function" && CN.lastSent) toast("Update sent. " + CN.lastSent); } catch (err) { CN.msg[key] = err.message; } renderAgent(); }
    else if (d.cnSkiptour !== undefined) { CN.skipTour(d.cnSkiptour); renderAgent(); }
    else if (d.cnSendcancel !== undefined) { const ch = picked("cancel:" + d.cnSendcancel); await CN.sendCancel(d.cnSendcancel, { channels: ch.length ? ch : undefined }); renderAgent(); }
    else if (d.cnDropcancel !== undefined) { delete CN.cancels[d.cnDropcancel]; renderAgent(); }
    else if (d.cnCustom !== undefined) {
      const to = document.getElementById("cnTo").value, subject = document.getElementById("cnSubj").value.trim(), message = document.getElementById("cnMsg").value.trim(), m = document.getElementById("cnCustomMsg");
      if (!to || !message) { m.textContent = "Pick a client and write a message."; return; }
      try { const r = await deliver(to, "custom", { subject, message }); m.textContent = "Sent. " + summary(r.results); document.getElementById("cnMsg").value = ""; } catch (err) { m.textContent = err.message; }
    }
    else if (d.cnMilestone !== undefined) {
      const id = d.cnMilestone, deal = Office.deals[id], dates = (deal.deadlines || []).filter(x => x.date && T().CLIENT_DATES.includes(x.label)), x = dates[+document.getElementById("cnDl").value];
      const ch = picked("deal:" + id); if (!x || !ch.length) return;
      try { const r = await deliver(deal.contactId, "milestone", { label: x.label, date: x.date, address: deal.address, note: document.getElementById("cnDlNote").value.trim() }, { channels: ch, dealId: id }); CN.msg["deal:" + id] = "Sent. " + summary(r.results); } catch (err) { CN.msg["deal:" + id] = err.message; }
      renderAgent();
    }
    else if (d.cnSchedule !== undefined) { const [cid, rid] = d.cnSchedule.split("|"); scheduleRequest(cid, rid); }
    else if (d.cnIcs !== undefined) { const x = (Store.demo ? CN.demoInbox.find(i => i.id === d.cnIcs) : CN.inbox[d.cnIcs]) || {}; if (!x.ics) return; const u = URL.createObjectURL(new Blob([x.ics], { type: "text/calendar" })), a = document.createElement("a"); a.href = u; a.download = "showings.ics"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 3000); }
    else if (d.cnReply !== undefined) {
      const [id, kind] = d.cnReply.split("|"), x = (Store.demo ? CN.demoInbox.find(i => i.id === id) : CN.inbox[id]) || {};
      const text = kind === "confirm" ? `Confirmed: ${x.title}. See you then!` : `About ${x.title}: could we find a different time?`;
      if (Store.uid && Store.sendMessage && !Store.demo) Store.sendMessage(Store.uid, "client", text, "");
      await markRead(id, { response: kind, respondedAt: now() });
      if (kind === "change" && typeof openClientChat === "function") openClientChat("");
    }
    else if (d.cnRead !== undefined) markRead(d.cnRead);
    else if (d.cnSaveprefs !== undefined) {
      const g = id => document.getElementById(id), m = g("cnPrefsMsg"), phone = g("cnPP").value.trim(), sms = g("cnPS").checked;
      if (sms && phone.replace(/\D/g, "").length < 10) { m.textContent = tr("Add a mobile number for texts.", "Agregue un número de celular para los mensajes."); return; }
      const p = { email: g("cnPE").checked, sms, phone, smsConsentAt: sms ? ((CN.prefs || {}).smsConsentAt || now()) : "", smsConsentText: sms ? (L() === "es" ? "Aceptó en la app (en español) recibir mensajes de texto automáticos sobre visitas y transacciones; STOP para cancelar." : "Agreed in the client app to automated texts about showings and transactions; STOP to opt out.") : "", lang: L(), updatedAt: now() };
      CN.prefs = p;
      if (!Store.demo && Store.db && Store.uid) { try { await Store.db.doc(`boards/${Store.uid}/prefs/notify`).set(p); m.textContent = tr("Saved.", "Guardado."); } catch (err) { m.textContent = tr("Couldn’t save. Try again.", "No se guardó. Inténtelo de nuevo."); } } else m.textContent = tr("Saved (demo).", "Guardado (demo).");
    }
  });
  document.addEventListener("change", e => {
    const d = e.target.dataset || {};
    if (d.cnSet) { const s = { ...settings(), [d.cnSet]: e.target.type === "checkbox" ? e.target.checked : e.target.value }; Store.saveSettings({ clientUpdates: s }); renderAgent(); }
    else if (d.cnDealauto !== undefined) { const id = d.cnDealauto, deal = JSON.parse(JSON.stringify(Office.deals[id])); deal.clientUpdates = e.target.checked; Office._t.saveDeal(id, deal); renderAgent(); }
  });
  CN._t = { sig, tourData, scheduleRequest, items };
})();
