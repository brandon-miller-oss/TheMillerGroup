/* =========================================================================
   The Miller Group: showing coverage.
   An agent who can't make a showing, open house, inspection, or lockbox
   appointment posts it. Another Miller Group agent claims it. Fees are
   recorded here and paid by the brokerage, never agent to agent.
   - coverage/<id>          the request (every agent reads; the poster edits)
   - coverage/<id>/access   lockbox code, gate code, parking (only the poster
                            and the agent who claimed it can read)
   Claiming and releasing go through claim_coverage() so two agents can't
   take the same request.
   ========================================================================= */
(function () {
  const CV = window.Coverage = { items: {}, access: {}, watching: false, tab: "open", edit: null, msg: "", seen: {} };
  const KINDS = { showing: "Showing", openhouse: "Open house", inspection: "Inspection or appraisal access", lockbox: "Lockbox or sign drop", other: "Other" };
  const now = () => new Date().toISOString();
  const today = () => typeof localDay === "function" ? localDay() : new Date().toLocaleDateString("en-CA");
  const me = () => Store.demo ? Store.crmOwner : Store.uid;
  const meName = () => ((Store.team || {})[me()] || {}).name || "";
  const newId = () => "cv" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const fee = n => n > 0 ? "$" + Math.round(n).toLocaleString("en-US") : "";
  const tm = t => typeof fmtTime === "function" ? fmtTime(t) : t;
  const day = d => typeof dayLabel === "function" ? dayLabel(d) : d;
  const list = () => Object.entries(CV.items).filter(([, x]) => x).map(([id, x]) => ({ id, ...x }));
  const upcoming = x => (x.date || "") >= today();
  CV.watch = function () {
    if (CV.watching || !Store.db || Store.demo || !Store.isAgent) return; CV.watching = true;
    Store.db.collection("coverage").onSnapshot(sn => { const m = {}; sn.docs.forEach(d => { m[d.id] = d.data(); }); CV.items = m; Store.emit(); }, () => {});
  };
  CV.openForMe = () => list().filter(x => x.status === "open" && x.agentId !== me() && upcoming(x));
  CV.count = () => { CV.watch(); return CV.openForMe().filter(x => !CV.seen[x.id]).length; };

  async function loadAccess(id) {
    if (CV.access[id] !== undefined) return;
    CV.access[id] = null;
    if (Store.demo || !Store.db) { CV.access[id] = (CV.demoAccess || {})[id] || { notes: "" }; Store.emit(); return; }
    try { const d = await Store.db.doc(`coverage/${id}/access`).get(); CV.access[id] = d.exists ? d.data() : { notes: "" }; } catch (e) { CV.access[id] = { notes: "" }; }
    if (typeof renderAgent === "function" && agentPanel === "coverage") renderAgent();
  }

  async function save(id, x, accessNotes) {
    id = id || newId();
    CV.items[id] = x; Store.emit();
    if (Store.demo || !Store.db) { if (accessNotes !== undefined) { CV.demoAccess = CV.demoAccess || {}; CV.demoAccess[id] = { notes: accessNotes, agentId: me() }; CV.access[id] = CV.demoAccess[id]; } return id; }
    await Store.queue("cv:" + id, () => x ? Store.db.doc(`coverage/${id}`).set(x) : Store.db.doc(`coverage/${id}`).delete());
    if (accessNotes !== undefined && x) { await Store.queue("cva:" + id, () => Store.db.doc(`coverage/${id}/access`).set({ notes: accessNotes, agentId: me(), at: now() })); CV.access[id] = { notes: accessNotes }; }
    return id;
  }
  async function claim(id, take) {
    const x = CV.items[id]; if (!x) return;
    if (Store.demo || !window.MillerCloud) {
      CV.items[id] = take ? { ...x, status: "claimed", claimedBy: me(), claimedName: meName(), claimedAt: now() } : (({ claimedBy, claimedName, claimedAt, ...r }) => ({ ...r, status: "open", releasedAt: now() }))(x);
      delete CV.access[id]; return;
    }
    const r = await MillerCloud.rpc("claim_coverage", { p_id: id, p_take: take });
    CV.items[id] = r; delete CV.access[id];
  }

  /* ------------------------------ Views ------------------------------ */
  const card = x => {
    const mine = x.agentId === me(), claimedByMe = x.claimedBy === me(), st = x.status || "open";
    if (claimedByMe || (mine && x.claimedBy)) loadAccess(x.id);
    const acc = CV.access[x.id];
    return `<div class="pcard cv-card ${st}"><div class="pcard-top"><div><strong>${esc(KINDS[x.kind] || "Showing")}: ${esc(x.address || "Address to come")}</strong>
      <p>${esc(day(x.date))}${x.start ? ` · ${esc(tm(x.start))}${x.end ? "–" + esc(tm(x.end)) : ""}` : ""}${x.fee > 0 ? ` · <b>${fee(x.fee)}</b> paid by the brokerage` : " · Volunteer"}</p></div>
      <span class="cv-st">${st === "open" ? "Open" : st === "claimed" ? (claimedByMe ? "You’re covering" : `Covered by ${esc(x.claimedName || "an agent")}`) : st === "done" ? "Done" : "Canceled"}</span></div>
      ${x.details ? `<p class="addr" style="white-space:pre-wrap">${esc(x.details)}</p>` : ""}
      <p class="addr">Posted by ${esc(mine ? "you" : x.agentName || "an agent")}${x.phone && !mine ? ` · <a href="tel:${esc(String(x.phone).replace(/\D/g, ""))}">${esc(x.phone)}</a>` : ""}</p>
      ${(claimedByMe || mine) && acc && acc.notes ? `<div class="cv-acc"><strong>Access notes</strong><span>${esc(acc.notes)}</span></div>` : ""}
      <div class="quick">${!mine && st === "open" ? `<button class="btn gold" data-cv-claim="${esc(x.id)}">I’ll cover it</button>` : ""}
        ${claimedByMe && st === "claimed" ? `<button class="btn ghost" data-cv-release="${esc(x.id)}">I can’t make it</button>` : ""}
        ${mine && st !== "done" && st !== "canceled" ? `<button class="btn ghost" data-cv-edit="${esc(x.id)}">Edit</button>${st === "claimed" ? `<button class="btn ghost" data-cv-done="${esc(x.id)}">Mark done</button>` : ""}<button class="btn ghost" data-cv-cancel="${esc(x.id)}">Cancel request</button>` : ""}</div></div>`;
  };

  // Prefill from my upcoming showing days and open houses.
  function prefillOptions() {
    const out = [], t = today();
    Object.entries(Store.crm.tours || {}).filter(([, x]) => x && (x.date || "") >= t).forEach(([id, x]) => (x.stops || []).forEach((s, i) => out.push({ v: `t|${id}|${i}`, label: `Showing ${day(x.date)}${s.time ? " " + tm(s.time) : ""}: ${typeof addrOf === "function" ? addrOf(s.listingKey) : s.listingKey}`, kind: "showing", date: x.date, start: s.time || "", address: typeof addrOf === "function" ? addrOf(s.listingKey) : "", listingKey: s.listingKey })));
    Object.entries(Store.crm.openhouses || {}).filter(([, x]) => x && (x.date || "") >= t).forEach(([id, x]) => out.push({ v: `o|${id}`, label: `Open house ${day(x.date)} ${tm(x.start)}: ${typeof addrOf === "function" ? addrOf(x.listingKey) : x.listingKey}`, kind: "openhouse", date: x.date, start: x.start || "", end: x.end || "", address: typeof addrOf === "function" ? addrOf(x.listingKey) : "", listingKey: x.listingKey }));
    return out;
  }
  CV._prefill = prefillOptions;

  function formHTML(id) {
    const x = id ? CV.items[id] || {} : { kind: "showing", date: today() }, acc = id ? (CV.access[id] || {}).notes || "" : "";
    if (id) loadAccess(id);
    const pre = id ? [] : prefillOptions();
    return `<div class="tourform cv-form"><h3 class="agent-h">${id ? "Edit request" : "Ask for coverage"}</h3>
      ${pre.length ? `<label for="cvPre">Start from</label><select id="cvPre" data-cv-pre><option value="">Something new</option>${pre.map(p => `<option value="${esc(p.v)}">${esc(p.label)}</option>`).join("")}</select>` : ""}
      <div class="row2"><div><label for="cvKind">What</label><select id="cvKind">${Object.entries(KINDS).map(([k, v]) => `<option value="${k}" ${x.kind === k ? "selected" : ""}>${v}</option>`).join("")}</select></div><div><label for="cvDate">Date</label><input id="cvDate" type="date" value="${esc(x.date || "")}"></div></div>
      <div class="row2"><div><label for="cvStart">Start</label><input id="cvStart" type="time" value="${esc(x.start || "")}"></div><div><label for="cvEnd">End</label><input id="cvEnd" type="time" value="${esc(x.end || "")}"></div></div>
      <label for="cvAddr">Address</label><input id="cvAddr" value="${esc(x.address || "")}"><input type="hidden" id="cvKey" value="${esc(x.listingKey || "")}">
      <label for="cvDetails">Details every agent can see</label><textarea id="cvDetails" rows="3" placeholder="e.g. First-time buyers, pre-approved. Meet them out front; they’ll want to see the basement.">${esc(x.details || "")}</textarea>
      <label for="cvAccess">Access notes (only the agent who covers it sees these)</label><textarea id="cvAccess" rows="2" placeholder="Lockbox code, gate code, alarm, parking">${esc(acc)}</textarea>
      <div class="row2"><div><label for="cvFee">Fee ($, optional)</label><input id="cvFee" inputmode="decimal" value="${x.fee > 0 ? esc(x.fee) : ""}" placeholder="Leave blank to ask a favor"></div><div><label for="cvPhone">Your phone</label><input id="cvPhone" type="tel" value="${esc(x.phone || ((Store.team || {})[me()] || {}).phone || "")}"></div></div>
      <p class="addr">Fees are paid by The Miller Group out of your share, never agent to agent: Colorado brokers can only be paid through their employing broker. You stay the client’s broker; the agent covering represents you for this appointment only. Don’t put client contact details in the notes.</p>
      <div class="quick"><button class="btn gold" data-cv-save="${esc(id || "")}">${id ? "Save" : "Post request"}</button><button class="btn ghost" data-cv-close>Cancel</button></div><p class="msg" role="status">${esc(CV.msg)}</p></div>`;
  }

  CV.html = function () {
    CV.watch();
    CV.openForMe().forEach(x => { CV.seen[x.id] = true; });
    const all = list().sort((a, b) => ((a.date || "") + (a.start || "")).localeCompare((b.date || "") + (b.start || "")));
    const tabs = [["open", `Open (${CV.openForMe().length})`], ["mine", "My requests"], ["covering", "I’m covering"]].concat(Store.isBroker ? [["fees", "Fees to pay"]] : []);
    let html = `<p class="addr">Can’t make a showing or open house? Post it here and another Miller Group agent can pick it up.</p>
      <div class="quick">${tabs.map(([k, v]) => `<button class="btn ${CV.tab === k ? "gold" : "ghost"} small" data-cv-tab="${k}">${v}</button>`).join("")}<button class="btn ghost small" data-cv-new>Ask for coverage</button></div>`;
    if (CV.edit !== null) html += formHTML(CV.edit || "");
    let rows;
    if (CV.tab === "open") rows = CV.openForMe();
    else if (CV.tab === "mine") rows = all.filter(x => x.agentId === me() && (upcoming(x) || x.status === "claimed"));
    else if (CV.tab === "covering") rows = all.filter(x => x.claimedBy === me() && x.status !== "canceled");
    else rows = all.filter(x => x.fee > 0 && x.status === "done");
    if (CV.tab === "fees") {
      const owed = rows.filter(x => !x.feePaid), paid = rows.filter(x => x.feePaid).slice(-10);
      html += owed.length ? owed.map(x => `<div class="pcard"><div class="pcard-top"><div><strong>${fee(x.fee)} to ${esc(x.claimedName || "agent")}</strong><p>${esc(KINDS[x.kind] || "")} · ${esc(x.address || "")} · ${esc(day(x.date))} · posted by ${esc(x.agentName || "")}</p></div><button class="btn gold small" data-cv-paid="${esc(x.id)}">Mark paid</button></div></div>`).join("") : `<div class="empty"><strong>Nothing to pay</strong>Completed coverage with a fee shows here.</div>`;
      if (paid.length) html += `<h3 class="agent-h">Recently paid</h3>` + paid.map(x => `<p class="addr">${fee(x.fee)} to ${esc(x.claimedName || "")} · ${esc(x.address || "")} · paid ${new Date(x.paidAt).toLocaleDateString()}</p>`).join("");
      return html;
    }
    html += rows.length ? rows.map(card).join("") : `<div class="empty"><strong>${CV.tab === "open" ? "Nothing open right now" : CV.tab === "mine" ? "No requests" : "Nothing claimed"}</strong>${CV.tab === "open" ? "When an agent needs coverage, it shows here and on your home tile." : CV.tab === "mine" ? "Use “Ask for coverage” when you can’t make an appointment." : "Requests you pick up show here with their access notes."}</div>`;
    return html;
  };

  CV.seedDemo = function () {
    const d = n => { const x = new Date(); x.setDate(x.getDate() + n); return x.toLocaleDateString("en-CA"); };
    CV.items = {
      dcv1: { kind: "showing", date: d(1), start: "17:30", end: "18:00", address: "4473 Brenning St", listingKey: "S-1010", details: "Relocating buyers, pre-approved. They want to check the sewer line history and the garden lot.", fee: 40, phone: "720-555-0150", agentId: "demo-agent", agentName: "Alex Rivera", status: "open", createdAt: now() },
      dcv2: { kind: "openhouse", date: d(6), start: "11:00", end: "13:00", address: "2675 S Gilpin St", listingKey: "PX-dx1", details: "Sign-in on the iPad at the door; offer the feature sheet.", fee: 0, agentId: "demo-broker", agentName: "Brandon Miller", status: "claimed", claimedBy: "demo-agent", claimedName: "Alex Rivera", claimedAt: now(), createdAt: now() },
      dcv3: { kind: "showing", date: d(-3), start: "10:00", address: "1452 S Orwell St", fee: 50, agentId: "demo-agent", agentName: "Alex Rivera", status: "done", claimedBy: "demo-broker", claimedName: "Brandon Miller", doneAt: now(), createdAt: now() }
    };
    CV.demoAccess = { dcv1: { notes: "Supra lockbox on the side gate. Park on the street." }, dcv2: { notes: "Code 4471 for the garage keypad." } };
  };

  if (Store.demo && !Object.keys(CV.items).length) CV.seedDemo();
  if (!document.getElementById("cvStyles")) {
    const st = document.createElement("style"); st.id = "cvStyles";
    st.textContent = `.cv-st{font-size:12px;font-weight:600;border:1px solid var(--line);border-radius:999px;padding:2px 9px;white-space:nowrap}.cv-card.open{border-left:4px solid var(--gold)}.cv-card.done,.cv-card.canceled{opacity:.75}
.cv-acc{display:flex;flex-direction:column;background:var(--bg);border:1px dashed var(--line);border-radius:8px;padding:8px 10px;margin:8px 0;font-size:14px}.cv-form{margin:10px 0}`;
    document.head.appendChild(st);
  }

  const rerender = () => { if (typeof renderAgent === "function") renderAgent(); };
  document.addEventListener("click", async e => {
    const el = e.target.closest("[data-cv-tab],[data-cv-new],[data-cv-close],[data-cv-save],[data-cv-claim],[data-cv-release],[data-cv-edit],[data-cv-done],[data-cv-cancel],[data-cv-paid]"); if (!el) return; const d = el.dataset;
    try {
      if (d.cvTab) { CV.tab = d.cvTab; CV.edit = null; }
      else if (d.cvNew !== undefined) { CV.edit = ""; CV.msg = ""; }
      else if (d.cvClose !== undefined) CV.edit = null;
      else if (d.cvEdit) { CV.edit = d.cvEdit; CV.msg = ""; }
      else if (d.cvSave !== undefined) {
        const g = id => (document.getElementById(id) || {}).value || "";
        const date = g("cvDate"), address = g("cvAddr").trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !address) { CV.msg = "Add a date and an address."; rerender(); return; }
        const f = parseFloat(g("cvFee").replace(/[$,]/g, ""));
        const prev = d.cvSave ? CV.items[d.cvSave] || {} : {};
        const x = { ...prev, kind: g("cvKind"), date, start: g("cvStart"), end: g("cvEnd"), address: address.slice(0, 200), listingKey: g("cvKey"), details: g("cvDetails").trim().slice(0, 1000), fee: isFinite(f) && f > 0 ? Math.min(f, 1000) : 0, phone: g("cvPhone").trim().slice(0, 30), agentId: prev.agentId || me(), agentName: prev.agentName || meName(), status: prev.status || "open", updatedAt: now(), createdAt: prev.createdAt || now() };
        await save(d.cvSave || null, x, g("cvAccess").trim().slice(0, 500));
        CV.edit = null; CV.msg = ""; CV.tab = "mine"; if (typeof toast === "function") toast("Coverage request posted");
      }
      else if (d.cvClaim) { await claim(d.cvClaim, true); CV.tab = "covering"; if (typeof toast === "function") toast("It’s yours. Access notes are on the card."); }
      else if (d.cvRelease) { if (!confirm("Give this back so another agent can cover it?")) return; await claim(d.cvRelease, false); }
      else if (d.cvDone) { const x = CV.items[d.cvDone]; await save(d.cvDone, { ...x, status: "done", doneAt: now() }); }
      else if (d.cvCancel) { if (!confirm("Cancel this request?")) return; const x = CV.items[d.cvCancel]; await save(d.cvCancel, { ...x, status: "canceled", canceledAt: now() }); }
      else if (d.cvPaid) { const x = CV.items[d.cvPaid]; await save(d.cvPaid, { ...x, feePaid: true, paidAt: now() }); }
    } catch (err) { CV.msg = (err && err.message) || "That didn’t work. Try again."; if (typeof toast === "function") toast(CV.msg); }
    rerender();
  });
  document.addEventListener("change", e => {
    if (!e.target.matches("[data-cv-pre]")) return;
    const p = prefillOptions().find(o => o.v === e.target.value); if (!p) return;
    const s = (id, v) => { const el = document.getElementById(id); if (el && v !== undefined) el.value = v; };
    s("cvKind", p.kind); s("cvDate", p.date); s("cvStart", p.start); s("cvEnd", p.end || ""); s("cvAddr", p.address); s("cvKey", p.listingKey || "");
  });
})();
