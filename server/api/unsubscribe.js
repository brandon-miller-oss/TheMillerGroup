// One-click unsubscribe from agent newsletters. GET shows a confirm button (so link scanners
// don't unsubscribe people); POST (the button, or Gmail/Yahoo one-click) records it.
const { docs, putDoc } = require("../lib/common");
const NL = require("../lib/newsletter");
const FIRM = process.env.BUSINESS_NAME || "The Miller Group";
const page = (title, msg, form = "") => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title></head><body style="font:16px/1.5 system-ui,-apple-system,Arial,sans-serif;background:#FBF8F3;color:#1E222A;margin:0"><main style="max-width:480px;margin:18vh auto;padding:0 16px;text-align:center"><h1 style="font-family:Georgia,serif">${title}</h1><p>${msg}</p>${form}</main></body></html>`;
module.exports = async function handler(req, res) {
  const t = String((req.query || {}).t || ""), who = NL.verify(t);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  if (t === "test") return res.status(200).send(page("This is a test", "Unsubscribe links work in real sends."));
  if (!who) return res.status(400).send(page("Link not recognized", "This unsubscribe link isn’t valid. Reply to the email and we’ll take you off the list."));
  if (req.method === "GET") return res.status(200).send(page("Unsubscribe?", `You’ll stop getting newsletters from this ${FIRM} agent.`, `<form method="post"><input type="hidden" name="t" value="${t.replace(/[^\w.-]/g, "")}"><button style="font:600 16px system-ui;background:#141A26;color:#fff;border:0;border-radius:24px;padding:12px 24px;cursor:pointer">Unsubscribe</button></form>`));
  if (req.method !== "POST") return res.status(405).end();
  try {
    const path = `agent/${who.uid}/crm/contacts/${who.cid}`, rows = await docs(`path=eq.${encodeURIComponent(path)}`);
    if (rows[0]) await putDoc(path, { ...rows[0].data, newsletterOptOut: true, newsletterOptOutAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    return res.status(200).send(page("You’re unsubscribed", "You won’t get these newsletters anymore. Thanks for reading."));
  } catch (e) { return res.status(502).send(page("Something went wrong", "Please try again, or reply to the email and we’ll remove you.")); }
};
