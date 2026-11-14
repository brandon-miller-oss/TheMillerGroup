/* =========================================================================
   The Miller Group — Scripts and writing (AI writer for agents).
   Listing descriptions, listing presentations, price talks, objection
   handling, prospecting calls, follow-ups, and more. Pulls facts from a
   listing, contact, or CMA so the AI writes from real details. Built-in
   starter scripts work with no AI connected. Saved scripts live at
   agent/<uid>/crm/scripts.
   ========================================================================= */
(function () {
  const W = window.Writer = { type: "description", listing: "", contact: "", cma: "", tone: "warm", length: "medium", notes: "", out: "", busy: false, ctl: null, msg: "" };

  // [id, label, group, uses, guidance for the AI]
  const TYPES = [
    ["description", "Listing description", "Listings", ["listing"], "Write MLS public remarks and a short headline. Describe the home, its features, and the setting. Keep it under the character limit the agent sets (default 1,000 characters for the remarks)."],
    ["presentation", "Listing presentation script", "Listings", ["contact", "cma", "listing"], "Write a spoken talk track for a seller appointment: open with questions about their goals, walk through the market and the CMA range, the marketing plan, the process and timeline, and close by asking for the listing. Include short pauses for the seller to answer."],
    ["price", "Pricing conversation", "Listings", ["contact", "cma", "listing"], "Write a talk track for discussing price with a seller, using the CMA range. Be honest and data based, explain the risk of overpricing, and offer a clear recommendation. If the home has been on the market, cover a price adjustment."],
    ["video", "Listing video script", "Listings", ["listing"], "Write a 60 to 90 second walkthrough video script with shot cues in brackets and narration lines."],
    ["openhouse", "Open house follow-up", "Listings", ["listing", "contact"], "Write a short text message and a short email to send a visitor the day after an open house, with one helpful offer and a soft question."],
    ["objection", "Objection handling", "Conversations", ["contact"], "Write responses to the objection the agent describes in the notes (for example: we want to wait, another agent quoted a higher price, we'll sell it ourselves, your fee is too high). For each, acknowledge, ask a question, and respond with value. Keep each to a few sentences."],
    ["expired", "Expired listing call", "Prospecting", ["listing"], "Write a respectful phone script for calling an owner whose listing expired: introduce, acknowledge their frustration, ask what they think happened, and offer a short meeting."],
    ["fsbo", "For sale by owner call", "Prospecting", ["listing"], "Write a phone script for an owner selling on their own: respect their choice, offer something useful (like a buyer showing or market data), and ask permission to follow up."],
    ["circle", "Just listed / just sold calls", "Prospecting", ["listing"], "Write a short neighborhood call script and matching door-knock version announcing a nearby listing or sale and asking if they know anyone who might want to live nearby, or are thinking of moving."],
    ["sphere", "Sphere and past client check-in", "Prospecting", ["contact"], "Write a friendly check-in call script and a matching text message for someone the agent already knows. Personal, not salesy, with one ask for referrals."],
    ["buyer", "Buyer consultation script", "Conversations", ["contact"], "Write a buyer consultation talk track: their goals, budget and financing, the search and offer process, how the agent is paid under a written buyer agreement, and next steps."],
    ["offer", "Offer cover note", "Conversations", ["listing"], "Write a short, professional cover note from the buyer's agent to the listing agent summarizing the offer's strengths (price, financing, earnest money, inspection and closing timeline, flexibility). Terms only: no personal stories, photos, or details about the buyers themselves."],
    ["custom", "Something else", "Other", ["listing", "contact", "cma"], "Write what the agent describes in the notes."]
  ];
  const typeOf = id => TYPES.find(x => x[0] === id) || TYPES[0];

  // Starter scripts: work with no AI connected. {placeholders} fill from the chosen listing, contact, and CMA.
  const STARTERS = {
    description: "{headline}\n\nWelcome to {address} in {hood}: {beds} bedrooms, {baths} bathrooms, and {sqft} square feet. [Describe the main living space and kitchen.] [Describe the primary suite.] [Describe outdoor space, parking, and storage.] Close to [nearby parks, shops, or transit]. Schedule your showing with {agent}.",
    presentation: "Thanks for having me. Before I share anything, what’s most important to you about this move? [Pause.] And what timing are you working with? [Pause.]\n\nHere’s what the market is telling us. Homes like yours nearby point to a range of {range}. [Walk through two or three comps.]\n\nHere’s how I’d market it: professional photos and video, a strong first week online, open houses, and outreach to buyers already searching in {hood}.\n\nFrom here, the steps are prep, photos, launch, showings, offers, and closing. I’ll update you every week.\n\nDo you have any questions before we talk about next steps? [Pause.] I’d love to help you sell your home. Shall we get started?",
    price: "I want to be straightforward with you about price. The homes most like yours point to {range}. [Explain the closest two comps.]\n\nBuyers compare your home to these. If we start above the range, we risk sitting while new listings take the attention, and that usually costs more than starting right.\n\nMy recommendation is [price], and here’s why. [Reason.] How does that feel to you?",
    video: "[Exterior, slow push in] Welcome to {address}.\n[Entry] Step inside to [feature].\n[Living and kitchen] [Describe the main space.]\n[Primary suite] [Describe.]\n[Outdoor] [Describe.]\n[Neighborhood b-roll] All in {hood}.\n[Agent on camera] I’m {agent} with {firm}. Reach out to see it in person.",
    openhouse: "Text: Hi {client_first}, it’s {agent}. Thanks for stopping by {address} yesterday. Any questions I can answer, or anything else you’d like to see?\n\nEmail subject: Thanks for visiting {address}\n\nHi {client_first},\n\nThanks for coming to the open house. If it helps, I’m happy to send the disclosures, recent sales nearby, or set up a private showing. Was there anything you liked or wished were different?\n\n{agent}",
    objection: "“We want to wait.”\nThat makes sense. What would need to change for the timing to feel right? [Pause.] Let’s look at what waiting could mean for price and competition, and you can decide with the numbers in front of you.\n\n“Another agent quoted a higher price.”\nI appreciate you telling me. Can I show you the sales I used? [Walk through comps.] A price only matters if a buyer will pay it.\n\n“We’ll sell it ourselves.”\nThat’s your call, and I respect it. Would it help if I sent you the recent sales nearby and checked in after your first weekend?\n\n“Your fee is too high.”\nFees are always negotiable, and I want you to see what you get for it. [Walk through the marketing and service.] What matters most to you in the result?",
    expired: "Hi, is this the owner of {address}? This is {agent} with {firm}. I noticed your listing came off the market, and I imagine that’s frustrating. Can I ask what you think kept it from selling? [Listen.] Are you still hoping to move? [Pause.] I’d be glad to share what I’d do differently. Would 15 minutes this week work?",
    fsbo: "Hi, I’m calling about the home for sale at {address}. This is {agent} with {firm}. I respect that you’re selling on your own. Are you open to showing it to buyers who work with an agent? [Pause.] I also have recent sales nearby if that would help. Would it be okay if I checked in after your first weekend?",
    circle: "Hi, this is {agent} with {firm}. I’m calling neighbors because a home just [listed / sold] nearby at {address}. Do you know anyone who’s been wanting to live in {hood}? [Pause.] And are you thinking about a move yourself in the next year? Thanks for your time.",
    sphere: "Call: Hi {client_first}, it’s {agent}. I was thinking about you and wanted to check in. How have you been? [Listen.] Anything new with the house? [Listen.] By the way, if you hear of anyone thinking about buying or selling, I’d love to help them.\n\nText: Hi {client_first}, it’s {agent}. Just checking in. Hope all is well! Anything I can help with?",
    buyer: "Thanks for meeting. What’s pulling you toward a move? [Pause.] What does the right home look like, and where? [Pause.]\n\nLet’s talk budget and financing. Have you spoken with a lender yet? [Pause.]\n\nHere’s the process: search, tour, offer, inspection, appraisal, and closing. I’ll explain each step as we go.\n\nBefore we tour, we’ll sign a written buyer agreement. It spells out what I do for you and how I’m paid, and that amount is negotiable. Any questions about it?\n\nNext step: let’s set up your search and pick a few homes to see this week.",
    offer: "Hi [listing agent],\n\nPlease find our offer on {address}. Highlights:\n- Price: [amount]\n- Financing: [type], pre-approval attached\n- Earnest money: [amount]\n- Inspection: [days]\n- Closing: [date], with flexibility on possession\n\nHappy to answer questions or adjust timing to fit your sellers.\n\n{agent}\n{firm}",
    custom: "[Describe what you need in the notes, then write it here.]"
  };

  function facts() {
    const l = W.listing ? listingSync(W.listing) : null;
    const c = W.contact ? Store.crm.contacts[W.contact] : null;
    const cm = W.cma ? Store.crm.cmas[W.cma] : null;
    const r = cm ? cmaCalc(cm) : null;
    const sub = cm ? cm.subject || {} : null;
    const home = l || (sub ? { address: sub.address, hood: sub.hood, beds: sub.beds, baths: sub.baths, sqft: sub.sqft, year: sub.year, type: sub.type } : null);
    return {
      listing: l ? { address: l.address, neighborhood: l.hood, city: l.city, price: l.price, status: l.status, beds: l.beds, baths: l.baths, sqft: l.sqft, year_built: l.year, type: typeName(l.type), description: l.remarks, off_market: !!l.exclusive } : null,
      contact: c ? { name: c.name, role: c.role, buyer_stage: c.buyerStage, seller_stage: c.sellerStage, budget: c.budget, areas: c.area, property: c.listingAddress, notes: c.notes } : null,
      cma: r && r.value ? { subject: sub, range: [r.low, r.high], indicated_value: r.value, comps: r.rows.map(x => ({ address: x.l.address, status: x.l.status, price: x.l.price, adjusted: Math.round(x.ap) })) } : null,
      home, range: r && r.value ? `${short(r.low)} to ${short(r.high)}` : "", contactName: c ? c.name : ""
    };
  }
  function fillStarter(id) {
    const f = facts(), h = f.home || {};
    const v = { agent: IDX.BROKER.name, firm: IDX.BROKER.firm, client_first: (f.contactName || "").split(" ")[0] || "[name]", address: h.address || "[address]", hood: h.hood || h.neighborhood || "[neighborhood]",
      beds: h.beds ?? "[#]", baths: h.baths ?? "[#]", sqft: h.sqft ? Number(h.sqft).toLocaleString() : "[#]", range: f.range || "[price range]", price: h.price ? money(h.price) : "[price]", headline: h.address ? `${typeName(h.type || "Home")} in ${h.hood || "a great location"}` : "[Headline]" };
    return String(STARTERS[id] || "").replace(/\{(\w+)\}/g, (m, k) => v[k] ?? m);
  }

  const TONES = [["warm", "Warm and friendly"], ["direct", "Direct and confident"], ["luxury", "Polished, for luxury"], ["plain", "Plain and simple"]];
  const LENGTHS = [["short", "Short"], ["medium", "Medium"], ["long", "Detailed"]];
  const scripts = () => Object.entries(Store.crm.scripts || {}).filter(([, s]) => s).map(([id, s]) => ({ id, ...s })).sort((a, b) => (b.savedAt || "").localeCompare(a.savedAt || ""));
  const opt = (list, val) => list.map(([v, t]) => `<option value="${esc(v)}" ${String(v) === String(val) ? "selected" : ""}>${esc(t)}</option>`).join("");

  W.html = function () {
    const ty = typeOf(W.type), uses = ty[3];
    const groups = [...new Set(TYPES.map(x => x[2]))];
    const pool = marketingPool(), cs = contacts(), cmas = Object.entries(Store.crm.cmas || {}).filter(([, x]) => x);
    let html = `<div class="tourform"><label for="wrType">What do you need?</label><select id="wrType" data-wr="type">${groups.map(g => `<optgroup label="${esc(g)}">${TYPES.filter(x => x[2] === g).map(x => `<option value="${x[0]}" ${x[0] === W.type ? "selected" : ""}>${esc(x[1])}</option>`).join("")}</optgroup>`).join("")}</select>
      ${uses.includes("listing") ? `<label for="wrListing">Listing</label><select id="wrListing" data-wr="listing"><option value="">None</option>${pool.map(l => `<option value="${esc(l.key)}" ${l.key === W.listing ? "selected" : ""}>${esc(l.address)} · ${short(l.price)}</option>`).join("")}</select>` : ""}
      ${uses.includes("contact") ? `<label for="wrContact">Client</label><select id="wrContact" data-wr="contact"><option value="">None</option>${cs.map(c => `<option value="${esc(c.id)}" ${c.id === W.contact ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select>` : ""}
      ${uses.includes("cma") ? `<label for="wrCma">CMA</label><select id="wrCma" data-wr="cma"><option value="">None</option>${cmas.map(([id, x]) => `<option value="${esc(id)}" ${id === W.cma ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select>` : ""}
      <div class="row2"><div><label for="wrTone">Tone</label><select id="wrTone" data-wr="tone">${opt(TONES, W.tone)}</select></div><div><label for="wrLen">Length</label><select id="wrLen" data-wr="length">${opt(LENGTHS, W.length)}</select></div></div>
      <label for="wrNotes">${W.type === "objection" ? "Which objections?" : W.type === "custom" ? "What should it say?" : "Anything to include (optional)"}</label>
      <textarea id="wrNotes" data-wr="notes" rows="3" style="width:100%;padding:10px 12px;border:1px solid var(--line);border-radius:8px;background:var(--surface)" placeholder="${W.type === "description" ? "New roof 2024, south-facing yard, 1,000 character limit" : W.type === "objection" ? "They want to wait until spring" : "Details, things to avoid, a character limit"}">${esc(W.notes)}</textarea></div>
      <div class="quick" style="margin-top:10px"><button class="btn gold" data-wr-go ${W.busy ? "disabled" : ""}>${W.busy ? "Writing…" : W.out ? "Rewrite" : "Write it"}</button><button class="btn ghost" data-wr-starter>Use a starter script</button>${W.busy ? `<button class="btn ghost" data-wr-stop>Stop</button>` : ""}</div>
      ${W.msg ? `<p class="msg" role="status">${esc(W.msg)}</p>` : ""}`;
    if (W.out || W.busy) html += `<h3 class="agent-h">Draft</h3><div class="tourform"><textarea id="wrOut" rows="14" style="width:100%;padding:12px;border:1px solid var(--line);border-radius:8px;background:var(--surface);line-height:1.5" aria-label="Draft">${esc(W.out)}</textarea></div>
      <p class="addr">${W.out.length.toLocaleString()} characters. Review before using: check every fact, and keep it within Fair Housing rules.</p>
      <div class="quick"><button class="btn ghost" data-wr-copy>Copy</button><button class="btn ghost" data-wr-save>Save to my scripts</button></div>`;
    const saved = scripts();
    if (saved.length) html += `<h3 class="agent-h">My scripts</h3>` + saved.map(s => `<div class="pcard"><div class="pcard-top"><div><strong>${esc(s.title)}</strong><p>${esc(typeOf(s.type)[1])} · ${when(s.savedAt)}</p></div></div><div class="links"><button data-wr-open="${s.id}">Open</button><button data-wr-del="${s.id}">Delete</button></div></div>`).join("");
    return html;
  };

  async function write() {
    const sample = await window.claude?.use?.("sample");
    if (!sample) { W.msg = "AI writing isn’t connected yet, so here’s a starter script to edit."; W.out = fillStarter(W.type); renderAgent(); return; }
    const ty = typeOf(W.type), f = facts();
    const lens = { short: "Keep it brief.", medium: "Keep it moderately detailed.", long: "Make it thorough." };
    const tones = { warm: "warm and friendly", direct: "direct and confident", luxury: "polished and refined, for a luxury audience", plain: "plain and simple" };
    W.busy = true; W.msg = ""; W.out = ""; W.ctl = new AbortController(); renderAgent();
    const prompt = `You write for ${IDX.BROKER.name}, a real estate broker with ${IDX.BROKER.firm} in Colorado.
Task: ${ty[1]}. ${ty[4]}
Tone: ${tones[W.tone]}. ${lens[W.length]}
Agent’s notes: ${W.notes || "none"}
Facts you may use (use only these; never invent features, numbers, schools, or claims; leave a [bracketed placeholder] for anything missing):
${JSON.stringify({ listing: f.listing, client: f.contact, cma: f.cma }, null, 1)}
Rules:
- Follow U.S. Fair Housing rules: describe the property and its features, never who should live there. No references to race, color, religion, sex, disability, familial status, national origin, or other protected classes, and avoid phrases like "perfect for families," "safe neighborhood," "walking distance," or "exclusive community."
- Never say commissions or fees are standard, fixed, or set by anyone; they are negotiable.
- Don't promise results, sale prices, or timelines. Don't call a CMA an appraisal.
- No clichés like "dream home," "won’t last," or "must see." Plain text, no markdown. For spoken scripts, write natural lines and put stage directions in [brackets].`;
    try {
      const res = await sample(prompt, { cache: false, signal: W.ctl.signal, onText: ({ text }) => { W.out = text; const ta = document.getElementById("wrOut"); if (ta) ta.value = text; } });
      W.out = res.text.trim();
    } catch (e) {
      if (e && e.code === "cancelled") W.msg = "Stopped.";
      else { W.msg = e && e.code === "not_granted" ? "AI writing is turned off here, so here’s a starter script to edit." : "The AI didn’t respond, so here’s a starter script to edit."; if (!W.out) W.out = fillStarter(W.type); }
    }
    W.busy = false; W.ctl = null; renderAgent();
  }

  document.addEventListener("click", e => {
    const b = e.target.closest("[data-wr-go],[data-wr-starter],[data-wr-stop],[data-wr-copy],[data-wr-save],[data-wr-open],[data-wr-del],[data-wr-for]");
    if (!b) return; const d = b.dataset;
    const sync = () => { const ta = document.getElementById("wrOut"); if (ta) W.out = ta.value; };
    if (d.wrGo !== undefined) write();
    else if (d.wrStarter !== undefined) { W.out = fillStarter(W.type); W.msg = ""; renderAgent(); }
    else if (d.wrStop !== undefined) W.ctl?.abort();
    else if (d.wrCopy !== undefined) { sync(); (navigator.clipboard?.writeText(W.out) || Promise.reject()).then(() => toast("Copied")).catch(() => { const ta = document.getElementById("wrOut"); ta?.select(); try { document.execCommand("copy"); toast("Copied"); } catch (x) {} }); }
    else if (d.wrSave !== undefined) {
      sync(); if (!W.out.trim()) return;
      const f = facts(), title = prompt("Name this script", `${typeOf(W.type)[1]}${f.home && f.home.address ? " · " + f.home.address : f.contactName ? " · " + f.contactName : ""}`);
      if (!title) return;
      Store.crm.scripts = Store.crm.scripts || {};
      Store.saveCrm("scripts", null, { title: title.trim(), type: W.type, text: W.out, listing: W.listing, contact: W.contact, savedAt: new Date().toISOString() }); toast("Saved");
    }
    else if (d.wrOpen !== undefined) { const s = Store.crm.scripts[d.wrOpen]; if (s) { Object.assign(W, { type: s.type, out: s.text, listing: s.listing || "", contact: s.contact || "", msg: "" }); renderAgent(); window.scrollTo(0, 0); } }
    else if (d.wrDel !== undefined) { if (confirm("Delete this script?")) Store.saveCrm("scripts", d.wrDel, null); }
    else if (d.wrFor !== undefined) {
      const [type, kind, id] = d.wrFor.split("|");
      Object.assign(W, { type, listing: kind === "listing" ? id : "", contact: kind === "contact" ? id : "", cma: kind === "cma" ? id : "", out: "", msg: "" });
      if (kind === "cma") { const cm = Store.crm.cmas[id]; if (cm) { W.contact = cm.contactId || ""; W.listing = cm.subjectKey || ""; } }
      if ($("#dlgListing")?.open) $("#dlgListing").close();
      agentPanel = "writer"; if (location.hash !== "#agent") location.hash = "agent"; else renderAgent(); window.scrollTo(0, 0);
    }
  });
  document.addEventListener("change", e => {
    const k = e.target.dataset && e.target.dataset.wr; if (!k) return;
    W[k] = e.target.value;
    if (k === "type") { W.out = ""; W.msg = ""; }
    if (k !== "notes") renderAgent();
  });
  document.addEventListener("input", e => { if (e.target.id === "wrNotes") W.notes = e.target.value; });
  W._t = { facts, fillStarter, TYPES };
})();
