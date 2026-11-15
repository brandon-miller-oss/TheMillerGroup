// Text messages through Twilio, with consent and quiet-hour checks.
const SID = process.env.TWILIO_ACCOUNT_SID, TOKEN = process.env.TWILIO_AUTH_TOKEN;
const FROM = process.env.TWILIO_FROM, SERVICE = process.env.TWILIO_MESSAGING_SERVICE_SID; // one of these
const TZ = process.env.TIME_ZONE || "America/Denver";

const smsReady = () => !!(SID && TOKEN && (FROM || SERVICE));
// US numbers only: returns +1XXXXXXXXXX or "".
function e164(phone) { const d = String(phone || "").replace(/\D/g, ""); if (d.length === 10) return "+1" + d; if (d.length === 11 && d[0] === "1") return "+" + d; return ""; }
// Texts only between 8 AM and 9 PM local time (TCPA quiet hours).
function quietHours(date = new Date()) { const h = Number(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hour12: false }).format(date)) % 24; return h < 8 || h >= 21; }

async function sendSMS(to, body) {
  if (!smsReady()) throw new Error("Texting isn’t set up on the server yet.");
  const num = e164(to); if (!num) throw new Error("That mobile number doesn’t look right.");
  if (quietHours()) throw new Error("Not sent: texts only go out between 8 AM and 9 PM.");
  const form = new URLSearchParams({ To: num, Body: String(body).slice(0, 640) });
  if (SERVICE) form.set("MessagingServiceSid", SERVICE); else form.set("From", FROM);
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`, { method: "POST", headers: { Authorization: "Basic " + Buffer.from(`${SID}:${TOKEN}`).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" }, body: form });
  if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.code === 21610 ? "Not sent: this number replied STOP." : (j.message || `Text service returned ${r.status}`)); }
  return true;
}
module.exports = { sendSMS, smsReady, e164, quietHours };
