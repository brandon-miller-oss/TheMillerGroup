// End-to-end permission tests. Run: npm i jsdom && node search/test/multi-agent.test.js
const { open, wait, T, submit, check, rows, agents, siteLeads } = require("./harness");
let fails = 0;
async function saveProfile(dom, name, slug) {
  dom.window.eval('agentPanel="settings"; renderAgent()'); const d = dom.window.document;
  d.querySelector("#pName").value = name; d.querySelector("#pSlug").value = slug; submit(dom, "#profileForm"); await wait(80);
}
(async () => {
  const B = open("broker", "#agent"); await wait(300); await saveProfile(B, "Brandon Miller", "brandon");
  const S = open("sara", "#agent"); await wait(300); await saveProfile(S, "Sara Clark", "sara");
  check("agent sees Agent tab", !S.window.document.querySelector("#agentTab").classList.contains("hidden"));
  check("agent is not broker", S.window.eval("Store.isBroker") === false && B.window.eval("Store.isBroker") === true);

  // Client 1 arrives on Sara's link; client 2 has no link
  const C1 = open("c1", "?agent=sara#search"); await wait(300); const c1 = C1.window.document;
  c1.querySelector('[data-save="S-1003"]').click(); c1.querySelector("#newColName").value = "Faves"; submit(C1, "#newColForm"); await wait(80);
  c1.querySelector('[data-open="S-1003"]').click(); await wait(40);
  check("client sees their agent on listings", T(C1, "#listingBody").includes("Sara Clark"));
  c1.querySelector("#lName").value = "Casey"; c1.querySelector("#lEmail").value = "casey@x.com"; submit(C1, "#leadForm"); await wait(120);
  C1.window.eval('Store.sendMessage(Store.uid,"client","Hi Sara")'); await wait(120);
  check("client 1 assigned to Sara", rows.get("boards/c1").data.agentId === "sara");
  check("showing request also lands in website Leads", siteLeads.length === 1 && siteLeads[0].extra.agentId === "sara");
  const C2 = open("c2", "#search"); await wait(300);
  C2.window.eval('Store.create("Mine")'); await wait(100);
  check("agents are never registered as clients", !rows.has("boards/sara") && !rows.has("boards/broker"));
  check("client 2 defaults to broker", rows.get("boards/c2").data.agentId === "broker");
  check("client 2 can't read client 1", Object.keys(C2.window.eval("Store.leads")).length === 0 && C2.window.eval("Store.isAgent") === false);

  // Fresh agent sessions see the right books
  const S2 = open("sara", "#agent"); await wait(400);
  check("Sara sees only her client", JSON.stringify(Object.keys(S2.window.eval("Store.clients"))) === '["c1"]');
  S2.window.eval('agentPanel="inbox"; renderAgent()'); check("Sara's inbox has Casey's message", T(S2, "#v-agent").includes("Hi Sara"));
  S2.window.eval('Store.sendMessage("c1","agent","Saturday works")'); await wait(120);
  check("client receives Sara's reply", C1.window.eval('(Store.msgs[Store.uid]||[]).map(m=>m.text).join("|")').includes("Saturday works"));
  S2.window.eval('Store.saveCrm("contacts",null,{name:"Sara private contact",role:"buyer"})'); await wait(80);
  S2.window.eval('agentPanel="exclusives"; renderAgent()'); S2.window.document.querySelector("[data-newex]").click();
  const sd = S2.window.document; sd.querySelector("#xAddr").value = "9 Hidden Way"; sd.querySelector("#xPrice").value = "$1M"; sd.querySelector("#xPub").checked = true; submit(S2, "#exForm"); await wait(120);

  const B2 = open("broker", "#agent"); await wait(400);
  check("broker sees both clients", Object.keys(B2.window.eval("Store.clients")).sort().join() === "c1,c2");
  check("broker's own CRM doesn't mix in Sara's contacts", !JSON.stringify(B2.window.eval("Store.crm.contacts")).includes("Sara private"));
  check("broker sees Sara's off-market listing", JSON.stringify(B2.window.eval("exclusiveRecords()")).includes("9 Hidden Way"));
  const BV = open("broker", "#agent", { "tmg-view-as": "sara" }); await wait(400);
  check("broker 'view as Sara' shows her CRM", JSON.stringify(BV.window.eval("Store.crm.contacts")).includes("Sara private"));

  // Another agent can't touch Sara's listing; visitors see it
  agents.add("tom"); const Tm = open("tom", "#agent"); await wait(300);
  const err = await Tm.window.eval('window.claude.use("db").then(db=>db.doc("exclusives/"+Object.keys(Store.publicEx)[0]).set({agentId:"tom",UnparsedAddress:"hijack"})).then(()=>"ok",e=>"denied")');
  check("other agent can't overwrite Sara's listing", err === "denied");
  check("other agent can't read Sara's client", Object.keys(Tm.window.eval("Store.clients")).length === 0);
  const V = open(null, "#search"); await wait(300);
  check("signed-out visitor sees published listing", T(V, "#v-search").includes("9 Hidden Way"));
  check("Team page lists both agents", (() => { V.window.eval('rosterQuery=""'); const t = V.window.eval("rosterList().map(a=>a.name).join()"); return t.includes("Sara Clark") && t.includes("Brandon Miller"); })());

  // Broker adds an agent by email
  const r = await B2.window.eval('MillerCloud.rpc("add_agent",{agent_email:"newagent@x.com"})');
  check("broker can add an agent by email", r === true && agents.has("newbie"));
  const deny = await S2.window.eval('MillerCloud.rpc("add_agent",{agent_email:"newagent@x.com"}).then(()=>"ok",()=>"denied")');
  check("agent can't add agents", deny === "denied");

  const errs = [B, S, C1, C2, S2, B2, BV, Tm, V].flatMap(d => d.errs);
  check("no page errors", errs.length === 0); if (errs.length) console.log(errs);
  fails = require("./harness").done(); console.log(fails ? `${fails} failed` : "All multi-agent tests passed"); process.exit(fails ? 1 : 0);
})();
