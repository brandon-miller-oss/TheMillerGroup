// Showing coverage: post, claim, access notes, release, done, and broker fees.
let JSDOM; try { ({ JSDOM } = require("jsdom")); } catch (e) { ({ JSDOM } = require(require("child_process").execSync("npm root -g").toString().trim() + "/jsdom")); }
const fs = require("fs"), path = require("path"), dir = path.join(__dirname, "..");
const cfg = fs.readFileSync(path.join(dir, "..", "assets", "config.js"), "utf8").replace(/DEMO_MODE: false/, "DEMO_MODE: true"); // these tests run on sample data
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
setTimeout(async () => {
  E(`agentPanel = "home"; renderAgent()`);
  const tile = $('[data-panel="coverage"]');
  check("Showing coverage tile shows the open request count", !!tile && /1/.test(tile.textContent));
  E(`agentPanel = "coverage"; renderAgent()`);
  check("open request from another agent with fee and Claim button", /4473 Brenning/.test($("#v-agent").textContent) && /\$40/.test($("#v-agent").textContent) && !!$("[data-cv-claim]"));
  check("access notes hidden before claiming", !/Supra lockbox/.test($("#v-agent").textContent));
  $("[data-cv-claim]").click(); await wait(30);
  check("claiming moves it to I’m covering and shows access notes", /You’re covering/.test($("#v-agent").textContent) && /Supra lockbox/.test($("#v-agent").textContent));
  check("can't claim your own request", E(`Coverage.openForMe().every(x => x.agentId !== Store.crmOwner)`));
  $("[data-cv-release]").click(); await wait(30);
  check("releasing puts it back to open", E(`Coverage.items.dcv1.status`) === "open" && !E(`Coverage.items.dcv1.claimedBy`));
  // Post a new one from an upcoming open house
  $("[data-cv-new]").click(); await wait(10);
  const pre = $("#cvPre");
  check("form offers my upcoming showings and open houses", !!pre && pre.options.length > 1);
  pre.value = pre.options[1].value; pre.dispatchEvent(new w.Event("change", { bubbles: true }));
  check("picking one fills date and address", !!$("#cvDate").value && !!$("#cvAddr").value);
  $("#cvAddr").value = ""; $("[data-cv-save]").click(); await wait(20);
  check("needs an address", /Add a date and an address/.test($("#v-agent").textContent));
  $("#cvAddr").value = "1186 S Larkmoor St"; $("#cvFee").value = "$35"; $("#cvAccess").value = "Code 1234"; $("#cvDetails").value = "Buyer is Jordan";
  $("[data-cv-save]").click(); await wait(30);
  const id = E(`Object.keys(Coverage.items).find(k => Coverage.items[k].address === "1186 S Larkmoor St")`);
  check("request saved with fee; access kept separately", !!id && E(`Coverage.items["${id}"].fee`) === 35 && E(`Coverage.items["${id}"].access`) === undefined && E(`Coverage.demoAccess["${id}"].notes`) === "Code 1234");
  check("My requests lists it with Edit and Cancel", /1186 S Larkmoor/.test($("#v-agent").textContent) && !!$(`[data-cv-cancel="${id}"]`));
  // Broker fees
  $('[data-cv-tab="fees"]').click(); await wait(10);
  check("broker sees completed fees to pay", /\$50 to Brandon Miller/.test($("#v-agent").textContent));
  $("[data-cv-paid]").click(); await wait(20);
  check("mark paid", E(`Coverage.items.dcv3.feePaid`) === true && /Recently paid/.test($("#v-agent").textContent));
  check("the rule about brokerage-paid fees is on the form", (() => { $("[data-cv-new]").click(); return /never agent to agent/.test($("#v-agent").textContent); })());
  check("no script errors", errs.length === 0 || (console.log(errs), false));
  console.log(fails ? `${fails} failed` : "All showing coverage tests passed"); process.exit(fails ? 1 : 0);
}, 400);
