// Listing presentation: builder, net sheet math, and the PDF. Run: npm i jsdom jspdf@2.5.1 && node search/test/presentation.test.js
let JSDOM; try { ({ JSDOM } = require("jsdom")); } catch (e) { ({ JSDOM } = require(require("child_process").execSync("npm root -g").toString().trim() + "/jsdom")); }
const fs = require("fs"), path = require("path"), os = require("os"), dir = path.join(__dirname, "..");
const cfg = fs.readFileSync(path.join(dir, "..", "assets", "config.js"), "utf8");
const jspdfSrc = fs.readFileSync(require.resolve("jspdf/dist/jspdf.umd.min.js"), "utf8");
const html = fs.readFileSync(path.join(dir, "index.html"), "utf8")
  .replace(/<script src="https:\/\/cdn\.jsdelivr\.net[^"]*"><\/script>/, "")
  .replace(/<script src="\.\.\/assets\/config\.js(\?v=\d+)?"><\/script>/, () => `<script>${cfg}</script><script>${jspdfSrc}</script>`)
  .replace(/<script src="([\w.-]+\.js)(\?v=\d+)?"><\/script>/g, (m, f) => `<script>${fs.readFileSync(path.join(dir, f), "utf8")}</script>`);
const errs = [];
const dom = new JSDOM(html, { runScripts: "dangerously", url: "https://site.test/search/#agent", beforeParse(w) {
  w.structuredClone = o => JSON.parse(JSON.stringify(o)); w.scrollTo = () => {}; w.confirm = () => true; w.prompt = (a, b) => b;
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; }; w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  w.fetch = async () => ({ ok: false }); w.addEventListener("error", e => errs.push(e.message)); } });
const w = dom.window, E = js => w.eval(js), $ = s => w.document.querySelector(s);
let fails = 0; const check = (n, ok) => { console.log((ok ? "PASS " : "FAIL ") + n); if (!ok) fails++; };
setTimeout(async () => {
  E(`agentPanel = "home"; renderAgent()`);
  check("Listing presentations tile on Agent home", !!$('[data-panel="presentations"]'));
  const net = E(`Presentation._t.netCalc({ net: { price: 600000, listFeePct: 2.5, buyerCompPct: 2, title: 2000, closingFee: 300, annualTaxes: 3650, closeDate: "2026-07-02", payoff: 300000 } })`);
  check("net sheet: fees, title, taxes prorated (Colorado, paid in arrears), payoff", Math.round(net.costs) === 15000 + 12000 + 2000 + 300 + 1820 + 300000 && Math.round(net.net) === 600000 - Math.round(net.costs));
  check("net sheet falls back to the CMA value", E(`Presentation._t.netCalc(Store.crm.presentations.dpr1).price`) === E(`cmaCalc(Store.crm.cmas.dcm1).value`));
  // From a seller contact
  E(`agentPanel = "sellers"; renderAgent()`); $('[data-pr-for="contact|dct3"]').click();
  const id = E(`agentPanel.slice(13)`), pr = E(`Store.crm.presentations["${id}"]`);
  check("Presentation from a seller links their CMA and name", pr && pr.cmaId === "dcm1" && pr.preparedFor === "Tom and Alicia Grant" && pr.marketing.length === 11);
  check("builder shows estimated net and download button", $("#v-agent").textContent.includes("Estimated net proceeds") && !!$(`[data-pr-pdf="${id}"]`));
  // Profile form saves
  E(`agentPanel = "pres-profile"; renderAgent()`); $("#ppHomes").value = "250+"; $("#ppYears").value = "2016";
  $("#presProfileForm").dispatchEvent(new w.Event("submit", { cancelable: true })); await new Promise(r => setTimeout(r, 60));
  check("presentation profile saves stats", E(`Presentation._t.profile().presStats.homes`) === "250+");
  // PDF
  const out = await E(`Presentation.buildPDF("dpr1").then(r => ({ name: r.name, pages: r.doc.getNumberOfPages(), bytes: Array.from(new Uint8Array(r.doc.output("arraybuffer"))) }))`);
  const file = path.join(os.tmpdir(), out.name); fs.writeFileSync(file, Buffer.from(out.bytes));
  const text = require("child_process").execSync(`pdftotext -layout "${file}" -`).toString();
  console.log(`PDF: ${out.pages} pages, saved to ${file}`);
  const need = ["Listing presentation", "Agent profile", "My pledge to you", "Denise and Kenneth Robinson", "Why The Miller Group", "The market right now", "Months of supply", "Property summary", "Comparable homes", "Listing overview", "Side-by-side comparison", "Status comparison and averages", "Price and days on market", "Price and size", "Pricing analysis", "Approximate market value", "Pricing strategy", "Estimated net proceeds", "Low end of range", "Getting your home ready", "Marketing plan", "The selling process", "Incentives, offers, and negotiation", "Questions to ask any agent", "Next steps"];
  const missing = need.filter(s => !text.includes(s));
  check("every section is in the PDF", missing.length === 0); if (missing.length) console.log("missing:", missing);
  check("no Coldwell Banker branding", !/coldwell/i.test(text));
  check("no advice to raise buyer agent commission", !/higher commission|3\.5%/i.test(text) && text.includes("optional and negotiable"));
  check("market stats cite their source and month", text.includes("October 2026") && text.includes("REcolorado"));
  check("not-an-appraisal statement", text.includes("not an appraisal"));
  // Section toggles drop pages
  E(`Store.crm.presentations.dpr1.sections = { compdetail:false, sidebyside:false, charts:false }`);
  const fewer = await E(`Presentation.buildPDF("dpr1").then(r => r.doc.getNumberOfPages())`);
  check("turning sections off removes pages", fewer < out.pages);
  check("no page errors", errs.length === 0); if (errs.length) console.log(errs);
  console.log(fails ? `${fails} failed` : "All presentation tests passed"); process.exit(fails ? 1 : 0);
}, 500);
