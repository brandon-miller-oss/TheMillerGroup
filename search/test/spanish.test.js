// Spanish: switch, search, listing, costs, shortlists, transaction guide, homeowner portal, client updates. Agent side stays English.
let JSDOM; try { ({ JSDOM } = require("jsdom")); } catch (e) { ({ JSDOM } = require(require("child_process").execSync("npm root -g").toString().trim() + "/jsdom")); }
const fs = require("fs"), path = require("path"), dir = path.join(__dirname, "..");
const cfg = fs.readFileSync(path.join(dir, "..", "assets", "config.js"), "utf8");
const html = fs.readFileSync(path.join(dir, "index.html"), "utf8")
  .replace(/<script src="https:\/\/cdn\.jsdelivr\.net[^"]*"><\/script>/, "")
  .replace(/<script src="\.\.\/assets\/config\.js(\?v=\d+)?"><\/script>/, () => `<script>${cfg}</script>`)
  .replace(/<script src="([\w.-]+\.js)(\?v=\d+)?"><\/script>/g, (m, f) => `<script>${fs.readFileSync(path.join(dir, f), "utf8")}</script>`);
const errs = [];
const dom = new JSDOM(html, { runScripts: "dangerously", url: "https://site.test/search/?lang=es", beforeParse(w) {
  w.structuredClone = o => JSON.parse(JSON.stringify(o)); w.scrollTo = () => {}; w.confirm = () => true; w.prompt = (a, b) => b;
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; }; w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  w.fetch = async () => ({ ok: false }); w.addEventListener("error", e => errs.push(e.message)); } });
const w = dom.window, E = js => w.eval(js), $ = s => w.document.querySelector(s), $$ = s => [...w.document.querySelectorAll(s)];
let fails = 0; const check = (n, ok) => { console.log((ok ? "PASS " : "FAIL ") + n); if (!ok) fails++; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const leftovers = root => { const out = new Set(); const tw = w.document.createTreeWalker(root, 4); let n; while ((n = tw.nextNode())) { const t = n.nodeValue.trim(); if (/\b(the|your|and|with|to|of|for|homes?|Save|Request)\b/.test(t) && !n.parentElement.closest(".remarks,#disclaimer,style,script,[data-i18n-skip],.courtesy") && !/^[\d$]/.test(t)) out.add(t); } return [...out]; };
setTimeout(async () => {
  check("Spanish chosen from ?lang=es; page lang set", E(`I18N.lang`) === "es" && w.document.documentElement.lang === "es");
  check("header switch offers English", $("#langBtn") && $("#langBtn").textContent === "English");
  E(`Store.isAgent = false`); E(`location.hash = "#search"`); await wait(300);
  const st = $("#v-search").textContent;
  check("search results in Spanish (recámaras, pies², Abrir)", /rec · \d+ baños? · [\d,]+ pies²/.test(st) && /casas/.test(st) && /Aprox\. \$[\d,]+\/mes en total/.test(st));
  check("search filters in Spanish", /Cualquier precio/.test($("header").textContent) && $("#q").placeholder === "Vecindario, ciudad o dirección");
  check("open house dates in Spanish", !/Open house/.test(st));
  E(`openListing("S-1007")`); await wait(200);
  const lt = $("#dlgListing").textContent;
  check("listing detail in Spanish: costs, checks, form", /Lo que realmente cuesta/.test(lt) && /Capital e intereses/.test(lt) && /Qué revisar antes de comprar/.test(lt) && /Pintura con plomo/.test(lt) && /Pedir una visita/.test(lt) && /Construida en 1962/.test(lt));
  check("the MLS description stays as written", /Mid-century high-rise unit/.test(lt));
  check("lead message prefilled in Spanish", /^Me gustaría ver/.test($("#lMsg").value));
  console.log("  listing leftovers:", JSON.stringify(leftovers($("#dlgListing"))));
  console.log("  search leftovers:", JSON.stringify(leftovers($("#v-search")).slice(0, 8)));
  E(`$("#dlgListing").close()`);
  E(`location.hash = "#collections"`); await wait(300);
  const ct = $("#v-collections").textContent;
  check("client portal sections in Spanish", /Su casa: 1440 N Gaylord/.test(ct) && /Plusvalía/.test(ct) && /Este mes/.test(ct) && /Su venta: 2210 S Fillmore/.test(ct) && /Lo que sigue/.test(ct));
  check("timeline explanations in Spanish", /Fecha límite para objeciones de inspección/.test(ct));
  check("client updates in Spanish, consent text included", /Novedades de/.test(ct) && /Al activar los mensajes de texto/.test(ct));
  console.log("  shortlist-tab leftovers:", JSON.stringify(leftovers($("#v-collections")).slice(0, 12)));
  // Spanish question in demo
  const q = $('#v-collections [id^="cgQ_"]'); if (q) { q.value = "¿Cuándo es el avalúo?"; $("#v-collections [data-cg-ask]").click(); await wait(50); }
  check("demo guide answers in Spanish", /Fecha límite del avalúo/.test(E(`Object.values(ClientGuide.demoQA).map(x => x.a).join(" ")`)));
  // Agent side stays English
  E(`Store.isAgent = true; location.hash = "#agent"; agentPanel = "homeowners"; renderAgent()`); await wait(200);
  check("agent workspace stays in English", /Homeowner portals/.test($("#v-agent").textContent) && !/Recámaras/.test($("#v-agent").textContent));
  check("no script errors", errs.length === 0 || (console.log(errs), false));
  console.log(fails ? `${fails} failed` : "All Spanish tests passed"); process.exit(fails ? 1 : 0);
}, 500);
