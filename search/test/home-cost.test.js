// True cost of ownership: estimate rules, sources, checks, agent facts, and the listing view.
let JSDOM; try { ({ JSDOM } = require("jsdom")); } catch (e) { ({ JSDOM } = require(require("child_process").execSync("npm root -g").toString().trim() + "/jsdom")); }
const fs = require("fs"), path = require("path"), dir = path.join(__dirname, "..");
const cfg = fs.readFileSync(path.join(dir, "..", "assets", "config.js"), "utf8");
const html = fs.readFileSync(path.join(dir, "index.html"), "utf8")
  .replace(/<script src="https:\/\/cdn\.jsdelivr\.net[^"]*"><\/script>/, "")
  .replace(/<script src="\.\.\/assets\/config\.js(\?v=\d+)?"><\/script>/, () => `<script>${cfg}</script>`)
  .replace(/<script src="([\w.-]+\.js)(\?v=\d+)?"><\/script>/g, (m, f) => `<script>${fs.readFileSync(path.join(dir, f), "utf8")}</script>`);
const errs = [];
const dom = new JSDOM(html, { runScripts: "dangerously", url: "https://site.test/search/", beforeParse(w) {
  w.structuredClone = o => JSON.parse(JSON.stringify(o)); w.scrollTo = () => {}; w.confirm = () => true; w.prompt = (a, b) => b;
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; }; w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  w.fetch = async () => ({ ok: false }); w.addEventListener("error", e => errs.push(e.message)); } });
const w = dom.window, E = js => w.eval(js), $ = s => w.document.querySelector(s), $$ = s => [...w.document.querySelectorAll(s)];
let fails = 0; const check = (n, ok) => { console.log((ok ? "PASS " : "FAIL ") + n); if (!ok) fails++; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const HC = require(path.join(dir, "home-cost.js"));
const near = (a, b, t = 2) => Math.abs(a - b) <= t;
// Pure rules
{
  const sfr = { key: "k", price: 800000, sqft: 2000, year: 1950, type: "Single Family Residence", city: "Denver", lot: 0.15 };
  const e = HC.estimate(sfr, { down: 20, rate: 6.5 });
  const pi = 640000 * (6.5 / 1200) / (1 - Math.pow(1 + 6.5 / 1200, -360));
  check("principal and interest matches the amortization formula", near(e.lines.find(x => x.key === "pi").monthly, pi, 0.01));
  check("no mortgage insurance at 20% down", !e.lines.some(x => x.key === "pmi"));
  check("mortgage insurance with 10% down", HC.estimate(sfr, { down: 10, rate: 6.5 }).lines.some(x => x.key === "pmi"));
  check("Denver tax estimate uses the Denver rate", near(e.lines.find(x => x.key === "tax").monthly, 800000 * 0.0055 / 12) && e.lines.find(x => x.key === "tax").source === "estimate");
  check("single-family insurance from rebuild cost", near(e.lines.find(x => x.key === "ins").monthly, 2000 * 275 * 0.0055 / 12));
  check("total adds the lines", near(e.total, e.lines.reduce((s, x) => s + x.monthly, 0), 0.01));
  check("older home gets sewer scope and lead paint checks", e.checks.some(c => c.key === "sewer") && e.checks.some(c => c.key === "lead"));
  check("radon, flood, wildfire, and metro district are always checked", ["radon", "flood", "wildfire", "metro"].every(k => e.checks.some(c => c.key === k)));
  const mls = HC.estimate({ ...sfr, taxAnnual: 6000, taxYear: 2025, hoaFee: 300, hoaFreq: "Quarterly", hoaFee2: 50, hoaFreq2: "Monthly" });
  check("listing tax bill and both HOAs are used and labeled", mls.lines.find(x => x.key === "tax").source === "mls" && near(mls.lines.find(x => x.key === "tax").monthly, 500) && near(mls.lines.find(x => x.key === "hoa").monthly, 150));
  const fact = HC.estimate({ ...sfr, taxAnnual: 6000 }, {}, { taxAnnual: 9000, metroDistrict: "yes", wildfire: "high", floodZone: "AE" });
  check("agent facts beat the listing", fact.lines.find(x => x.key === "tax").source === "agent" && near(fact.lines.find(x => x.key === "tax").monthly, 750));
  check("high wildfire raises insurance and warns", fact.lines.find(x => x.key === "ins").monthly > e.lines.find(x => x.key === "ins").monthly * 1.5 && fact.flags.some(f => f.key === "wildfire"));
  check("flood zone AE flags required flood insurance", fact.flags.some(f => f.key === "flood") && fact.checks.find(c => c.key === "flood").status === "warn");
  check("metro district shows as a warning check", fact.checks.find(c => c.key === "metro").status === "warn");
  const nc = HC.estimate({ ...sfr, year: new Date().getFullYear(), taxAnnual: 900 });
  check("new construction with a land-only tax bill is flagged", nc.flags.some(f => f.key === "landonly"));
  const condo = HC.estimate({ key: "c", price: 400000, sqft: 800, year: 2005, type: "Condominium", city: "Denver" });
  check("condo uses an HO-6 policy and asks about missing HOA dues", condo.lines.find(x => x.key === "ins").monthly === 45 && condo.flags.some(f => f.key === "hoa") && condo.checks.some(c => c.key === "hoadocs"));
  const rural = HC.estimate({ key: "r", price: 600000, sqft: 2200, year: 2001, type: "Single Family Residence", city: "Byers", lot: 5 });
  check("rural acreage gets a well and septic check", rural.checks.some(c => c.key === "well"));
  check("broker config overrides the defaults", near(HC.estimate(sfr, {}, {}, { taxRate: { Denver: 0.01 } }).lines.find(x => x.key === "tax").monthly, 800000 * 0.01 / 12));
  const den = HC.estimate(sfr, {}, {});
  check("ADU check for a Denver house cites the state ADU law", den.checks.some(c => c.key === "adu" && /ADU law/.test(c.note)) && !condo.checks.some(c => c.key === "adu"));
  check("Denver short-term rentals: primary residence only, flagged", den.checks.some(c => c.key === "str" && c.status === "warn" && /primary residence/.test(c.note)));
  const brk = HC.estimate({ key: "b", price: 1200000, city: "Breckenridge", type: "Condominium", hoaFee: 600 }, { lang: "es" });
  check("Breckenridge: licenses capped and don't transfer, plus HOA note, in Spanish", brk.checks.some(c => c.key === "str" && /no se transfieren/.test(c.note) && /HOA/.test(c.note)));
  const fx = HC.estimate({ ...sfr, city: "Golden" }, {}, { adu: "Permitted ADU over the garage", str: "HOA prohibits rentals under 30 days" });
  check("agent ADU and rental facts set the status", fx.checks.find(c => c.key === "adu").status === "ok" && fx.checks.find(c => c.key === "str").status === "warn");
  check("bad inputs fall back to defaults", HC.estimate(sfr, { down: "abc", rate: -1 }).inputs.down === 20);
}
setTimeout(async () => {
  // Listing view (demo client view)
  E(`openListing("S-1002")`); await wait(50);
  const box = () => $("#costBox");
  check("listing shows What it really costs", !!box() && /What it really costs/.test(box().textContent));
  check("agent-verified HOA is labeled", /Verified by agent/.test(box().textContent) && /512/.test(box().textContent));
  check("links to official lookups open in a new tab", $$("#costBox a[target=_blank]").length >= 3 && $$("#costBox a").every(a => /^https:\/\//.test(a.href)));
  const t0 = box().querySelector(".cost-total b").textContent;
  const dn = $("#costDown"); dn.value = "5"; dn.dispatchEvent(new w.Event("input", { bubbles: true })); await wait(350);
  check("changing the down payment updates the total and adds mortgage insurance", box().querySelector(".cost-total b").textContent !== t0 && /Mortgage insurance/.test(box().textContent));
  E(`CostUI.inputs = { down: null, rate: null }`);
  E(`openListing("S-1010")`); await wait(50);
  check("flood zone AE with a quote is in the total", /Flood insurance/.test(box().textContent) && /AE/.test(box().textContent));
  // Cards show the all-in number
  check("cards show an all-in monthly number", /all-in/.test($("#v-search") ? $("#v-search").textContent : w.document.body.textContent));
  // Agent edits facts
  E(`Store.isAgent = true`); E(`openListing("S-1003")`); await wait(50);
  $("[data-cost-edit]").click(); await wait(50);
  $("#cfTax").value = "$8,100"; $("#cfMetro").value = "no"; $("#cfFire").value = "low"; $("#cfSewer").value = "Clear, scoped 11/2026";
  $("[data-cost-save]").click(); await wait(50);
  check("agent facts save and show as verified", /Verified by agent/.test(box().textContent) && /8,100/.test(box().textContent) && E(`CostUI.demo["S-1003"].taxAnnual`) === 8100);
  check("saved facts clear the open checks they answer", $$("#costBox .cost-checks li.ok").length >= 3);
  check("no script errors", errs.length === 0 || (console.log(errs), false));
  console.log(fails ? `${fails} failed` : "All cost of ownership tests passed"); process.exit(fails ? 1 : 0);
}, 400);
