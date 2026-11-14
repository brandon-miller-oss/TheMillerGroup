// Buyer presentation kit: builder, checklist, and the PDF. Run: npm i jsdom jspdf@2.5.1 && node search/test/buyer-presentation.test.js
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
  check("Buyer presentations tile on Agent home", !!$('[data-panel="buyerpres"]'));
  E(`agentPanel = "buyerpres"; renderAgent()`);
  check("list shows the demo presentation", $("#v-agent").textContent.includes("Priya Shah"));
  E(`agentPanel = "buyers"; renderAgent()`); const btn = $('[data-bp-for="dct1"]');
  check("buyer pipeline card has a Buyer presentation button", !!btn);
  btn.click(); const id = E(`agentPanel.slice(10)`), bp = E(`Store.crm.buyerpres["${id}"]`);
  check("new presentation from a buyer fills name", bp && bp.preparedFor === "Jordan Reyes");
  check("builder shows payment, PDF button and checklist", $("#v-agent").textContent.includes("Estimated monthly payment") && !!$(`[data-bp-pdf="${id}"]`) && $("#v-agent").textContent.includes("Definitions of Working Relationships"));
  const kit = $(`[data-bp-kit="${id}|dwr"]`); kit.checked = true; kit.dispatchEvent(new w.Event("change", { bubbles: true }));
  check("checklist item saves", E(`Store.crm.buyerpres["${id}"].kit.dwr`) === true);
  const out = await E(`BuyerPresentation.buildPDF("dbp1").then(r => ({ name: r.name, pages: r.doc.getNumberOfPages(), bytes: Array.from(new Uint8Array(r.doc.output("arraybuffer"))) }))`);
  const file = path.join(os.tmpdir(), out.name); fs.writeFileSync(file, Buffer.from(out.bytes));
  const text = require("child_process").execSync(`pdftotext -layout "${file}" -`).toString();
  console.log(`PDF: ${out.pages} pages, saved to ${file}`);
  const need = ["Your road to closed", "Prepared for Priya Shah", "Your agent", "How we work together", "Definitions of Working Relationships", "Exclusive Right-to-Buy", "The market for buyers", "Your buying power", "Payment breakdown", "Your loan options", "FHA", "Down payment assistance", "metroDPA", "CHFA", "Touring homes", "Writing a winning offer", "Escalation clause", "Under contract: the key dates", "Inspections, appraisal, and title", "Your home buying team", "Aspen Mortgage Group", "Wire fraud warning", "Next steps"];
  const missing = need.filter(s => !text.includes(s));
  check("every section is in the PDF", missing.length === 0); if (missing.length) console.log("missing:", missing);
  check("compensation shown as negotiable", /negotiable/i.test(text));
  check("no agent-only items in the client PDF", !/review with your Employing Broker|Associate Use|Confidential|Appointment checklist/i.test(text));
  check("Equal Housing note", text.includes("Equal Housing Opportunity"));
  check("no page errors", errs.length === 0); if (errs.length) console.log(errs);
  console.log(fails ? `${fails} failed` : "All buyer presentation tests passed"); process.exit(fails ? 1 : 0);
}, 500);
