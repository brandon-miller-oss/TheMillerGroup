// End-to-end test of the multi-agent app against an in-memory Supabase that applies
// the same rules as supabase/agent-tools.sql. Run: npm i jsdom && node search/test/multi-agent.test.js
let JSDOM; try { ({ JSDOM } = require("jsdom")); } catch (e) { ({ JSDOM } = require(require("child_process").execSync("npm root -g").toString().trim() + "/jsdom")); }
const fs = require("fs"), path = require("path");
const dir = path.join(__dirname, "..");
let html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
const cloud = fs.readFileSync(path.join(dir, "miller-cloud.js"), "utf8");
const office = fs.readFileSync(path.join(dir, "office.js"), "utf8");
html = html.replace('<script src="../assets/config.js"></script>', '<script>window.MG_CONFIG={SITE_URL:"https://site.test",SUPABASE_URL:"x",SUPABASE_ANON_KEY:"y",DEFAULT_AGENT_SLUG:"brandon"};</script>')
  .replace(/<script src="https:\/\/cdn\.jsdelivr\.net[^"]*"><\/script>/, "").replace('<script src="miller-cloud.js"></script>', `<script>${cloud}</script>`).replace('<script src="office.js"></script>', () => `<script>${office}</script>`);

const rows = new Map(), chans = [], siteLeads = [];
const admins = new Set(["broker"]), agents = new Set(["sara"]), emails = { "newagent@x.com": "newbie" };
function fake(uid) {
  const isAdmin = () => !!uid && admins.has(uid), isAgent = () => !!uid && (agents.has(uid) || isAdmin());
  const top = p => p.split("/")[0], owner = p => p.split("/")[1];
  const clientAgent = c => { const r = rows.get("boards/" + c); return r && r.data.agentId; };
  const canRead = (p, d) => ["exclusives", "openhouses", "showcase", "team"].includes(top(p)) || isAdmin()
    || (top(p) === "company" && isAgent()) || (top(p) === "deals" && isAgent() && d && d.agentId === uid)
    || (uid && ["boards", "leads", "threads"].includes(top(p)) && (owner(p) === uid || (isAgent() && clientAgent(owner(p)) === uid)))
    || (top(p) === "agent" && isAgent() && owner(p) === uid);
  const canWrite = (p, d) => !!uid && (isAdmin()
    || (["boards", "leads", "threads"].includes(top(p)) && (owner(p) === uid || (isAgent() && clientAgent(owner(p)) === uid)))
    || (["agent", "team"].includes(top(p)) && isAgent() && owner(p) === uid)
    || (["exclusives", "openhouses", "showcase", "deals"].includes(top(p)) && isAgent() && d && d.agentId === uid));
  const notify = r => chans.forEach(c => { const [col, v] = c.filter.split("=eq."); if ((col === "parent" && r.parent === v) || (col === "path" && r.path === v)) setTimeout(c.cb, 0); });
  function q(table) {
    const st = { ops: [] }; const b = {
      select() { st.op = "select"; return b; }, eq(c, v) { st.ops.push([c, v]); return b; }, maybeSingle() { st.single = true; return b; },
      insert(r) { if (table === "leads") siteLeads.push(r); return Promise.resolve({ error: null }); },
      upsert(r) { const old = rows.get(r.path); if ((old && !canWrite(r.path, old.data)) || !canWrite(r.path, r.data)) return Promise.resolve({ error: { message: "rls " + r.path } }); rows.set(r.path, JSON.parse(JSON.stringify(r))); notify(r); return Promise.resolve({ error: null }); },
      update(patch) { st.op = "update"; st.patch = patch; return b; }, delete() { st.op = "delete"; return b; },
      then(res, rej) {
        let list = [...rows.values()].filter(r => st.ops.every(([c, v]) => r[c] === v));
        if (st.op === "select") { list = list.filter(r => canRead(r.path, r.data)); const data = list.map(r => ({ path: r.path, data: JSON.parse(JSON.stringify(r.data)) })); return Promise.resolve({ data: st.single ? (data[0] || null) : data, error: null }).then(res, rej); }
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


module.exports = { open, wait, T, submit, check, rows, agents, admins, siteLeads, done: () => fails };
