// Client updates: showing notices, changes, cancellations, request scheduling, milestones, consent, client inbox.
let JSDOM; try { ({ JSDOM } = require("jsdom")); } catch (e) { ({ JSDOM } = require(require("child_process").execSync("npm root -g").toString().trim() + "/jsdom")); }
const fs = require("fs"), path = require("path"), dir = path.join(__dirname, "..");
const cfg = fs.readFileSync(path.join(dir, "..", "assets", "config.js"), "utf8");
const html = fs.readFileSync(path.join(dir, "index.html"), "utf8")
  .replace(/<script src="https:\/\/cdn\.jsdelivr\.net[^"]*"><\/script>/, "")
  .replace(/<script src="\.\.\/assets\/config\.js(\?v=\d+)?"><\/script>/, () => `<script>${cfg}</script>`)
  .replace(/<script src="([\w.-]+\.js)(\?v=\d+)?"><\/script>/g, (m, f) => `<script>${fs.readFileSync(path.join(dir, f), "utf8")}</script>`);
const errs = [];
const dom = new JSDOM(html, { runScripts: "dangerously", url: "https://site.test/search/?embed=1#agent", beforeParse(w) {
  w.structuredClone = o => JSON.parse(JSON.stringify(o)); w.scrollTo = () => {}; w.confirm = () => true; w.prompt = (a, b) => b; w.URL.createObjectURL = () => "blob:x"; w.URL.revokeObjectURL = () => {};
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; }; w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  w.fetch = async () => ({ ok: false }); w.addEventListener("error", e => errs.push(e.message)); } });
const w = dom.window, E = js => w.eval(js), $ = s => w.document.querySelector(s), $$ = s => [...w.document.querySelectorAll(s)];
let fails = 0; const check = (n, ok) => { console.log((ok ? "PASS " : "FAIL ") + n); if (!ok) fails++; };
const wait = ms => new Promise(r => setTimeout(r, ms));
setTimeout(async () => {
  E(`agentPanel = "home"; renderAgent()`);
  check("Agent home: client updates ready to send, and the Client updates tile", $("#v-agent").textContent.includes("client update ready to send") && !!$('[data-panel="client-updates"]'));
  E(`agentPanel = "tour:dtr1"; renderAgent()`);
  check("showing day asks to send Jordan an update", $("#v-agent").textContent.includes("Send Jordan an update?") && !!$('[data-cn-sendtour="dtr1"]'));
  check("text is unavailable without consent; app and email are ready", $('[data-cn-ch="tour:dtr1|sms"]').disabled && $('[data-cn-ch="tour:dtr1|app"]').checked && $('[data-cn-ch="tour:dtr1|email"]').checked);
  $('[data-cn-toggle="tour:dtr1"]').click();
  const pre = $(".cn-pre").textContent;
  check("preview lists the homes and times", /1\. 10:00 AM · /.test(pre) && pre.includes("10:45 AM") && pre.includes("Brandon Miller"));
  check("private stop notes (lockbox) are never in the message", !/lockbox/i.test(pre));
  $('[data-cn-sendtour="dtr1"]').click(); await wait(30);
  check("sent: tour marked, nothing pending", !!E(`Store.crm.tours.dtr1.notifiedAt`) && E(`ClientNotify.count()`) === 0 && $("#v-agent").textContent.includes("was sent these details"));
  const log = JSON.parse(E(`JSON.stringify(Object.values(Store.crm.notices))`));
  check("logged with results per channel", log.length === 1 && log[0].results.app === "Sent" && /Demo/.test(log[0].results.email) && !log[0].results.sms);
  check("client app inbox got it, with a calendar file", E(`ClientNotify.demoInbox.length`) === 1 && /BEGIN:VCALENDAR[\s\S]*DTSTART;TZID=America\/Denver:\d{8}T100000/.test(E(`ClientNotify.demoInbox[0].ics`)) && (E(`ClientNotify.demoInbox[0].ics`).match(/BEGIN:VEVENT/g) || []).length === 3);
  // Change a time -> update
  E(`editTour("dtr1", t => { t.stops[1].time = "11:00"; }); renderAgent()`);
  check("changing a time asks to send an updated schedule", E(`ClientNotify.tourNeeds("dtr1")`) === "showing_updated" && $("#v-agent").textContent.includes("Updated showings"));
  $('[data-cn-skiptour="dtr1"]').click();
  check("Not now dismisses it until the next change", E(`ClientNotify.tourNeeds("dtr1")`) === null);
  E(`editTour("dtr1", t => { t.stops[2].note = "gate code 1234"; }); renderAgent()`);
  check("editing only a private note doesn't trigger an update", E(`ClientNotify.tourNeeds("dtr1")`) === null);
  // Cancel
  E(`Store.saveTour("dtr1", null); agentPanel = "client-updates"; renderAgent()`);
  check("deleting a day the client knows about offers a cancellation note", $("#v-agent").textContent.includes("canceled") && !!$('[data-cn-sendcancel="dtr1"]'));
  $('[data-cn-sendcancel="dtr1"]').click(); await wait(20);
  check("cancellation sent", E(`ClientNotify.demoInbox[0].event`) === "showing_canceled" && !$('[data-cn-sendcancel="dtr1"]'));
  // Auto mode
  $("#cnMode").value = "auto"; $("#cnMode").dispatchEvent(new w.Event("change", { bubbles: true }));
  const tid = E(`newTour("dct2"); agentPanel`).slice(5);
  E(`editTour(${JSON.stringify(tid)}, t => { t.stops = [{ listingKey: "S-1002", time: "13:00", note: "" }]; })`);
  check("automatic mode schedules the send after the last change", E("Store.settings.clientUpdates.mode") === "auto" && !!E(`ClientNotify.timers[${JSON.stringify(tid)}]`));
  E(`Store.saveSettings({ clientUpdates: { mode: "ask", reminders: true } }); clearTimeout(ClientNotify.timers[${JSON.stringify(tid)}])`);
  // Request -> scheduled showing
  E(`agentPanel = "requests"; renderAgent()`);
  const btn = $$("[data-cn-schedule]").find(b => b.dataset.cnSchedule.startsWith("demo-jordan|"));
  check("showing requests can be scheduled in one step", !!btn);
  $("#cnRqT_dr1").value = "09:15"; btn.click(); await wait(10);
  const nt = E(`agentPanel`).slice(5), T = JSON.parse(E(`JSON.stringify(Store.crm.tours[${JSON.stringify(nt)}])`));
  check("request becomes a showing for Jordan, status updated, update ready", T.contactId === "dct1" && T.stops.some(s => s.listingKey === "S-1003" && s.time === "09:15") && E(`Store.leads["demo-jordan"].requests.dr1.status`) === "showing" && $("#v-agent").textContent.includes("Send Jordan an update?"));
  // Deal milestone
  E(`agentPanel = "o-deal:dd1"; renderAgent()`);
  check("transactions offer client reminders and milestone updates", !!$('[data-cn-dealauto="dd1"]') && !!$('[data-cn-milestone="dd1"]'));
  $('[data-cn-dealauto="dd1"]').checked = true; $('[data-cn-dealauto="dd1"]').dispatchEvent(new w.Event("change", { bubbles: true }));
  check("day-before reminders turned on for the deal", E(`Office.deals.dd1.clientUpdates`) === true);
  $("#cnDlNote").value = "The inspector arrives at 9."; $('[data-cn-milestone="dd1"]').click(); await wait(20);
  check("milestone update sent with the note", E(`Object.values(Store.crm.notices).some(n => n.event === "milestone" && n.text.includes("inspector arrives at 9"))`));
  // Consent on contact
  E(`openContactForm("dct1")`); await wait(5);
  check("contact form has client update preferences and text consent", !!$("#cnSms") && !!$("#cnConsent"));
  $("#cnSms").checked = true;
  check("texts stay off without consent", E(`ClientNotify.contactValues().notify.sms`) === false);
  $("#cnConsent").checked = true;
  const nv = JSON.parse(E(`JSON.stringify(ClientNotify.contactValues().notify)`));
  check("consent records a date and source", nv.sms === true && !!nv.smsConsentAt && /agent/i.test(nv.smsConsentSource));
  E(`$("#dlgForm") && $("#dlgForm").close && $("#dlgForm").close()`);
  // Client view
  await E(`renderPortal()`); await wait(20);
  const cv = w.document.body.textContent;
  check("client sees updates with calendar, confirm, and preferences", cv.includes("Updates from Brandon") && !!$("[data-cn-ics]") && !!$('[data-cn-reply$="|confirm"]') && !!$("[data-cn-saveprefs]"));
  const rid = $('[data-cn-reply$="|confirm"]').dataset.cnReply.split("|")[0];
  $('[data-cn-reply$="|confirm"]').click(); await wait(10);
  check("client confirms; it's marked read with their reply", E(`ClientNotify.demoInbox.find(i => i.id === ${JSON.stringify(rid)}).response`) === "confirm");
  check("no page errors", errs.length === 0); if (errs.length) console.log(errs);
  console.log(fails ? `${fails} failed` : "All client update tests passed"); process.exit(fails ? 1 : 0);
}, 500);
