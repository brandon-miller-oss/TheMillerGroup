// CMA tests: automatic adjustments, valuation, one-tap CMA, and the PDF report.
// Run: npm i jsdom jspdf@2.5.1 && node search/test/cma.test.js
let JSDOM; try { ({ JSDOM } = require("jsdom")); } catch (e) { ({ JSDOM } = require(require("child_process").execSync("npm root -g").toString().trim() + "/jsdom")); }
const fs = require("fs"), path = require("path"), dir = path.join(__dirname, "..");
const cfg = fs.readFileSync(path.join(dir, "..", "assets", "config.js"), "utf8");
const jspdfSrc = fs.readFileSync(require.resolve("jspdf/dist/jspdf.umd.min.js"), "utf8");
const html = fs.readFileSync(path.join(dir, "index.html"), "utf8")
  .replace(/<script src="https:\/\/cdn\.jsdelivr\.net[^"]*"><\/script>/, "")
  .replace(/<script src="\.\.\/assets\/config\.js(\?v=\d+)?"><\/script>/, () => `<script>${cfg}</script><script>${jspdfSrc}</script>`)
  .replace(/<script src="([\w.-]+\.js)(\?v=\d+)?"><\/script>/g, (m, f) => `<script>${fs.readFileSync(path.join(dir, f), "utf8")}</script>`);
const errs = [];
const dom = new JSDOM(html, { runScripts: "dangerously", url: "https://site.test/search/#agent", beforeParse(w) {
  w.structuredClone = o => JSON.parse(JSON.stringify(o)); w.scrollTo = () => {}; w.confirm = () => true; w.prompt = () => "x";
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; }; w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  w.addEventListener("error", e => errs.push(e.message)); } });
const w = dom.window, E = js => w.eval(js);
let fails = 0; const check = (n, ok) => { console.log((ok ? "PASS " : "FAIL ") + n); if (!ok) fails++; };
setTimeout(async () => {
  // Automatic adjustments on a known pair
  const parts = E(`cmaAutoAdj({ sqft:2600, beds:4, baths:3, year:1926 }, { price:1000000, sqft:2400, beds:3, baths:3, year:1996, status:"Active" }, 400)`);
  const by = Object.fromEntries(parts.map(p => [p.label.split(" ")[0], p.amt]));
  check("size: +200 sq ft at 50% of $400 = +$40,000", by.Size === 40000);
  check("bedroom: +1 = +$10,000", by.Bedrooms === 10000);
  check("age: 70 years older = -$35,000", by.Age === -35000);
  check("active listing: -2% = -$20,000", by.Active === -20000);
  check("no bathroom adjustment when equal", !("Bathrooms" in by));

  // Valuation on the demo CMA
  const id = E("Object.keys(Store.crm.cmas)[0]");
  const r = E(`cmaCalc(Store.crm.cmas["${id}"])`);
  check("auto CMA values from adjusted prices", r.auto && r.method === "adjusted sale price" && r.low <= r.value && r.value <= r.high && r.value % 5000 === 0);
  E(`editCMA("${id}", c => { c.autoAdj = false; })`);
  check("turning automatic off falls back to price per sq ft", E(`cmaCalc(Store.crm.cmas["${id}"]).method`) === "adjusted price per square foot");
  E(`editCMA("${id}", c => { c.autoAdj = true; })`);
  check("rates come from brokerage settings", (() => { E(`Office.conn.cmaRates = { bed: 20000 }`); const p = E(`cmaAutoAdj({ beds:4 }, { price:1, beds:3 }, 0)`); E(`Office.conn.cmaRates = null`); return p[0].amt === 20000; })());

  // CMA screen shows the adjustments and report button
  E(`agentPanel = "cma:${id}"; renderAgent()`);
  const txt = w.document.querySelector("#v-agent").textContent;
  check("CMA screen lists automatic adjustments", /Size \(|Active listing/.test(txt) && txt.includes("Seller report (PDF)"));

  check("heavily adjusted comps are flagged", (() => { const rr = E(`cmaCalc({ subject:{ sqft:2600, beds:4, baths:3, year:1926 }, compKeys:["S-1012","S-1003"], autoAdj:true })`); return rr.rows.find(x => x.l.key === "S-1012").heavy === true && rr.heavy >= 1; })());
  // One-tap CMA from a seller contact linked to a listing
  const cid = E(`Store.saveCrm("contacts", null, { name:"Jane Seller", email:"jane@x.com", role:"seller", sellerStage:"prospect", listingKey:"S-1009" })`);
  E(`quickCMA("${cid}")`);
  const newId = E(`agentPanel.slice(4)`), nc = E(`Store.crm.cmas[agentPanel.slice(4)]`);
  check("one-tap CMA uses the linked listing and client", nc && nc.subject.address === "1689 Dorrance Ct" && nc.preparedFor === "Jane Seller" && nc.compKeys.length === 5 && !nc.compKeys.includes("S-1009"));
  E(`agentPanel = "sellers"; renderAgent()`);
  check("seller cards have Create CMA", !!w.document.querySelector(`[data-cmacontact="${cid}"]`));

  // PDF
  E(`Store.crm.cmas["${newId}"].notes = "Your home sits in the middle of the market. Let’s walk through it together.";`);
  const out = await E(`CMAReport.buildPDF("${newId}", { preparedFor:"Jane Seller", summary:true, details:true, map:true }).then(async r => ({ name:r.name, bytes:Array.from(new Uint8Array(r.doc.output("arraybuffer"))) }))`);
  const file = path.join(require("os").tmpdir(), out.name);
  fs.writeFileSync(file, Buffer.from(out.bytes));
  const text = require("child_process").execSync(`pdftotext -layout "${file}" -`).toString();
  check("PDF file name follows the address", out.name === "CMA_1689_Dorrance_Ct.pdf");
  check("PDF has the price range and client", /Suggested list price range/.test(text) && text.includes("Prepared for Jane Seller"));
  check("PDF has comps table, adjustment detail, map, summary", text.includes("Comparable homes") && text.includes("How each comp was adjusted") && text.includes("Where the comps are") && text.includes("walk through it together"));
  check("PDF says it is not an appraisal", text.includes("It is not an appraisal"));
  check("PDF footer has agent and page numbers", text.includes("Brandon Miller") && /Page 1 of \d/.test(text));
  console.log("PDF saved to " + file);

  // Report sheet requires review before email
  E(`CMAReport.open("${newId}")`);
  check("report sheet requires a review checkbox", !!w.document.querySelector("#crOk[required]"));
  check("no page errors", errs.length === 0); if (errs.length) console.log(errs);
  console.log(fails ? `${fails} failed` : "All CMA tests passed"); process.exit(fails ? 1 : 0);
}, 500);
