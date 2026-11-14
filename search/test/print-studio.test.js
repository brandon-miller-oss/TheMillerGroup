// Print studio: flyers, brochures, postcards, event mailers, business cards. Run: npm i jsdom jspdf@2.5.1 qrcode-generator@1.4.4 && node search/test/print-studio.test.js
let JSDOM; try { ({ JSDOM } = require("jsdom")); } catch (e) { ({ JSDOM } = require(require("child_process").execSync("npm root -g").toString().trim() + "/jsdom")); }
const fs = require("fs"), path = require("path"), os = require("os"), cp = require("child_process"), dir = path.join(__dirname, "..");
const cfg = fs.readFileSync(path.join(dir, "..", "assets", "config.js"), "utf8");
const libs = fs.readFileSync(require.resolve("jspdf/dist/jspdf.umd.min.js"), "utf8") + "\n" + fs.readFileSync(require.resolve("qrcode-generator/qrcode.js"), "utf8");
const html = fs.readFileSync(path.join(dir, "index.html"), "utf8")
  .replace(/<script src="https:\/\/cdn\.jsdelivr\.net[^"]*"><\/script>/, "")
  .replace(/<script src="\.\.\/assets\/config\.js(\?v=\d+)?"><\/script>/, () => `<script>${cfg}</script><script>${libs}</script>`)
  .replace(/<script src="([\w.-]+\.js)(\?v=\d+)?"><\/script>/g, (m, f) => `<script>${fs.readFileSync(path.join(dir, f), "utf8")}</script>`);
const errs = [];
const dom = new JSDOM(html, { runScripts: "dangerously", url: "https://site.test/search/#agent", beforeParse(w) {
  w.structuredClone = o => JSON.parse(JSON.stringify(o)); w.scrollTo = () => {}; w.confirm = () => true; w.prompt = (a, b) => b;
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; }; w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  w.fetch = async () => ({ ok: false }); w.addEventListener("error", e => errs.push(e.message)); } });
const w = dom.window, E = js => w.eval(js), $ = s => w.document.querySelector(s), $$ = s => [...w.document.querySelectorAll(s)];
let fails = 0; const check = (n, ok) => { console.log((ok ? "PASS " : "FAIL ") + n); if (!ok) fails++; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const pdf = async (label) => { const o = await E(`PrintStudio._t.buildPDF().then(r => ({ name: r.name, pages: r.doc.getNumberOfPages(), w: r.doc.internal.pageSize.getWidth(), h: r.doc.internal.pageSize.getHeight(), bytes: Array.from(new Uint8Array(r.doc.output("arraybuffer"))) }))`);
  const file = path.join(os.tmpdir(), "ps_" + label + ".pdf"); fs.writeFileSync(file, Buffer.from(o.bytes)); o.file = file; o.text = cp.execSync(`pdftotext -layout "${file}" -`).toString(); return o; };
setTimeout(async () => {
  E(`agentPanel = "marketing"; renderAgent()`); await wait(80);
  check("Marketing opens on the Print studio with a Social posts tab", !!$('[data-mk-tab="social"]') && !!$("[data-ps-product]"));
  check("five products to choose from", $$("[data-ps-product]").length === 5);
  check("flyer preview renders with a QR code", !!$(".ps-preview svg") && $(".ps-preview svg").innerHTML.includes("<path d=\"M"));
  check("photo picker offers listing photos or an illustration plus Add photos", $$(".ps-ph").length >= 2 && !!$("[data-ps-upload]"));
  // Flyer PDF
  let o = await pdf("flyer");
  check("flyer PDF is 8.5 x 11, one page, with firm, agent, and Equal Housing line", o.pages === 1 && Math.abs(o.w - 8.5) < 0.01 && Math.abs(o.h - 11) < 0.01 && o.text.includes("The Miller Group") && o.text.includes("Brandon Miller") && o.text.includes("Equal Housing Opportunity"));
  // Bleed
  E(`PrintStudio.state.bleed = true`); o = await pdf("flyer_bleed");
  check("bleed adds 1/8 in. on every side", Math.abs(o.w - 8.75) < 0.01 && Math.abs(o.h - 11.25) < 0.01 && o.name.includes("print_ready"));
  E(`PrintStudio.state.bleed = false`);
  // Each product
  const prod = async (k, label) => { $(`[data-ps-product="${k}"]`).click(); await wait(10); return pdf(label || k); };
  o = await prod("brochure");
  check("brochure: 11 x 8.5, outside and inside, home facts and showing call to action", o.pages === 2 && Math.abs(o.w - 11) < 0.01 && o.text.includes("Home facts") && o.text.includes("See it in person"));
  o = await prod("postcard");
  check("postcard: 6 x 4, front and back, not-a-solicitation note", o.pages === 2 && Math.abs(o.w - 6) < 0.01 && Math.abs(o.h - 4) < 0.01 && /not a\s+solicitation/.test(o.text.replace(/\s+/g, " ")));
  check("postcard back shows the mailing area guide in the preview only", $(".ps-preview svg") && (() => { $('[data-ps-side="1"]').click(); return $(".ps-preview svg").textContent.includes("leave blank"); })() && !o.text.includes("leave blank"));
  E(`PrintStudio.state.size = "9x6"; PrintStudio.state.theme = "market"; renderAgent()`); o = await pdf("postcard_market");
  check("jumbo market-update postcard uses market stats", Math.abs(o.w - 9) < 0.01 && o.text.includes("Median price") && o.text.includes("Months of supply"));
  $('[data-ps-product="mailer"]').click(); await wait(10);
  E(`Object.assign(PrintStudio.state, { theme: "appreciation" }); Object.assign(PrintStudio.state.ev, { title: "Holiday party", date: "2026-12-12", start: "18:00", end: "21:00", place: "Mile High Station", rsvp: "By Dec 5" }); renderAgent()`);
  o = await pdf("mailer");
  check("event mailer: 5 x 7 with title, date, place, and RSVP", o.pages === 2 && Math.abs(o.w - 5) < 0.01 && o.text.includes("Holiday party") && o.text.includes("December 12") && o.text.includes("Mile High Station") && o.text.includes("By Dec 5"));
  o = await prod("bizcard");
  check("business card: 3.5 x 2, front and back, contact details", o.pages === 2 && Math.abs(o.w - 3.5) < 0.01 && Math.abs(o.h - 2) < 0.01 && o.text.includes("303-990-0702"));
  // Photo picking order
  $('[data-ps-product="flyer"]').click(); await wait(10);
  E(`PrintStudio.state.uploads.push({ id: "u1", kind: "data", src: "data:image/png;base64,iVBORw0KGgo=", label: "test.png" }); PrintStudio.state.picks = null; renderAgent()`);
  $('[data-ps-photo="u1"]').click(); $('[data-ps-photo="u1"]').click();
  check("clicking a photo removes it, clicking again adds it to the end", E(`PrintStudio.state.picks[PrintStudio.state.picks.length - 1]`) === "u1");
  check("off-market listing form accepts photo links", (() => { E(`openExclusiveForm()`); return !!$("#xPhotos"); })());
  E(`$("#dlgForm").close()`);
  check("no page errors", errs.length === 0); if (errs.length) console.log(errs);
  console.log(fails ? `${fails} failed` : "All print studio tests passed"); process.exit(fails ? 1 : 0);
}, 500);
