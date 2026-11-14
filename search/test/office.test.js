// End-to-end tests for the Office module. Run: npm i jsdom && node search/test/office.test.js
const { open, wait, T, submit, check, rows, agents } = require("./harness");
const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString("en-CA"); };
const yearsAgo = (y, n = 0) => { const d = new Date(); d.setFullYear(d.getFullYear() - y); d.setDate(d.getDate() + n); return d.toLocaleDateString("en-CA"); };
async function profile(dom, name, slug) {
  dom.window.eval('agentPanel="settings"; renderAgent()'); const d = dom.window.document;
  d.querySelector("#pName").value = name; d.querySelector("#pSlug").value = slug; submit(dom, "#profileForm"); await wait(80);
}
const go = (dom, p) => { dom.window.eval(`agentPanel=${JSON.stringify(p)}; renderAgent()`); return T(dom, "#v-agent"); };
const E = (dom, js) => dom.window.eval(js);

(async () => {
  agents.add("tom");
  const B = open("broker", "#agent"); await wait(300); await profile(B, "Brandon Miller", "brandon");
  const S = open("sara", "#agent"); await wait(300); await profile(S, "Sara Clark", "sara");
  const Tm = open("tom", "#agent"); await wait(300);

  // 2. Company hub, plan, connections (broker edits, agents read)
  E(B, `Office._t.saveCompany("hub", null, { type:"policy", title:"Policy and Procedures Manual", url:"https://drive.example/ppm", mustRead:true, createdAt:new Date().toISOString() })`);
  E(B, `Office._t.saveCompanyDoc("plan", { name:"Flat fee plan", flatFee:500, eoFee:50 })`);
  E(B, `Office._t.saveCompanyDoc("settings", { esignName:"Association eSign", esignUrl:"https://esign.example" })`);
  await wait(150);
  check("agent sees company hub item", go(S, "o-hub").includes("Policy and Procedures Manual"));
  check("agent sees commission plan", T(S, "#v-agent").includes("$500 per transaction"));
  const denied = await E(S, `window.claude.use("db").then(db=>db.doc("company/plan").set({flatFee:0})).then(()=>"ok",()=>"denied")`);
  check("agent can't change the commission plan", denied === "denied");
  const V = open(null, "#search"); await wait(250);
  const vis = await E(V, `window.claude.use("db").then(db=>db.collection("company/hub/items").get()).then(s=>s.docs.length)`);
  const cli = await E(open("cX", "#search"), `new Promise(r=>setTimeout(r,250)).then(()=>window.claude.use("db")).then(db=>db.doc("company/plan").get()).then(s=>s.exists)`);
  check("visitors and clients can't read company content", vis === 0 && cli === false);

  // 1. Transactions + broker review
  const dealId = E(S, `Office._t.saveDeal(null, { address:"77 Elm St", side:"buyer", status:"pending", price:600000, commissionPct:2.5, closeDate:"${day(20)}", contractDate:"${day(-5)}",
    deadlines:[{label:"Inspection objection deadline", date:"${day(2)}", done:false},{label:"Closing date", date:"${day(20)}", done:false}], docs:[{label:"Executed contract to buy and sell", done:true, url:""},{label:"Earnest money receipt", done:false, url:""}], review:{state:"none"} })`);
  await wait(120);
  check("transaction shows with upcoming deadline", go(S, "o-deals").includes("Inspection objection deadline"));
  check("deadline shows on agent home", go(S, "home").includes("77 Elm St"));
  check("eSign link shows on transaction", go(S, "o-deal:" + dealId).includes("Open Association eSign"));
  S.window.document.querySelector(`[data-o-submit="${dealId}"]`).click(); await wait(150);
  check("other agent can't see Sara's transaction", Object.keys(E(Tm, "Office.deals")).length === 0);
  const B2 = open("broker", "#agent"); await wait(400);
  check("broker sees it in the review queue", go(B2, "o-review").includes("77 Elm St"));
  B2.window.document.querySelector(`[data-panel="o-deal:${dealId}"]`).click();
  B2.window.document.querySelector(`[data-o-approve="${dealId}"]`).click(); await wait(150);
  check("broker approval reaches the agent", E(S, `Office.deals["${dealId}"].review.state`) === "approved");
  const hijack = await E(Tm, `window.claude.use("db").then(db=>db.doc("deals/${dealId}").set({agentId:"tom"})).then(()=>"ok",()=>"denied")`);
  check("other agent can't overwrite Sara's transaction", hijack === "denied");

  // 3. Income (closed deal this year under the plan)
  E(S, `Office._t.saveDeal(null, { address:"12 Oak Ave", side:"seller", status:"closed", price:800000, commissionPct:2.5, closeDate:"${new Date().getFullYear()}-01-15", referralPct:25, review:{state:"approved"} })`);
  E(S, `Store.saveCrm("expenses", null, { amount:300, date:"${day(0)}", category:"Marketing" })`); await wait(100);
  const inc = E(S, `Office._t.incomeStats(Store.crmOwner)`);
  check("income: gross, fees, referral, net", inc.gross === 20000 && inc.fee === 550 && inc.ref === 5000 && inc.net === 14450 && inc.after === 14150);
  check("broker sees brokerage fee totals", go(open("broker", "#agent"), "o-income") !== null);

  // 4. Referrals
  E(S, `Store.saveCrm("referrals", null, { direction:"out", client:"Pat", agent:"Lee", brokerage:"AZ Realty", feePct:25, expectedFee:3000, status:"sent" })`); await wait(60);
  check("referral shows money owed to agent", go(S, "o-referrals").includes("$3K"));

  // 5. Follow-ups: birthday today, home anniversary today, do-not-contact skipped
  const cid = E(S, `Store.saveCrm("contacts", null, { name:"Ana Ruiz", email:"ana@x.com", role:"buyer", birthday:"1990-${day(0).slice(5)}" })`);
  const cid2 = E(S, `Store.saveCrm("contacts", null, { name:"Bo Lee", email:"bo@x.com", role:"buyer" })`);
  E(S, `Store.saveCrm("contacts", null, { name:"No Mail", email:"no@x.com", role:"buyer", doNotContact:true, birthday:"1980-${day(0).slice(5)}" })`);
  E(S, `Office._t.saveDeal(null, { address:"5 Pine", side:"buyer", status:"closed", price:500000, closeDate:"${yearsAgo(3)}", contactId:"${cid2}" })`); await wait(80);
  const due = E(S, `Office._t.followupsDue(0).map(x=>x.kind+":"+x.c.name).sort().join()`);
  check("follow-ups due: birthday and 3-year anniversary, skips do-not-contact", due === "anniversary:Bo Lee,birthday:Ana Ruiz");
  check("anniversary email fills in years and address", E(S, `(()=>{const x=Office._t.followupsDue(0).find(x=>x.kind==="anniversary");return Office._t.fill(Office._t.tmpl("anniversary").body,{first_name:"Bo",agent_name:"Sara",...x.vars});})()`).includes("3 years since you got the keys to 5 Pine"));

  // 6. Partners, 7. Brand, 8. Recruiting
  E(B, `Office._t.saveCompany("partners", null, { category:"Lender", name:"Kim Loans", company:"Front Range Mortgage", affiliated:true })`);
  E(B, `Office._t.saveCompany("brand", null, { kind:"logo", title:"Primary logo", url:"https://drive.example/logo" })`); await wait(120);
  check("agent sees partner with affiliated-business notice", go(S, "o-partners").includes("Affiliated business"));
  check("brand library shows colors and logo", go(S, "o-brand").includes("Estate Gold") && T(S, "#v-agent").includes("Primary logo"));
  check("recruiting is broker only", go(S, "o-recruiting").includes("Broker only"));
  E(B, `Store.saveCrm("recruits", null, { name:"Jamie Fox", brokerage:"Big Box Realty", stage:"talking", referredBy:"Sara Clark" })`); await wait(60);
  check("broker sees recruiting pipeline", go(B, "o-recruiting").includes("Referred by Sara Clark"));
  check("Office menu: broker sees review and recruiting, agent doesn't", go(B, "home").includes("Broker review") && !go(S, "home").includes("Recruiting"));

  // P1. Setup checklist
  const steps = E(S, `Office._t.setupSteps().filter(s=>s.done).map(s=>s.label)`);
  check("setup checklist tracks progress", steps.includes("Add your first transaction") && !steps.includes("Read the company policies"));
  S.window.eval('agentPanel="o-hub"; renderAgent()'); S.window.document.querySelector("[data-o-read]").click(); await wait(80);
  check("marking the policy read completes that step", E(S, `Office._t.setupSteps().find(s=>s.label==="Read the company policies").done`) === true);

  // P2. Contact import
  const csv = 'First Name,Last Name,E-mail,Mobile,Type,Birthday,Tags\n"Lee","Park",lee@x.com,555-1000,Seller,3/14/1985,"Past clients, Sphere"\nAna,Ruiz,ana@x.com,,Buyer,,\n';
  const mapped = E(S, `Office._t.mapRows(Office._t.parseCSV(${JSON.stringify(csv)}))`);
  check("CSV columns are matched", mapped.list[0].name === "Lee Park" && mapped.list[0].role === "seller" && mapped.list[0].birthday === "1985-03-14" && mapped.list[0].folders.join() === "Past clients,Sphere");
  E(S, `Office.importRows = Office._t.mapRows(Office._t.parseCSV(${JSON.stringify(csv)}))`);
  go(S, "o-import"); S.window.document.querySelector("[data-o-doimport]").click(); await wait(80);
  check("import adds new contacts and skips existing emails", E(S, `contacts().filter(c=>c.email==="ana@x.com").length`) === 1 && E(S, `contacts().some(c=>c.name==="Lee Park")`));

  // P5. Folders
  E(S, `Office.contactFolder = "Sphere"`);
  check("folder filter narrows contacts", (() => { const t = go(S, "contacts"); return t.includes("Lee Park") && !t.includes("Bo Lee"); })());
  E(S, `Office.contactFolder = ""`);

  // P4. Likely to sell
  E(S, `Store.saveCrm("contacts", null, { name:"Old Owner", email:"old@x.com", role:"buyer", purchaseDate:"${yearsAgo(7)}", notes:"thinking about retiring" })`); await wait(60);
  check("likely to sell ranks a 7-year owner with a life change", E(S, `Office._t.likelyToSell()[0].c.name`) === "Old Owner");

  // P3. Matching clients: Sara's client saved a search that fits S-1003
  const C1 = open("c1", "?agent=sara#search"); await wait(300);
  E(C1, `Store.saveSearch(null, { name:"Wash Park", filters:{ text:"Washington", maxPrice:"1600000", minBeds:"3" }, seenKeys:[] })`); await wait(150);
  const S2 = open("sara", "#agent"); await wait(400);
  const m = E(S2, `Office._t.matchingClients(listingSync("S-1003")).map(x=>x.cid+":"+x.why[0])`);
  check("matching clients finds the saved search", m.some(x => x.startsWith("c1:Saved search")));
  go(S2, "o-rp:S-1003"); S2.window.confirm = () => true; S2.window.document.querySelector("[data-o-rpsend]").click(); await wait(200);
  check("bulk message reaches the client with the home attached", E(C1, `(Store.msgs[Store.uid]||[]).some(x=>x.listingKey==="S-1003")`));

  // Every Office panel renders
  const panels = ["o-deals", "o-review", "o-hub", "o-income", "o-referrals", "o-followups", "o-partners", "o-brand", "o-recruiting", "o-setup", "o-import", "o-rp", "o-likely", "o-clauses"];
  check("every Office panel renders for the broker", panels.every(p => go(B, p).length > 40));
  const cl = go(B, "o-clauses");
  check("contract clause library: escalation clause with a cap and broker-review note", cl.includes("CAP PRICE") && cl.includes("Employing Broker") && E(B, "Office._t.CLAUSES.length") === 9);
  check("required documents follow the side (training guide)", E(B, `Office._t.docsFor("seller")[0]`) === "Exclusive Right-to-Sell Listing Contract" && E(B, `Office._t.docsFor("buyer")[0]`) === "Exclusive Right-to-Buy Contract" && E(B, `Office._t.docsFor("both").length`) > E(B, `Office._t.docsFor("seller").length`));
  check("deadline timing hints from the training guide", E(B, `Office._t.DEADLINE_HINT["Appraisal deadline"]`).startsWith("18–21"));
  const errs = [B, S, Tm, B2, C1, S2].flatMap(d => d.errs);
  check("no page errors", errs.length === 0); if (errs.length) console.log(errs);
  const fails = require("./harness").done();
  console.log(fails ? `${fails} failed` : "All office tests passed"); process.exit(fails ? 1 : 0);
})();
