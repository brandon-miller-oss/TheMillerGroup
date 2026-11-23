// Agent brands ("<business>, brokered by The Miller Group"), broker approval, and the starter kit.
let JSDOM; try { ({ JSDOM } = require("jsdom")); } catch (e) { ({ JSDOM } = require(require("child_process").execSync("npm root -g").toString().trim() + "/jsdom")); }
const fs = require("fs"), path = require("path"), os = require("os"), cp = require("child_process"), dir = path.join(__dirname, "..");
const cfg = fs.readFileSync(path.join(dir, "..", "assets", "config.js"), "utf8");
const libs = fs.readFileSync(require.resolve("jspdf/dist/jspdf.umd.min.js"), "utf8") + "\n" + fs.readFileSync(require.resolve("qrcode-generator/qrcode.js"), "utf8");
const html = fs.readFileSync(path.join(dir, "index.html"), "utf8")
  .replace(/<script src="https:\/\/cdn\.jsdelivr\.net[^"]*"><\/script>/, "")
  .replace(/<script src="\.\.\/assets\/config\.js(\?v=\d+)?"><\/script>/, () => `<script>${cfg}</script><script>${libs}</script>`)
  .replace(/<script src="([\w.-]+\.js)(\?v=\d+)?"><\/script>/g, (m, f) => `<script>${fs.readFileSync(path.join(dir, f), "utf8")}</script>`);
