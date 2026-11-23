// Websites and landing pages builder, renderer, and the AI marketing assistant.
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
const fire = (el, type) => el.dispatchEvent(new w.Event(type, { bubbles: true }));
setTimeout(async () => {
  E(`agentPanel = "home"; renderAgent()`);
  check("Agent home has Websites and landing pages and the AI marketing assistant", !!$('[data-panel="sites"]') && !!$('[data-panel="ai-marketing"]'));
  E(`agentPanel = "sites"; renderAgent()`);
  check("demo has a live website and a draft landing page; 10 templates", $("#v-agent").textContent.includes("Live") && $("#v-agent").textContent.includes("Draft") && $$("[data-sb-new]").length === 10);
  // New listing landing page from a template
  $('[data-sb-new="listing"]').click(); await wait(10);
  const id = E("SiteBuilder.edit"), pg = () => JSON.parse(E(`JSON.stringify(SiteBuilder.pages["${id}"])`));
  let P = pg();
  check("listing spotlight fills itself: hero, featured home, form, SEO", P.sections.map(s => s.type).join(",").startsWith("hero,featured") && P.sections.some(s => s.type === "form") && !!P.sections.find(s => s.type === "featured").home && P.seo.title.length > 10 && P.seo.description.length > 40);
  const srcdoc = () => $(".sb-frame").getAttribute("srcdoc");
  check("preview shows brokerage, Equal Housing, consent line, and structured data", /The Miller Group/.test(srcdoc()) && srcdoc().includes("Equal Housing Opportunity") && srcdoc().includes("Consent isn’t a condition") && srcdoc().includes("application/ld+json"));
  // Edit a field
  const hl = $('[data-sb-f="0|headline"]'); hl.value = "Mid-century gem near the park"; fire(hl, "input");
  check("editing a field saves to the page", pg().sections[0].headline === "Mid-century gem near the park");
  // Section tools
  const n0 = pg().sections.length;
  $('[data-sb-copy="0"]').click(); check("duplicate a section", pg().sections.length === n0 + 1);
  $('[data-sb-rm="1"]').click(); check("delete a section", pg().sections.length === n0);
  $('[data-sb-mv="1|-1"]').click(); check("move a section up", pg().sections[0].type === "featured");
  $('[data-sb-mv="0|1"]').click();
  $('[data-sb-hide="1"]').click(); check("hide a section (and it leaves the preview)", pg().sections[1].hidden === true && !srcdoc().includes('id="home"'));
  $('[data-sb-hide="1"]').click();
  E(`document.getElementById("sbAdd").value = "faq"`); $("[data-sb-add]").click();
  check("add an FAQ section (before the form)", pg().sections.some(s => s.type === "faq") && pg().sections[pg().sections.length - 1].type === "form");
  // SEO tab
  $('[data-sb-tab="seo"]').click();
  check("SEO tab: score, checklist, and search preview", !!$(".sb-score") && $$(".sb-checks li").length === 11 && !!$(".sb-serp"));
  // AI rewrite with a fake model; images and listings must not change
  E(`window.claude = { use: async n => n === "sample" ? { json: async p => ({ title: "Gilpin Street spotlight", seo: { keyword: "Washington Park home", title: "Washington Park home for sale | Brandon Miller", description: "x".repeat(140) }, sections: SiteBuilder.pages[SiteBuilder.edit].sections.map(s => ({ id: s.id, headline: "AI headline", heading: "AI heading", image: "https://evil.example/x.jpg", body: "AI body", items: [{ q: "Q?", a: "A." }] })) }) } : null }`);
  $('[data-sb-tab="content"]').click(); $("[data-sb-ai]").click(); await wait(30);
  P = pg();
  check("AI rewrites the copy and SEO", P.sections[0].headline === "AI headline" && P.seo.keyword === "Washington Park home" && P.title === "Gilpin Street spotlight");
  check("AI can't change photos or listing data", !JSON.stringify(P).includes("evil.example") && !!P.sections.find(s => s.type === "featured").home.address);
  // Publish
  $("[data-sb-pub]").click(); check("publish", pg().published === true);
  // Renderer safety
  const R = w.SiteRender;
  const safe = R.render({ sections: [{ type: "hero", headline: "<script>alert(1)</script>", image: "javascript:alert(1)" }], seo: {} }, { agent: { name: "A", display: "The Miller Group", byline: "", firm: "The Miller Group" }, firm: "The Miller Group", preview: true });
  check("renderer escapes text and drops unsafe image links", !safe.includes("<script>alert(1)") && !safe.includes("javascript:alert"));
  const alex = E(`JSON.stringify(AgentBrand.current("demo-agent"))`);
  const ah = R.render({ sections: [{ type: "hero", headline: "Hi" }], seo: {} }, { agent: JSON.parse(alex), firm: "The Miller Group", preview: true });
  check("an approved agent brand leads the page with Brokered by The Miller Group", ah.includes("Alex Rivera Homes") && ah.includes("Brokered by The Miller Group"));
  const team = { name: "Alex", brand: { name: "Alex Rivera Homes", primary: "#18302E", accent: "#C99B52" } };
  check("public pages only show a brand the broker approved", R.agentContext("x", team, null).display === "The Miller Group" && R.agentContext("x", team, { approved: true, sig: R.brandSig(team.brand) }).display === "Alex Rivera Homes" && R.brandSig(team.brand) === E(`AgentBrand.sig(${JSON.stringify(team.brand)})`));
  // AI marketing assistant (templates, no AI)
  E(`window.claude = undefined; agentPanel = "ai-marketing"; renderAgent()`);
  check("assistant has six tools", $$("[data-ma-tool]").length === 6);
  const key = E(`marketingPool()[0].key`); E(`MarketingAI.key = ${JSON.stringify(key)}; renderAgent()`);
  $("[data-ma-go]").click(); await wait(30);
  const D = JSON.parse(E("JSON.stringify(MarketingAI.out.data)"));
  check("listing launch: all 17 pieces", Object.keys(D).length === 17 && D.remarks.length <= 1000 && D.sms.length <= 160 && D.metaPrimary.length <= 125 && D.metaHeadline.length <= 40 && D.gHeadlines.split("\n").every(x => x.length <= 30));
  check("each piece has a copy button and character count", $$("[data-ma-copy]").length === 17 && $("#v-agent").textContent.includes("/1000"));
  $("[data-ma-page]").click(); await wait(10);
  check("campaign builds a listing landing page in one tap", E("agentPanel") === "sites" && E(`SiteBuilder.pages[SiteBuilder.edit].template`) === "listing");
  E(`agentPanel = "ai-marketing"; MarketingAI.tool = "social"; renderAgent()`); $("[data-ma-go]").click(); await wait(20);
  check("social calendar with captions and hashtags", E("MarketingAI.out.data.rows.length") >= 6 && E("MarketingAI.out.data.rows[0].hashtags").includes("#") && !!$("[data-ma-csv]"));
  E(`MarketingAI.tool = "ads"; MarketingAI.opts.goal = "seller"; renderAgent()`); $("[data-ma-go]").click(); await wait(20);
  check("ads include the Meta housing category note", E("MarketingAI.out.data.setup").includes("Housing") && E("MarketingAI.out.data.v1Primary.length") <= 125);
  E(`MarketingAI.tool = "blog"; MarketingAI.opts.topic = "Living in Highland"; renderAgent()`); $("[data-ma-go]").click(); await wait(20);
  $("[data-ma-blogpage]").click(); await wait(10);
  check("blog article becomes a website page with SEO", E(`SiteBuilder.pages[SiteBuilder.edit].kind`) === "website" && E(`SiteBuilder.pages[SiteBuilder.edit].sections.filter(s => s.type === "text").length`) >= 3 && E("SiteBuilder.tab") === "seo");
  // Fair Housing check
  const fl = E(`JSON.stringify(MarketingAI.fhCheck("Perfect for families! Good schools, a safe neighborhood, and a master bedroom. White cabinets and a sunny yard."))`);
  const F = JSON.parse(fl).map(x => x.word);
  check("Fair Housing check flags risky words", F.includes("perfect for families") && F.includes("good schools") && F.includes("safe neighborhood") && F.includes("master bedroom"));
  check("and leaves normal descriptions alone", !F.some(x => /white|sunny/.test(x)));
  // AI path for the assistant
  E(`window.claude = { use: async n => n === "sample" ? { json: async p => ({ subject: "Denver market: November", preview: "p", body: "Great for families.", sms: "Hi" }) } : null }; MarketingAI.tool = "email"; agentPanel = "ai-marketing"; renderAgent()`);
  $("[data-ma-go]").click(); await wait(30);
  check("AI copy is used, and flagged when it slips", E("MarketingAI.out.ai") === true && $("#v-agent").textContent.includes("“great for families”"));
  check("no page errors", errs.length === 0); if (errs.length) console.log(errs);
  console.log(fails ? `${fails} failed` : "All website and marketing AI tests passed"); process.exit(fails ? 1 : 0);
}, 500);
