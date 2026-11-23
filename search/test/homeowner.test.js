// Homeowner portal: care calendar, tax dates, equity, client view, agent panel.
let JSDOM; try { ({ JSDOM } = require("jsdom")); } catch (e) { ({ JSDOM } = require(require("child_process").execSync("npm root -g").toString().trim() + "/jsdom")); }
const fs = require("fs"), path = require("path"), dir = path.join(__dirname, "..");
const cfg = fs.readFileSync(path.join(dir, "..", "assets", "config.js"), "utf8");
const html = fs.readFileSync(path.join(dir, "index.html"), "utf8")
  .replace(/<script src="https:\/\/cdn\.jsdelivr\.net[^"]*"><\/script>/, "")
  .replace(/<script src="\.\.\/assets\/config\.js(\?v=\d+)?"><\/script>/, () => `<script>${cfg}</script>`)
  .replace(/<script src="([\w.-]+\.js)(\?v=\d+)?"><\/script>/g, (m, f) => `<script>${fs.readFileSync(path.join(dir, f), "utf8")}</script>`);
const errs = [];
const dom = new JSDOM(html, { runScripts: "dangerously", url: "https://site.test/search/?embed=1#agent", beforeParse(w) {
  w.structuredClone = o => JSON.parse(JSON.stringify(o)); w.scrollTo = () => {}; w.confirm = () => true; w.prompt = (a, b) => b;
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; }; w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  w.fetch = async () => ({ ok: false }); w.addEventListener("error", e => errs.push(e.message)); } });
const w = dom.window, E = js => w.eval(js), $ = s => w.document.querySelector(s), $$ = s => [...w.document.querySelectorAll(s)];
let fails = 0; const check = (n, ok) => { console.log((ok ? "PASS " : "FAIL ") + n); if (!ok) fails++; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const HCm = require(path.join(dir, "home-care.js"));
{
  check("June 8 appeal deadline moves to Monday when it's a weekend (2025 → June 9)", HCm.appealDeadline(2025) === "2025-06-09" && HCm.appealDeadline(2027) === "2027-06-08");
  check("protest window shows in odd years from April to the deadline", HCm.taxNotes("2027-05-10").some(n => n.key === "protest" && n.urgent) && !HCm.taxNotes("2026-05-10").some(n => n.key === "protest") && !HCm.taxNotes("2027-06-20").some(n => n.key === "protest"));
  check("tax due reminders in February and June", HCm.taxNotes("2026-02-03").some(n => n.key === "halfone") && HCm.taxNotes("2026-06-03").some(n => n.key === "halftwo"));
  const sfr = { type: "Single Family Residence", city: "Denver" }, condo = { type: "Condominium", city: "Denver" };
  check("October: sprinkler blowout for houses, not condos", HCm.tasks(sfr, 10).some(x => x.key === "blowout") && !HCm.tasks(condo, 10).some(x => x.key === "blowout"));
  check("septic only on rural acreage", HCm.tasks({ ...sfr, city: "Byers", lot: 5 }, 9).some(x => x.key === "septic") && !HCm.tasks(sfr, 9).some(x => x.key === "septic"));
  check("every month has at least one task for a house", [...Array(12)].every((_, i) => HCm.tasks(sfr, i + 1).length > 0));
  check("Spanish text for every task", HCm.TASKS.every(x => x[4] && x[4] !== x[3]) && /aspersores/.test(HCm.tasks(sfr, 10, "es").map(x => x.text).join(" ")));
  const b = HCm.balance({ amount: 400000, rate: 6, termYears: 30, start: "2020-01-01" }, "2025-01-01");
  check("loan balance follows amortization (≈ $372K after 5 years at 6%)", b > 371000 && b < 374000);
  check("paid-off loan is zero", HCm.balance({ amount: 100000, rate: 5, termYears: 15, start: "2000-01-01" }, "2026-01-01") === 0);
  const s = HCm.summary({ purchasePrice: 500000, purchaseDate: "2024-01-01", value: { amount: 560000, date: "2026-10-01" }, loan: { amount: 400000, rate: 6, termYears: 30, start: "2024-02-01" } }, "2026-11-01");
  check("summary: equity = value − balance, gain = value − price", Math.round(s.equity) === Math.round(560000 - s.balance) && s.gain === 60000 && s.years > 2.8);
  const m = HCm.monthlyText({ address: "1 Elm", firstName: "Ana", type: "Single Family Residence" }, "2027-05-01", "es");
  check("monthly email in Spanish includes tasks and the protest window", /Hola Ana/.test(m.text) && /aspersores/.test(m.text) && /apelar/.test(m.text) && /mayo/.test(m.subject));
}
setTimeout(async () => {
  E(`agentPanel = "home"; renderAgent()`);
  check("Homeowners tile", !!$('[data-panel="homeowners"]'));
  E(`agentPanel = "homeowners"; renderAgent()`);
  const txt = () => $("#v-agent").textContent;
  check("agent sees the demo portal with value and reminders", /1440 N Gaylord/.test(txt()) && /\$968,000/.test(txt()) && /Monthly reminders on/.test(txt()));
  // Send a value
  $('[data-ho-open="hdemo|value"]').click(); $("#hoV").value = "985K"; $("#hoVn").value = "Updated after October sales."; $('[data-ho-value="hdemo"]').click(); await wait(20);
  check("agent sends a value (accepts 985K)", E(`Homeowner.demo.hdemo.value.amount`) === 985000 && /Updated after October/.test(E(`Homeowner.demo.hdemo.value.note`)));
  $('[data-ho-open="hdemo|doc"]').click(); $("#hoDt").value = "Deed"; $("#hoDu").value = "javascript:alert(1)"; $('[data-ho-doc="hdemo"]').click(); await wait(20);
  check("document links must be https", E(`Homeowner.demo.hdemo.docs.length`) === 2 && /https link/.test(txt()));
  $("#hoDt").value = "Deed"; $("#hoDu").value = "https://example.com/deed.pdf"; $('[data-ho-doc="hdemo"]').click(); await wait(20);
  check("https document added", E(`Homeowner.demo.hdemo.docs.length`) === 3);
  // Set up a portal for a past client
  const setup = $('[data-ho-open^="new:"]');
  check("past clients with the app can get a portal", !!setup);
  if (setup) { setup.click(); await wait(10); $("#hoA").value = "77 Oak St"; $("#hoP").value = "650000"; $("#hoLang").value = "es"; $("[data-ho-create]").click(); await wait(20); }
  check("portal created in Spanish for that client", E(`Object.values(Homeowner.demo).some(h => h && h.address === "77 Oak St" && h.lang === "es" && h.purchasePrice === 650000)`));
  // Closed shared buyer deal becomes a portal automatically
  E(`(() => { const d = JSON.parse(JSON.stringify(Office.deals.dd1)); d.side = "buyer"; d.status = "closed"; d.shareClient = true; Office._t.saveDeal("dd1", d); })()`); await wait(1200);
  check("closing a shared buyer deal creates the portal", E(`!!Homeowner.demo.hdd1`) && E(`Office.deals.dd1.homeCreated`) === true);
  // Client view
  const show = () => { $("#hoTest") && $("#hoTest").remove(); w.document.body.insertAdjacentHTML("beforeend", `<div id="hoTest">${E(`Homeowner.clientHTML()`)}</div>`); };
  show();
  const ct = () => $("#hoTest").textContent;
  check("client sees value, equity, and this month's care", /Your home: 1440 N Gaylord/.test(ct()) && /Equity/.test(ct()) && /This month/.test(ct()) && $$("#hoTest [data-ho-task]").length > 0);
  check("client sees documents with safe links only", $$("#hoTest .ho-docs a").every(a => a.href.startsWith("https://")) && /Deed/.test(ct()));
  const box = $("#hoTest [data-ho-task]"); box.checked = true; box.dispatchEvent(new w.Event("change", { bubbles: true })); await wait(20);
  check("checking off a task is saved", E(`Object.keys(Homeowner.demo.hdemo.done).length`) === 1);
  show(); $('#hoTest [data-ho-ask="hdemo"]').click(); await wait(20);
  check("asking for a value flags it for the agent", !!E(`Homeowner.demo.hdemo.valueRequestAt`) && E(`Homeowner.requests()`) === 1);
  show(); const r = $('#hoTest [data-ho-remind="hdemo"]'); r.checked = false; r.dispatchEvent(new w.Event("change", { bubbles: true })); await wait(20);
  check("client can turn off monthly emails", E(`Homeowner.demo.hdemo.remind`) === false);
  check("closed deals leave the transaction guide", !E(`ClientGuide._t.myDeals().some(([id]) => id === "dd1")`));
  check("no script errors", errs.length === 0 || (console.log(errs), false));
  console.log(fails ? `${fails} failed` : "All homeowner portal tests passed"); process.exit(fails ? 1 : 0);
}, 400);
