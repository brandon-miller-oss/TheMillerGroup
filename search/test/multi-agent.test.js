// End-to-end test of the multi-agent app against an in-memory Supabase that applies
// the same rules as supabase/agent-tools.sql. Run: npm i jsdom && node search/test/multi-agent.test.js
let JSDOM; try { ({ JSDOM } = require("jsdom")); } catch (e) { ({ JSDOM } = require(require("child_process").execSync("npm root -g").toString().trim() + "/jsdom")); }
const fs = require("fs"), path = require("path");
const dir = path.join(__dirname, "..");
let html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
const cloud = fs.readFileSync(path.join(dir, "miller-cloud.js"), "utf8");
html = html.replace('<script src="../assets/config.js"></script>', '<script>window.MG_CONFIG={SITE_URL:"https://site.test",SUPABASE_URL:"x",SUPABASE_ANON_KEY:"y",DEFAULT_AGENT_SLUG:"brandon"};</script>')
  .replace(/<script src="https:\/\/cdn\.jsdelivr\.net[^"]*"><\/script>/, "").replace('<script src="miller-cloud.js"></script>', `<script>${cloud}</script>`);

const rows = new Map(), chans = [], siteLeads = [];
const admins = new Set(["broker"]), agents = new Set(["sara"]), emails = { "newagent@x.com": "newbie" };
function fake(uid) {
  const isAdmin = () => !!uid && admins.has(uid), isAgent = () => !!uid && (agents.has(uid) || isAdmin());
  const top = p => p.split("/")[0], owner = p => p.split("/")[1];
  const clientAgent = c => { const r = rows.get("boards/" + c); return r && r.data.agentId; };
  const canRead = p => ["exclusives", "openhouses", "showcase", "team"].includes(top(p)) || isAdmin()
    || (uid && ["boards", "leads", "threads"].includes(top(p)) && (owner(p) === uid || (isAgent() && clientAgent(owner(p)) === uid)))
    || (top(p) === "agent" && isAgent() && owner(p) === uid);
  const canWrite = (p, d) => !!uid && (isAdmin()
    || (["boards", "leads", "threads"].includes(top(p)) && (owner(p) === uid || (isAgent() && clientAgent(owner(p)) === uid)))
    || (["agent", "team"].includes(top(p)) && isAgent() && owner(p) === uid)
    || (["exclusives", "openhouses", "showcase"].includes(top(p)) && isAgent() && d && d.agentId === uid));
  const notify = r => chans.forEach(c => { const [col, v] = c.filter.split("=eq."); if ((col === "parent" && r.parent === v) || (col === "path" && r.path === v)) setTimeout(c.cb, 0); });
  function q(table) {
    const st = { ops: [] }; const b = {
      select() { st.op = "select"; return b; }, eq(c, v) { st.ops.push([c, v]); return b; }, maybeSingle() { st.single = true; return b; },
      insert(r) { if (table === "leads") siteLeads.push(r); return Promise.resolve({ error: null }); },
      upsert(r) { const old = rows.get(r.path); if ((old && !canWrite(r.path, old.data)) || !canWrite(r.path, r.data)) return Promise.resolve({ error: { message: "rls " + r.path } }); rows.set(r.path, JSON.parse(JSON.stringify(r))); notify(r); return Promise.resolve({ error: null }); },
      update(patch) { st.op = "update"; st.patch = patch; return b; }, delete() { st.op = "delete"; return b; },
      then(res, rej) {
        let list = [...rows.values()].filter(r => st.ops.every(([c, v]) => r[c] === v));
        if (st.op === "select") { list = list.filter(r => canRead(r.path)); const data = list.map(r => ({ path: r.path, data: JSON.parse(JSON.stringify(r.data)) })); return Promise.resolve({ data: st.single ? (data[0] || null) : data, error: null }).then(res, rej); }
        if (list.some(r => !canWrite(r.path, r.data) || (st.patch && !canWrite(r.path, st.patch.data)))) return Promise.resolve({ error: { message: "rls" } }).then(res, rej);
        list.forEach(r => { if (st.op === "update") { Object.assign(r, JSON.parse(JSON.stringify(st.patch))); notify(r); } else { rows.delete(r.path); notify(r); } });
        return Promise.resolve({ error: null }).then(res, rej);
      } }; return b;
  }
  return { auth: { getSession: async () => ({ data: { session: uid ? { user: { id: uid, email: uid + "@x.com" }, access_token: "t" } : null } }), onAuthStateChange() {}, signOut: async () => {}, signInWithOtp: async () => ({ error: null }) },
    from: t => q(t),
    rpc: async (fn, a) => {
      if (fn === "is_agent") return { data: isAgent() }; if (fn === "is_admin") return { data: isAdmin() };
      if (fn === "add_agent") { if (!isAdmin()) return { error: { message: "denied" } }; const id = emails[a.agent_email]; if (id) agents.add(id); return { data: !!id }; }
      return { data: null };
    },
    channel() { const c = { filter: "", cb: null, on(_, o, cb) { c.filter = o.filter; c.cb = cb; return c; }, subscribe() { chans.push(c); return c; } }; return c; },
    removeChannel(c) { const i = chans.indexOf(c); if (i >= 0) chans.splice(i, 1); } };
}
const open = (uid, url, store = {}) => { const errs = []; const dom = new JSDOM(html, { runScripts: "dangerously", url: "https://site.test/search/" + url, beforeParse(w) {
  w.supabase = { createClient: () => fake(uid) }; w.structuredClone = o => JSON.parse(JSON.stringify(o)); w.scrollTo = () => {}; w.confirm = () => true; w.prompt = (a, b) => b || "x";
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; }; w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  Object.entries(store).forEach(([k, v]) => w.sessionStorage.setItem(k, v));
  w.addEventListener("error", e => errs.push(e.message)); } }); dom.errs = errs; return dom; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const T = (d, s) => d.window.document.querySelector(s)?.textContent.replace(/\s+/g, " ").trim();
const submit = (d, s) => d.window.document.querySelector(s).dispatchEvent(new d.window.Event("submit", { cancelable: true }));
let fails = 0; const check = (name, ok) => { console.log((ok ? "PASS " : "FAIL ") + name); if (!ok) fails++; };

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
  console.log(fails ? `${fails} failed` : "All multi-agent tests passed"); process.exit(fails ? 1 : 0);
})();
