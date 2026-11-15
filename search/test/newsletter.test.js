// Agent newsletters: issue assembly, audience, preview, sending rules, News desk.
let JSDOM; try { ({ JSDOM } = require("jsdom")); } catch (e) { ({ JSDOM } = require(require("child_process").execSync("npm root -g").toString().trim() + "/jsdom")); }
const fs = require("fs"), path = require("path"), dir = path.join(__dirname, "..");
const cfg = fs.readFileSync(path.join(dir, "..", "assets", "config.js"), "utf8");
const html = fs.readFileSync(path.join(dir, "index.html"), "utf8")
  .replace(/<script src="https:\/\/cdn\.jsdelivr\.net[^"]*"><\/script>/, "")
  .replace(/<script src="\.\.\/assets\/config\.js(\?v=\d+)?"><\/script>/, () => `<script>${cfg}</script>`)
  .replace(/<script src="([\w.-]+\.js)(\?v=\d+)?"><\/script>/g, (m, f) => `<script>${fs.readFileSync(path.join(dir, f), "utf8")}</script>`);
const errs = [];
const dom = new JSDOM(html, { runScripts: "dangerously", url: "https://site.test/search/#agent", beforeParse(w) {
  w.structuredClone = o => JSON.parse(JSON.stringify(o)); w.scrollTo = () => {}; w.confirm = () => true; w.prompt = (a, b) => b;
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; }; w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  w.fetch = async () => ({ ok: false }); w.addEventListener("error", e => errs.push(e.message)); } });
const w = dom.window, E = js => w.eval(js), $ = s => w.document.querySelector(s), $$ = s => [...w.document.querySelectorAll(s)];
let fails = 0; const check = (n, ok) => { console.log((ok ? "PASS " : "FAIL ") + n); if (!ok) fails++; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const ch = (el, v) => { if (typeof v === "boolean") el.checked = v; else el.value = v; el.dispatchEvent(new w.Event("change", { bubbles: true })); };
setTimeout(async () => {
  E(`agentPanel = "home"; renderAgent()`);
  check("Newsletters tile on Agent home", !!$('[data-panel="newsletters"]'));
  E(`agentPanel = "newsletters"; renderAgent()`);
  const D = JSON.parse(E(`JSON.stringify(Newsletter._t.cur())`));
  check("issue assembles market numbers, approved news only, my listings, and open houses", !!D.market && D.news.length === 3 && D.news.every(n => !/transit/.test(n.title)) && D.listings.some(h => /Gilpin/.test(h.address)) && D.openHouses.length === 1);
  const src = () => $(".sb-frame").getAttribute("srcdoc");
  check("preview: brokerage line, Equal Housing, unsubscribe, address placeholder", src().includes("The Miller Group") && src().includes("Equal Housing Opportunity") && src().includes("Unsubscribe") && src().includes("Mailing address goes here"));
  check("preview personalizes the greeting", src().includes("Hi Jordan,"));
  const n0 = E(`Newsletter.audience(Newsletter._t.cur() && (Store.settings.newsletter || { audience: { all: true } }).audience || { all: true }).length`);
  check("audience counts contacts with email, leaving out do-not-contact", n0 > 0 && E(`Object.values(Store.crm.contacts).filter(c => c.email && !c.doNotContact).length`) >= n0);
  // Uncheck a news story
  ch($('[data-nl-item="news|0"]'), false);
  check("unchecking a story removes it from the email", E(`Newsletter._t.cur().news.length`) === 2);
  // Edit subject
  const sub = $("#nlSub"); sub.value = "Your November Colorado update"; sub.dispatchEvent(new w.Event("input", { bubbles: true }));
  check("subject is editable", E(`Newsletter._t.cur().subject`) === "Your November Colorado update");
  // Send without a mailing address
  $("[data-nl-send]").click(); await wait(10);
  check("won't send without the brokerage mailing address (CAN-SPAM)", /mailing address/.test($("#v-agent").textContent));
  // Schedule tab
  $('[data-nl-tab="schedule"]').click();
  ch($('[data-nl-s="auto"]'), true); ch($('[data-nl-s="frequency"]'), "monthly"); ch($('[data-nl-s="address"]'), "123 Main St, Denver, CO 80202");
  check("schedule saved: automatic, monthly, with address", E(`Store.settings.newsletter.auto`) === true && E(`Store.settings.newsletter.frequency`) === "monthly" && E(`Store.settings.newsletter.address`).includes("Main"));
  check("status shows the next issue", /Next issue/.test($("#v-agent").textContent));
  ch($('[data-nl-aud="all"]'), false);
  const anyFolder = $("[data-nl-folder]"); if (anyFolder) ch(anyFolder, true); else ch($('[data-nl-role="buyer"]'), true);
  check("audience can be narrowed to folders or roles", E(`Store.settings.newsletter.audience.all`) === false && E(`Newsletter.audience(Store.settings.newsletter.audience).length`) <= n0);
  ch($('[data-nl-aud="all"]'), true);
  $("[data-nl-evadd]").click(); ch($('[data-nl-ev="0|title"]'), "Client appreciation party"); ch($('[data-nl-ev="0|url"]'), "javascript:alert(1)");
  check("events can be added; unsafe links are dropped", E(`Store.settings.newsletter.events[0].title`) === "Client appreciation party" && E(`Store.settings.newsletter.events[0].url`) === "");
  // Send (demo)
  $('[data-nl-tab="issue"]').click(); $("[data-nl-send]").click(); await wait(20);
  check("demo send logs the issue without emailing anyone", /Demo/.test($("#v-agent").textContent) && E(`Object.values(Store.crm.newsletters).some(x => x.status === "sent" && x.demo && !("_all" in x))`));
  // AI
  E(`window.claude = { use: async n => n === "sample" ? { json: async p => ({ subject: "Denver update: more homes to choose from", preheader: "p", intro: "Hope your week is going well. Here’s the latest.", marketNote: "Buyers have more choices." }) } : null }`);
  $("[data-nl-ai]").click(); await wait(30);
  check("AI writes subject and note, keeping the greeting token", E(`Newsletter._t.cur().subject`).startsWith("Denver update") && E(`Newsletter._t.cur().intro`).startsWith("Hi {{first_name}},"));
  // News desk
  $('[data-nl-tab="news"]').click();
  check("broker sees the News desk with suggested stories", /Suggested/.test($("#v-agent").textContent) && !!$('[data-nw-st$="|approved"]'));
  $('[data-nw-st$="|approved"]').click();
  check("approving a suggestion makes it available to newsletters", E(`Object.values(Office.news).filter(x => x.status === "approved").length`) === 4);
  $("[data-nw-add]").click(); check("adding a story needs a headline, https link, and summary", /https link/.test($("#v-agent").textContent));
  w.document.getElementById("nwT").value = "Aurora approves new trail"; w.document.getElementById("nwU").value = "https://example.com/a"; w.document.getElementById("nwM").value = "A short summary."; $("[data-nw-add]").click();
  check("manual story added as approved", E(`Object.values(Office.news).some(x => x.title === "Aurora approves new trail" && x.status === "approved")`));
  // Renderer safety
  const R = w.NewsletterRender;
  const out = R.render({ intro: "Hi {{first_name}},", news: [{ title: "<script>x</script>", url: "javascript:alert(1)", summary: "s" }, { title: "Ok <b>", url: "https://example.com", summary: "s" }], agent: { name: "A" } });
  check("renderer escapes text and drops non-https links", !out.html.includes("<script>x") && !out.html.includes("javascript:") && out.html.includes("Ok &lt;b&gt;"));
  check("first names are escaped in HTML", R.personalize("Hi {{first_name}}", { first_name: "<img>" }, true) === "Hi &lt;img&gt;");
  check("plain-text version included", out.text.includes("Unsubscribe: {{unsubscribe_url}}"));
  check("no page errors", errs.length === 0); if (errs.length) console.log(errs);
  console.log(fails ? `${fails} failed` : "All newsletter tests passed"); process.exit(fails ? 1 : 0);
}, 500);
