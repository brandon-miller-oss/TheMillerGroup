// The Miller Group — monthly homeowner reminder emails (run by api/daily.js on the 1st).
// Each homeowner portal with reminders on gets that month's Colorado home care checklist,
// plus property tax dates and, in odd years, the protest window. Signed one-click unsubscribe.
const { docs, sendBatch, fromLine, EMAIL_RE } = require("../lib/common");
const NL = require("../lib/newsletter");
const HC = require("../lib/home-care");
const ADDRESS = process.env.BUSINESS_ADDRESS || "";
const FIRM = process.env.BUSINESS_NAME || "The Miller Group";

async function run(today) {
  const out = { sent: 0, skipped: 0, errors: [] };
  if (!ADDRESS) { out.errors.push("BUSINESS_ADDRESS isn’t set, so no reminders went out."); return out; }
  const rows = await docs(`path=like.${encodeURIComponent("boards/*/home/*")}`);
  const msgs = [];
  for (const r of rows) {
    const h = r.data || {}, [, uid, , id] = r.path.split("/");
    if (!h.remind || !EMAIL_RE.test(h.email || "") || h.lastReminder === today.slice(0, 7)) { out.skipped++; continue; }
    const lang = h.lang === "es" ? "es" : "en", body = HC.monthlyText(h, today, lang);
    if (!body.count) { out.skipped++; continue; }
    const unsub = NL.unsubUrl(uid, "home~" + id), a = h.agent || {};
    const foot = lang === "es"
      ? `\n\n—\n${a.name || ""}${a.phone ? " · " + a.phone : ""}\n${FIRM} · ${ADDRESS}\nRecibe este correo porque activó los recordatorios en su portal de propietario. Cancelar: ${unsub}`
      : `\n\n—\n${a.name || ""}${a.phone ? " · " + a.phone : ""}\n${FIRM} · ${ADDRESS}\nYou’re getting this because reminders are on in your homeowner portal. Unsubscribe: ${unsub}`;
    msgs.push({ path: r.path, data: h, msg: { from: fromLine(a.name || FIRM), to: [h.email], subject: body.subject, text: body.text + foot, ...(EMAIL_RE.test(a.email || "") ? { reply_to: a.email } : {}),
      headers: { "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } } });
  }
  const { putDoc } = require("../lib/common");
  for (let i = 0; i < msgs.length; i += 100) {
    const chunk = msgs.slice(i, i + 100);
    try {
      await sendBatch(chunk.map(x => x.msg)); out.sent += chunk.length;
      for (const x of chunk) await putDoc(x.path, { ...x.data, lastReminder: today.slice(0, 7) });
    } catch (e) { out.errors.push(e.message); }
  }
  return out;
}
module.exports = { run };
