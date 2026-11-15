/* =========================================================================
   The Miller Group: the client's transaction guide (shared by the app and
   the server; server/lib/deal-guide.js is a copy).
   - EXPLAIN: plain-English notes on Colorado contract dates
   - shareable(deal, agent, docs): the client-safe copy of a transaction
     (no commission, broker review, internal notes, or document links)
   - prompt(shared, question, history, today): the guide's instructions
   Informational only. The signed contract controls.
   ========================================================================= */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.DealGuide = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const EXPLAIN = {
    "Earnest money due": "Your earnest money deposit has to reach the title company (or whoever the contract names) by this date. It’s held in trust and normally goes toward your purchase at closing.",
    "Record title deadline": "The seller has to get you the title commitment by this date, along with copies of recorded documents such as covenants and easements. It shows who owns the property and what’s recorded against it, and starts your window to review it.",
    "Off-record title deadline": "The seller gives you information about things that affect the property but aren’t in public records, such as leases, surveys, and known boundary issues.",
    "Seller’s property disclosure deadline": "The seller gives you their written disclosure of what they know about the home’s condition. Read it closely before your inspection.",
    "Inspection objection deadline": "The last day to tell the seller, in writing, about inspection items you want addressed, or to end the contract under the inspection section. Inspections need to be finished before this date.",
    "Inspection resolution deadline": "If an inspection objection was sent, this is when the buyer and seller need a written agreement on how the items will be handled. The contract spells out what happens if there’s no agreement by then.",
    "Loan application deadline": "Apply for your loan by this date and send the lender what they ask for. Quick answers to your lender keep everything else on track.",
    "Loan terms deadline": "The deadline to object if the loan terms you’ve been offered (rate, payment, closing costs) aren’t acceptable.",
    "Appraisal deadline": "The appraisal needs to come in by this date. If it comes in below the price, this is generally the deadline to object under the appraisal section.",
    "Loan conditions deadline": "By this date your lender should be satisfied with what it needs to fund the loan. It’s the contract’s last checkpoint for loan approval.",
    "Closing date": "You sign the final documents, the money moves, and ownership transfers. Wire fraud is common: always call your title company at a number you already know to confirm wiring instructions, and never trust instructions that arrive by email alone.",
    "Possession date": "When the buyer gets the keys. Usually at closing, unless the contract gives the seller extra time after closing."
  };
  const SELLER = {
    "Earnest money due": "The buyer’s earnest money deposit has to reach the title company (or whoever the contract names) by this date.",
    "Record title deadline": "The title commitment and recorded documents go to the buyer by this date so they can review them.",
    "Seller’s property disclosure deadline": "Your completed Seller’s Property Disclosure goes to the buyer by this date. Disclose what you know; when in doubt, disclose.",
    "Inspection objection deadline": "The buyer’s last day to send a written inspection objection or end the contract under the inspection section. Expect the inspector at the home before this date.",
    "Inspection resolution deadline": "If the buyer objected, you and the buyer need a written agreement on how the items will be handled by this date.",
    "Appraisal deadline": "The buyer’s appraisal needs to come in by this date. A low appraisal can mean a renegotiation.",
    "Possession date": "When the buyer gets the keys. Have the home cleaned out and leave keys, garage openers, and manuals."
  };
  const DISCLAIMER = "A plain-language summary to help you follow along. Your signed contract controls, and dates can change by written amendment. For legal or tax advice, talk to a Colorado real estate attorney or tax professional.";
  const explain = (label, side) => (side === "seller" && SELLER[label]) || EXPLAIN[label] || "";
  const clip = (s, n) => String(s == null ? "" : s).slice(0, n);

  function shareable(deal, agent = {}, docs = []) {
    return {
      address: clip(deal.address, 200), side: deal.side === "seller" ? "seller" : "buyer", status: clip(deal.status, 20),
      price: Number(deal.price) || 0, closeDate: clip(deal.closeDate, 10),
      deadlines: (deal.deadlines || []).filter(x => x && x.date).map(x => ({ label: clip(x.label, 80), date: clip(x.date, 10), done: !!x.done })).sort((a, b) => a.date.localeCompare(b.date)),
      agent: { name: clip(agent.name, 80), phone: clip(agent.phone, 30), email: clip(agent.email, 120), firm: clip(agent.firm || "The Miller Group", 80) },
      docs: (docs || []).filter(x => x && x.summary).slice(0, 12).map(x => ({ id: clip(x.id, 40), title: clip(x.title, 120), summary: clip(x.summary, 4000), text: clip(x.text, 15000), at: clip(x.at, 30) })),
      sharedAt: new Date().toISOString()
    };
  }

  function prompt(s, question, history = [], today = new Date().toISOString().slice(0, 10)) {
    const role = s.side === "seller" ? "selling" : "buying";
    const dates = (s.deadlines || []).map(x => `- ${x.label}: ${x.date}${x.done ? " (done)" : ""}${explain(x.label, s.side) ? ` — ${explain(x.label, s.side)}` : ""}`).join("\n") || "- No dates entered yet";
    const docs = (s.docs || []).map(d => `### ${d.title}\nSummary reviewed by the agent:\n${d.summary}${d.text ? `\n\nDocument text (may be partial):\n${d.text}` : ""}`).join("\n\n") || "None shared yet.";
    const past = (history || []).slice(-6).map(h => `Client: ${h.q}\nGuide: ${h.a}${h.note ? `\nAgent added: ${h.note}` : ""}`).join("\n\n");
    return `You are the transaction guide inside The Miller Group’s client app in Colorado. You help a client who is ${role} ${s.address} understand where things stand. Their agent is ${s.agent.name || "their agent"} of ${s.agent.firm}${s.agent.phone ? `, ${s.agent.phone}` : ""}.

Today is ${today}.

Contract dates (entered by the agent from the signed contract):
${dates}

Documents the agent shared:
${docs}
${past ? `\nEarlier questions:\n${past}\n` : ""}
Rules:
- Answer only from the dates and documents above plus general, widely known information about how Colorado residential transactions work. Never invent a date, dollar amount, or document detail. If it isn’t above, say you don’t see it and suggest asking ${s.agent.name || "their agent"}.
- Explain; don’t advise. Don’t tell them whether to object, terminate, negotiate, waive anything, or sign anything, and don’t give legal, tax, or lending advice. For those, say it’s a decision to talk through with ${s.agent.name || "their agent"} (and an attorney or lender when that fits).
- The signed contract controls. If they ask what happens when a deadline is missed, explain generally and point them to their agent.
- If they ask about wiring money, remind them to call the title company at a known number before sending anything.
- Plain, warm, short: under 160 words, no headings, no markdown. Answer in the language they wrote in.
- Set "forAgent" to true when the question needs the agent’s judgment, a decision, a document you don’t have, or seems urgent.

Client’s question: ${clip(question, 1500)}

Reply with only JSON: {"answer": "...", "forAgent": true|false}`;
  }

  // Offline answer used in the demo: the matching date's explanation.
  function localAnswer(s, q) {
    const t = String(q || "").toLowerCase();
    const hit = (s.deadlines || []).find(x => t.includes(x.label.toLowerCase().replace(/ (deadline|date|due)$/, "").replace(/’/g, "'").split(" ")[0]));
    if (hit) return { answer: `${hit.label} is ${hit.date}. ${explain(hit.label, s.side)}`, forAgent: false };
    return { answer: `I don’t see that in what ${s.agent.name || "your agent"} has shared yet, so I’ve flagged it for them.`, forAgent: true };
  }
  return { EXPLAIN, SELLER, DISCLAIMER, explain, shareable, prompt, localAnswer };
});
