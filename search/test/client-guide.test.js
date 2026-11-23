// Client transaction guide: sharing, document summaries, client timeline, questions, agent notes.
let JSDOM; try { ({ JSDOM } = require("jsdom")); } catch (e) { ({ JSDOM } = require(require("child_process").execSync("npm root -g").toString().trim() + "/jsdom")); }
const fs = require("fs"), path = require("path"), dir = path.join(__dirname, "..");
const cfg = fs.readFileSync(path.join(dir, "..", "assets", "config.js"), "utf8");
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
  E(`agentPanel = "o-deal:dd1"; renderAgent()`);
  const txt = () => $("#v-agent").textContent;
  check("transaction view has a Client portal section, shared in the demo", /Client portal/.test(txt()) && $('[data-cg-share="dd1"]').checked);
  check("client questions show, with the flagged one marked", /Should we offer a credit/.test(txt()) && !!$(".cg-flag"));
  const copy = E(`JSON.stringify(ClientGuide._t.sharedFor("dd1", Office.deals.dd1))`);
  check("client copy leaves out commission, review, notes, and document links", !/commission|review|"url"|Spring sellers/i.test(copy) && /Inspection objection deadline/.test(copy));
  // Add a document draft without AI
  $("#cgT").value = "HOA rules"; $("#cgS").value = "Short-term rentals aren’t allowed. Two pets max."; $("#cgX").value = "Full text";
  $('[data-cg-adddoc="dd1"]').click(); await wait(20);
  check("sharing a document summary adds it to the client's copy", E(`Office.deals.dd1.clientDocs.length`) === 2 && /HOA rules/.test(E(`JSON.stringify(ClientGuide._t.sharedFor("dd1", Office.deals.dd1))`)));
  $('[data-cg-unpub="dd1|1"]').click(); await wait(20);
  check("unsharing removes it from the client's copy", !/HOA rules/.test(E(`JSON.stringify(ClientGuide._t.sharedFor("dd1", Office.deals.dd1))`)));
  $('[data-cg-ai="dd1"]').click(); await wait(20);
  check("AI summary asks for more text when the paste is short", /Paste more/.test(txt()));
  // Agent note
  const note = $('[id^="cgN_dq2"]'); note.value = "Let's talk tonight; a credit is common for an aging furnace."; $('[data-cg-note$="|dq2"]').click(); await wait(20);
  check("agent note saved on the question", /aging furnace/.test(E(`ClientGuide.demoQA.dq2.note`)));
  // Unshare then reshare
  const box = $('[data-cg-share="dd1"]'); box.checked = false; box.dispatchEvent(new w.Event("change", { bubbles: true })); await wait(20);
  check("turning sharing off removes the client's copy", !E(`ClientGuide.demoShared.dd1`) && !/Documents for/.test(txt()));
  const box2 = $('[data-cg-share="dd1"]'); box2.checked = true; box2.dispatchEvent(new w.Event("change", { bubbles: true })); await wait(20);
  check("turning it back on shares it again", !!E(`ClientGuide.demoShared.dd1`));
  // Client view
  const ch = E(`ClientGuide.clientHTML()`);
  w.document.getElementById("v-agent").insertAdjacentHTML("beforeend", `<div id="cgTest">${ch}</div>`);
  const ct = () => $("#cgTest").textContent;
  check("client sees their timeline with next date and explanations", /Your purchase|Your sale/.test(ct()) && /Next up/.test(ct()) && /in writing/.test(ct()));
  check("client sees the shared inspection summary", /furnace is 22 years old/.test(ct()));
  check("client sees the agent's note under the answer", /aging furnace/.test(ct()));
  check("disclaimer: the signed contract controls", /signed contract controls/.test(ct()));
  $('#cgTest [id^="cgQ_"]').value = "When is the appraisal deadline?";
  $("#cgTest [data-cg-ask]").click(); await wait(30);
  check("demo answer comes from the matching date", /Appraisal deadline is/.test(E(`Object.values(ClientGuide.demoQA).map(x => x.a).join(" ")`)));
  check("no script errors", errs.length === 0 || (console.log(errs), false));
  console.log(fails ? `${fails} failed` : "All client guide tests passed"); process.exit(fails ? 1 : 0);
}, 400);
