// Scripts and writing: starter scripts, facts sent to the AI, guardrails, saving.
let JSDOM; try { ({ JSDOM } = require("jsdom")); } catch (e) { ({ JSDOM } = require(require("child_process").execSync("npm root -g").toString().trim() + "/jsdom")); }
const fs = require("fs"), path = require("path"), dir = path.join(__dirname, "..");
const cfg = fs.readFileSync(path.join(dir, "..", "assets", "config.js"), "utf8");
const html = fs.readFileSync(path.join(dir, "index.html"), "utf8")
  .replace(/<script src="https:\/\/cdn\.jsdelivr\.net[^"]*"><\/script>/, "")
  .replace(/<script src="\.\.\/assets\/config\.js(\?v=\d+)?"><\/script>/, () => `<script>${cfg}</script>`)
  .replace(/<script src="([\w.-]+\.js)(\?v=\d+)?"><\/script>/g, (m, f) => `<script>${fs.readFileSync(path.join(dir, f), "utf8")}</script>`);
const errs = []; let lastPrompt = "";
const dom = new JSDOM(html, { runScripts: "dangerously", url: "https://site.test/search/#agent", beforeParse(w) {
  w.structuredClone = o => JSON.parse(JSON.stringify(o)); w.scrollTo = () => {}; w.confirm = () => true; w.prompt = (a, b) => b;
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; }; w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  w.addEventListener("error", e => errs.push(e.message));
} });
const fakeAI = async (p, o) => { lastPrompt = p; o.onText && o.onText({ text: "Partial" }); return { text: "Sunny Victorian cottage with high ceilings." }; };
const w = dom.window, E = js => w.eval(js), $ = s => w.document.querySelector(s), T = s => ($(s) || {}).textContent || "";
const wait = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const check = (n, ok) => { console.log((ok ? "PASS " : "FAIL ") + n); if (!ok) fails++; };
(async () => {
  await wait(400);
  E(`agentPanel = "home"; renderAgent()`);
  check("Scripts and writing tile on Agent home", !!$('[data-panel="writer"]'));
  check("14 script types available", E("Writer._t.TYPES.length") === 14);
  E(`Writer.type = "undercontract"`); check("under contract starter lists partner inspectors", E(`Writer._t.fillStarter("undercontract")`).includes("Peak Home Inspections"));

  // From a listing card: description with no AI connected falls back to a starter
  $('[data-panel="writer"]') && E(`agentPanel = "listings"; renderAgent()`);
  $('[data-wr-for^="description|listing|"]').click(); await wait(50);
  check("Write description opens the writer with the listing picked", E("agentPanel") === "writer" && E("Writer.listing") !== "");
  $("[data-wr-go]").click(); await wait(80);
  check("without AI, a filled starter script appears", $("#wrOut") && $("#wrOut").value.includes("bedrooms") && !$("#wrOut").value.includes("{address}") && T("#v-agent").includes("isn’t connected"));

  // With AI: prompt carries facts and guardrails
  // Replace the site's AI connector with a fake once the page has loaded.
  const real = w.claude.use; w.claude.use = async n => n === "sample" ? fakeAI : real(n);
  E(`Writer.out = ""`);
  $("[data-wr-go]").click(); await wait(120);
  check("AI draft lands in the editor", $("#wrOut").value === "Sunny Victorian cottage with high ceilings.");
  check("prompt includes the listing facts", lastPrompt.includes('"address"') && lastPrompt.includes("Listing description"));
  check("prompt has Fair Housing, negotiable-fee, and no-appraisal rules", lastPrompt.includes("Fair Housing") && lastPrompt.includes("negotiable") && lastPrompt.includes("appraisal"));

  // From a CMA: presentation script pulls the CMA and its client
  const cmaId = E("Object.keys(Store.crm.cmas)[0]");
  E(`agentPanel = "cma:${cmaId}"; renderAgent()`);
  $(`[data-wr-for="presentation|cma|${cmaId}"]`).click(); await wait(50);
  $("[data-wr-go]").click(); await wait(120);
  check("presentation script uses the CMA range", lastPrompt.includes('"range"') && lastPrompt.includes("Listing presentation script"));

  // Offer note keeps to terms only
  E(`Writer.type = "offer"; Writer.out = ""; renderAgent()`); $("[data-wr-go]").click(); await wait(120);
  check("offer cover note excludes personal details about buyers", lastPrompt.includes("Terms only"));

  // Save and reopen
  $("[data-wr-save]").click(); await wait(60);
  check("saved scripts list shows it", T("#v-agent").includes("My scripts") && E("Object.keys(Store.crm.scripts).length") === 1);

  // Every type renders and has a starter
  check("every type renders with a starter", E(`Writer._t.TYPES.every(t => { Writer.type = t[0]; renderAgent(); return Writer._t.fillStarter(t[0]).length > 20 && document.querySelector("#wrType"); })`));
  check("no page errors", errs.length === 0); if (errs.length) console.log(errs);
  console.log(fails ? `${fails} failed` : "All writer tests passed"); process.exit(fails ? 1 : 0);
})();
