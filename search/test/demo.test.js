// Demo mode as the live site runs it during testing: no database, nobody signed in.
let JSDOM; try { ({ JSDOM } = require("jsdom")); } catch (e) { ({ JSDOM } = require(require("child_process").execSync("npm root -g").toString().trim() + "/jsdom")); }
const fs = require("fs"), path = require("path"), dir = path.join(__dirname, "..");
const cfg = fs.readFileSync(path.join(dir, "..", "assets", "config.js"), "utf8");
let html = fs.readFileSync(path.join(dir, "index.html"), "utf8")
  .replace('<script src="../assets/config.js?v=202611141045"></script>', () => `<script>${cfg}</script>`)
  .replace(/<script src="https:\/\/cdn\.jsdelivr\.net[^"]*"><\/script>/, "")
  .replace('<script src="miller-cloud.js?v=202611141045"></script>', () => `<script>${fs.readFileSync(path.join(dir, "miller-cloud.js"), "utf8")}</script>`)
  .replace('<script src="office.js?v=202611141045"></script>', () => `<script>${fs.readFileSync(path.join(dir, "office.js"), "utf8")}</script>`);
const errs = [];
const dom = new JSDOM(html, { runScripts: "dangerously", url: "https://site.test/search/#agent", beforeParse(w) {
  w.structuredClone = o => JSON.parse(JSON.stringify(o)); w.scrollTo = () => {}; w.confirm = () => true; w.prompt = () => "x";
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; }; w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  w.addEventListener("error", e => errs.push(e.message)); } });
const w = dom.window, T = s => w.document.querySelector(s)?.textContent.replace(/\s+/g, " ").trim() || "";
const go = p => { w.eval(`agentPanel=${JSON.stringify(p)}; renderAgent()`); return T("#v-agent"); };
let fails = 0; const check = (n, ok) => { console.log((ok ? "PASS " : "FAIL ") + n); if (!ok) fails++; };
setTimeout(() => {
  // In real browsers, the app's const globals (Store, IDX) are not properties of window.
  check("office.js never reads window.Store", !/window\.Store\b/.test(fs.readFileSync(path.join(dir, "office.js"), "utf8")));
  check("sample office data loaded", w.eval("Object.keys(Office.deals).length") === 4 && w.eval("Office.seeded") === true);
  check("config has demo mode on", w.eval("IDX.DEMO_AGENT") === true);
  check("Agent tab shows with no sign-in", !w.document.querySelector("#agentTab").classList.contains("hidden"));
  const home = go("home");
  check("home shows demo notice, setup, and Office menu", home.includes("Demo mode") && home.includes("Get started") && home.includes("Broker review"));
  check("transactions have sample deals and deadlines", go("o-deals").includes("2210 S Fillmore St") && T("#v-agent").includes("Inspection objection deadline"));
  check("broker review queue has a submitted deal", go("o-review").includes("4021 Raleigh St"));
  check("income uses the sample plan", go("o-income").includes("Gross commission") && w.eval("Office._t.incomeStats('demo-broker').rows.length") === 2);
  check("company hub, partners, brand, recruiting populated", go("o-hub").includes("Policy and Procedures Manual") && go("o-partners").includes("Mile High Title") && go("o-brand").includes("Primary logo") && go("o-recruiting").includes("Casey Morgan"));
  check("follow-ups show a birthday today", go("o-followups").includes("Marcus Lee"));
  check("likely to sell finds the 8-year owner", go("o-likely").includes("Renee Ortiz"));
  check("matching clients works on a sample listing", go("o-rp:S-1003").includes("matching"));
  check("team shows sample agents", go("agents").includes("Alex Rivera"));
  const all = ["requests","buyers","sellers","tasks","inbox","notifications","tours","biz","contacts","activity","searches","listings","exclusives","openhouses","cmas","market","insights","marketing","showcase","assistant","settings","help","o-referrals","o-setup","o-import"];
  go("home");
  const tiles = [...w.document.querySelectorAll("#v-agent .tool")].map(b => b.dataset.panel);
  check("every tool is a tile on Agent home", ["o-deals","o-review","o-income","o-referrals","o-followups","o-hub","o-partners","o-brand","o-recruiting","o-rp","o-likely","o-import","o-setup","listings","cmas","openhouses","marketing","assistant","settings"].every(p => tiles.includes(p)));
  const f = w.document.querySelector("#toolFind"); f.value = "income"; f.dispatchEvent(new w.Event("input", { bubbles: true }));
  const shown = [...w.document.querySelectorAll("#v-agent .tool")].filter(b => !b.hidden).map(b => b.dataset.panel);
  check("Find a tool filters the tiles", shown.length === 1 && shown[0] === "o-income");
  f.value = ""; f.dispatchEvent(new w.Event("input", { bubbles: true }));
  check("every panel renders", all.every(p => go(p).length > 30));
  w.document.querySelector("#agentTab") && w.eval('Store.saveCrm("contacts", null, { name:"Test Person" })');
  check("demo changes aren't sent anywhere", w.eval("Store.db") == null);
  check("no page errors", errs.length === 0); if (errs.length) console.log(errs);
  console.log(fails ? `${fails} failed` : "All demo tests passed"); process.exit(fails ? 1 : 0);
}, 500);