const errs = [];
const dom = new JSDOM(html, { runScripts: "dangerously", url: "https://site.test/search/?embed=1#agent", beforeParse(w) {
  w.structuredClone = o => JSON.parse(JSON.stringify(o)); w.scrollTo = () => {}; w.confirm = () => true; w.prompt = (a, b) => "Make the logo larger";
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; }; w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  w.fetch = async () => ({ ok: false }); w.addEventListener("error", e => errs.push(e.message)); } });
const w = dom.window, E = js => w.eval(js), $ = s => w.document.querySelector(s), $$ = s => [...w.document.querySelectorAll(s)];
let fails = 0; const check = (n, ok) => { console.log((ok ? "PASS " : "FAIL ") + n); if (!ok) fails++; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const text = async (js, label) => { const o = await E(`(${js}).then(r => ({ pages: r.doc.getNumberOfPages(), bytes: Array.from(new Uint8Array(r.doc.output("arraybuffer"))) }))`); const f = path.join(os.tmpdir(), "ab_" + label + ".pdf"); fs.writeFileSync(f, Buffer.from(o.bytes)); return { pages: o.pages, file: f, text: cp.execSync(`pdftotext -layout "${f}" -`).toString().replace(/[ \t]+/g, " ") }; };
setTimeout(async () => {
  const v = (n, p = "#18302E", a = "#C99B52") => E(`AgentBrand.validate(${JSON.stringify({ name: n, primary: p, accent: a })})`);
  check("Colorado name rules: Realty, LLC, Inc., Real estate, Company are rejected", ["Rivera Realty", "Rivera Homes LLC", "Rivera Inc.", "Rivera Real Estate", "Rivera Home Company"].every(n => v(n).length));
  check("a plain business name passes", v("Alex Rivera Homes").length === 0);
  check("using The Miller Group as the business name is rejected", v("Miller Group Denver").length > 0);
  check("low-contrast colors are flagged", v("Alex Rivera Homes", "#DDDDDD", "#EEEEEE").length >= 1);
  // Demo: Alex's brand is approved
  const alex = E(`JSON.stringify(AgentBrand.current("demo-agent"))`), A = JSON.parse(alex);
  check("approved brand leads, with Brokered by The Miller Group", A.display === "Alex Rivera Homes" && A.byline === "Brokered by The Miller Group" && A.phone === "720-555-0150");
  check("broker without a brand stays The Miller Group", E(`AgentBrand.current("demo-broker").display`) === "The Miller Group" && E(`AgentBrand.current("demo-broker").byline`) === "");
  // Panel
  E(`agentPanel = "home"; renderAgent()`);
  check("My brand tile on Agent home", !!$('[data-panel="agent-brand"]'));
  E(`agentPanel = "agent-brand"; renderAgent()`);
  check("brand panel: form, presets, kit buttons, and agent brands for the broker", !!$("#abName") && $$("[data-ab-preset]").length === 6 && !!$("[data-ab-kit]") && $("#v-agent").textContent.includes("Alex Rivera Homes"));
  // Print studio as Alex
  $('[data-ab-preview="demo-agent"]').click(); await wait(80);
  check("broker can make materials as Alex; studio shows his brand", $("#v-agent").textContent.includes("Branded as Alex Rivera Homes") && E("AgentBrand.as") === "demo-agent");
  let o = await text(`PrintStudio._t.buildPDF()`, "flyer_alex");
  check("Alex's flyer leads with his brand, keeps the brokerage, and uses his phone", o.text.includes("Alex Rivera Homes") && o.text.includes("Brokered by The Miller Group") && o.text.includes("720-555-0150") && !o.text.includes("303-990-0702"));
  for (const k of ["brochure", "postcard", "mailer", "bizcard", "onepager", "letterhead", "signin"]) {
    $(`[data-ps-product="${k}"]`).click(); await wait(5); o = await text(`PrintStudio._t.buildPDF()`, k + "_alex");
    check(`${k}: brand name and Brokered by The Miller Group`, o.text.includes("Alex Rivera Homes") && /Brokered\s+by\s+The\s+Miller\s+Group/.test(o.text));
  }
  // Presentations and CMA as Alex
  o = await text(`Presentation.buildPDF("dpr1")`, "pres_alex");
  check("listing presentation is branded for Alex with the brokerage", o.text.includes("Alex Rivera Homes") && o.text.includes("Brokered by The Miller Group") && o.text.includes("Alex Rivera"));
  o = await text(`BuyerPresentation.buildPDF("dbp1")`, "buyer_alex");
  check("buyer presentation too", o.text.includes("Alex Rivera Homes") && o.text.includes("Brokered by The Miller Group"));
  // Kit
  o = await text(`PrintStudio.buildKit("demo-agent")`, "kit_alex");
  check("starter kit: 8 pages (brand sheet, card front/back, letterhead, one-pager, postcard front/back, sign-in)", o.pages === 8 && o.text.includes("Brand sheet") && o.text.includes("Meet your agent") && o.text.includes("Open house") && o.text.includes("Rule 6.10"));
  check("email signature carries the brand and the brokerage", E(`AgentBrand.signatureHTML("demo-agent")`).includes("Brokered by The Miller Group"));
  // Changing the brand drops approval until the broker approves again
  E(`Store.team["demo-agent"].brand = { ...Store.team["demo-agent"].brand, name: "Rivera Homes Denver", submittedAt: new Date().toISOString() }`);
  check("a changed brand waits for approval and materials fall back to The Miller Group", E(`AgentBrand.status("demo-agent").state`) === "pending" && E(`AgentBrand.current("demo-agent").display`) === "The Miller Group");
  E(`agentPanel = "agent-brand"; renderAgent()`); $('[data-ab-approve="demo-agent"]').click();
  check("broker approves; the new name leads again", E(`AgentBrand.current("demo-agent").display`) === "Rivera Homes Denver");
  $('[data-ab-changes="demo-agent"]').click();
  check("request changes records the note", E(`AgentBrand.status("demo-agent").state`) === "changes" && E(`AgentBrand.status("demo-agent").note`) === "Make the logo larger");
  // Broker's own brand: save and approve
  E(`AgentBrand.as = null; AgentBrand.draft = { name: "Brandon Miller Homes", tagline: "", primary: "#141A26", accent: "#B8935A" }; renderAgent()`);
  $("[data-ab-submit]").click(); await wait(20);
  check("broker's own brand is saved and approved in one step", E(`AgentBrand.status("demo-broker").state`) === "approved" && E(`AgentBrand.current().display`) === "Brandon Miller Homes");
  check("no page errors", errs.length === 0); if (errs.length) console.log(errs);
  console.log(fails ? `${fails} failed` : "All agent brand tests passed"); process.exit(fails ? 1 : 0);
}, 500);
