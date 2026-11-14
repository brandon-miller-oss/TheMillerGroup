// Road to Closed agent training: road, lessons, retries, XP/streak, Road test, team view. Run: npm i jsdom && node search/test/training.test.js
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
setTimeout(async () => {
  // Content sanity
  const bad = E(`Training._t.LESSONS.flatMap(l => l.q.filter(q => !(q[1].length >= 3 && q[2] >= 0 && q[2] < q[1].length && q[3])).map(q => l.id + ": " + q[0]))`);
  check("every question has choices, a valid answer, and an explanation", bad.length === 0); if (bad.length) console.log(bad);
  const ids = E(`Training._t.LESSONS.map(l => l.id)`);
  check("lesson ids are unique and cover all five parts", new Set(ids).size === ids.length && E(`Training._t.STAGES.length`) === 5 && ids.length >= 18);
  E(`agentPanel = "home"; renderAgent()`);
  check("Training section with the training tile on Agent home", !!$('[data-panel="training"]') && $("#v-agent").textContent.includes("Training"));
  $('[data-panel="training"]').click(); await wait(20);
  check("road shows stage signs, a locked lesson, and the Road test", $("#v-agent").textContent.includes("Financing fundamentals") && $$(".tr-stop.locked").length > 0 && $("#v-agent").textContent.includes("Road test"));
  check("second lesson is locked until the first is done", !!$('.tr-stop[disabled]') && !$('[data-tr-start="conv"]'));
  // Lesson 1, with one deliberate miss
  $('[data-tr-start="fha"]').click(); await wait(10);
  check("lesson opens with a Know this card", $("#v-agent").textContent.includes("Know this"));
  $("[data-tr-go]").click();
  const answer = (right) => { const L = E("JSON.stringify({ q: Training.L.items[Training.L.queue[0]].q })"), q = JSON.parse(L).q; const pick = right ? q[2] : (q[2] + 1) % q[1].length; $(`[data-tr-opt="${pick}"]`).click(); $("[data-tr-check]").click(); const fb = $(".tr-fb").textContent; $("[data-tr-next]").click(); return fb; };
  const fb = answer(false);
  check("a wrong answer shows the correct answer and why", fb.includes("Not quite") && fb.length > 40);
  let guard = 0; while (E("Training.view") === "lesson" && guard++ < 20) answer(true);
  check("missed question comes back, then the lesson completes", E("Training.view") === "result" && guard === 5);
  const p = E("JSON.stringify(Store.crm.training.progress)"), P = JSON.parse(p);
  check("progress saved: lesson done, XP, streak", P.done.fha && P.done.fha.best === 80 && P.xp === 4 * 10 + 20 && P.streak === 1);
  check("result screen offers the next lesson", !!$('[data-tr-start="conv"]'));
  $("[data-tr-road]").click();
  check("next lesson unlocks on the road", !!$('[data-tr-start="conv"]') && $$(".tr-stop.done").length === 1);
  // Finish the road quickly, then the Road test
  E(`(() => { const p = Training._t.prog(); Training._t.LESSONS.forEach(l => { p.done[l.id] = { best: 100, at: new Date().toISOString() }; }); Store.saveCrm("training", "progress", p); })()`);
  E(`agentPanel = "training"; renderAgent()`);
  check("Road test unlocks when every lesson is done", !!$("[data-tr-test]"));
  $("[data-tr-test]").click(); guard = 0; while (E("Training.view") === "lesson" && guard++ < 30) answer(guard > 3);
  check("Road test: 20 questions, no retries", guard === 20);
  check("85% passes and certifies", E("Store.crm.training.progress.cert && Store.crm.training.progress.cert.score") === 85 && $("#v-agent").textContent.includes("certified"));
  // Broker team view
  E(`agentPanel = "training-team"; renderAgent()`); await wait(100);
  const team = $("#v-agent").textContent; 
  check("broker sees team progress (demo agent mid-road, self certified)", team.includes("Alex Rivera") && team.includes("9/") && team.includes("Certified 85%"));
  check("no page errors", errs.length === 0); if (errs.length) console.log(errs);
  console.log(fails ? `${fails} failed` : "All training tests passed"); process.exit(fails ? 1 : 0);
}, 500);
