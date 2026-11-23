// Connect your website: links, buttons, embed code, and the contact form for an agent's own site.
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
setTimeout(async () => {
  E(`agentPanel = "home"; renderAgent()`);
  check("Agent home has Connect your website", !!$('[data-panel="connect"]'));
  E(`Store.site = Object.assign({}, Store.site, { slug: "" }); agentPanel = "connect"; renderAgent()`);
  check("asks for a link name first", $("#v-agent").textContent.includes("Pick your link name first") && !!$('#v-agent [data-panel="settings"]'));
  E(`Store.site = Object.assign({}, Store.site, { slug: "brandon" }); agentPanel = "connect"; renderAgent()`);
  const v = id => $("#wc_" + id).value;
  check("client login link goes to the portal with the agent's link", v("portal").endsWith("?agent=brandon#portal"));
  check("buttons open the agent's portal and search in a new tab", v("buttons").includes("Client login") && v("buttons").includes("Search homes") && v("buttons").includes('target="_blank"'));
  check("embed code frames the search with frame=1", /<iframe src="[^"]*\?agent=brandon&frame=1#search"/.test(v("embed")));
  check("contact form posts to submit_website_lead with the agent id, brokerage, and Equal Housing", v("lead").includes("/rest/v1/rpc/submit_website_lead") && v("lead").includes(`p_agent: "${E("Store.crmOwner")}"`) && v("lead").includes("Equal Housing Opportunity") && v("lead").includes("The Miller Group"));
  check("copy buttons for each block", $$("[data-wccopy]").length === 5);
  check("no script errors", errs.length === 0 || (console.log(errs), false));
  console.log(fails ? `${fails} failed` : "All Connect your website tests passed"); process.exit(fails ? 1 : 0);
}, 500);
