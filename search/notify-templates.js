/* =========================================================================
   The Miller Group: client update messages (shared by the app and the
   server reminder job; server/lib/notify-templates.js is a copy).
   compose(event, data) -> { title, subject, text, sms, ics }
   Client-facing only: never includes private stop notes (lockbox codes etc.).
   ========================================================================= */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.NotifyTemplates = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const TZ = "America/Denver";
  const day = d => d ? new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }) : "";
  const dayShort = d => d ? new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric", timeZone: "UTC" }) : "";
  const time = t => { if (!/^\d{2}:\d{2}/.test(t || "")) return ""; let [h, m] = t.split(":").map(Number); const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12; return `${h}:${String(m).padStart(2, "0")} ${ap}`; };
  const first = n => String(n || "").trim().split(/\s+/)[0] || "there";
  const stopLines = stops => (stops || []).map((s, i) => `${i + 1}. ${s.time ? time(s.time) + " · " : ""}${s.address || "Address to come"}`).join("\n");
  const smsStops = stops => (stops || []).map(s => `${s.time ? time(s.time) + " " : ""}${s.address || ""}`.trim()).join("; ");
  const sign = a => `${a.name || ""}${a.business ? `\n${a.business}` : ""}\n${a.byline || a.firm || "The Miller Group"}${a.phone ? `\n${a.phone}` : ""}`;
  const fit = (s, n) => s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…";
  const smsEnd = " Reply STOP to opt out.";
  const smsFrom = a => `${a.business || a.name || "The Miller Group"}: `;

  // Calendar file with one event per showing (30 minutes each), or an all-day event if no times are set.
  function ics(data) {
    const stops = (data.stops || []).filter(s => s.address), date = String(data.date || "").replace(/-/g, "");
    if (!date || !stops.length) return "";
    const esc = s => String(s || "").replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\r?\n/g, "\\n");
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
    const add30 = t => { let [h, m] = t.split(":").map(Number); m += 30; if (m >= 60) { h += 1; m -= 60; } return `${String(h).padStart(2, "0")}${String(m).padStart(2, "0")}00`; };
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//The Miller Group//Showings//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
    const timed = stops.filter(s => /^\d{2}:\d{2}/.test(s.time || ""));
    if (timed.length) timed.forEach((s, i) => lines.push("BEGIN:VEVENT", `UID:${data.id || "tour"}-${i}-${date}@themillergroup`, `DTSTAMP:${stamp}`, `DTSTART;TZID=${TZ}:${date}T${s.time.replace(":", "")}00`, `DTEND;TZID=${TZ}:${date}T${add30(s.time)}`, `SUMMARY:${esc("Showing: " + s.address)}`, `LOCATION:${esc(s.address)}`, `DESCRIPTION:${esc(`With ${data.agent && data.agent.name || "your agent"}${data.agent && data.agent.phone ? ", " + data.agent.phone : ""}`)}`, "END:VEVENT"));
    else lines.push("BEGIN:VEVENT", `UID:${data.id || "tour"}-${date}@themillergroup`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${date}`, `SUMMARY:${esc(`Showings (${stops.length} homes)`)}`, `DESCRIPTION:${esc(stopLines(stops))}`, "END:VEVENT");
    lines.push("END:VCALENDAR");
    return lines.join("\r\n");
  }

  const EVENTS = {
    showing_scheduled: d => ({ title: `Showings set for ${day(d.date)}`,
      subject: `Your showings: ${day(d.date)}`,
      text: `Hi ${first(d.client)},\n\nYou’re all set to see ${d.stops.length} ${d.stops.length === 1 ? "home" : "homes"} on ${day(d.date)}:\n\n${stopLines(d.stops)}\n\n${d.meet || "I’ll meet you at the first home."} The attached calendar file adds each showing to your calendar.\n\nNeed a different time? Just reply.\n\n${sign(d.agent)}`,
      sms: fit(`${smsFrom(d.agent)}Showings set for ${dayShort(d.date)}: ${smsStops(d.stops)}. Details by email.`, 300) + smsEnd, ics: ics(d) }),
    showing_updated: d => ({ title: `Updated showings for ${day(d.date)}`,
      subject: `Updated: your showings ${day(d.date)}`,
      text: `Hi ${first(d.client)},\n\nQuick update to your showings. Here’s the latest plan for ${day(d.date)}:\n\n${stopLines(d.stops)}\n\nThe attached calendar file has the new times.\n\n${sign(d.agent)}`,
      sms: fit(`${smsFrom(d.agent)}Updated showings ${dayShort(d.date)}: ${smsStops(d.stops)}.`, 300) + smsEnd, ics: ics(d) }),
    showing_canceled: d => ({ title: `Showings on ${day(d.date)} canceled`,
      subject: `Canceled: showings on ${day(d.date)}`,
      text: `Hi ${first(d.client)},\n\nThe showings planned for ${day(d.date)} are canceled. I’ll be in touch to set up a new time.\n\n${sign(d.agent)}`,
      sms: fit(`${smsFrom(d.agent)}Showings on ${dayShort(d.date)} are canceled. I’ll reach out to reschedule.`, 300) + smsEnd }),
    showing_reminder: d => ({ title: `Reminder: showings tomorrow`,
      subject: `Tomorrow: your showings`,
      text: `Hi ${first(d.client)},\n\nA reminder that we’re seeing ${d.stops.length} ${d.stops.length === 1 ? "home" : "homes"} tomorrow, ${day(d.date)}:\n\n${stopLines(d.stops)}\n\nSee you then! Reply if anything changes.\n\n${sign(d.agent)}`,
      sms: fit(`${smsFrom(d.agent)}Reminder, showings tomorrow: ${smsStops(d.stops)}.`, 300) + smsEnd, ics: ics(d) }),
    milestone: d => ({ title: `${d.label}: ${day(d.date)}`,
      subject: `${d.address}: ${d.label} ${d.soon ? "is tomorrow" : "on " + day(d.date)}`,
      text: `Hi ${first(d.client)},\n\nA quick update on ${d.address}: the ${String(d.label || "").toLowerCase()} is ${d.soon ? "tomorrow, " : ""}${day(d.date)}.${d.note ? `\n\n${d.note}` : ""}\n\nQuestions? Just reply.\n\n${sign(d.agent)}`,
      sms: fit(`${smsFrom(d.agent)}${d.address}: ${d.label} ${d.soon ? "tomorrow" : dayShort(d.date)}.${d.note ? " " + d.note : ""}`, 300) + smsEnd }),
    custom: d => ({ title: d.subject || "An update from your agent", subject: d.subject || "An update from your agent",
      text: `Hi ${first(d.client)},\n\n${d.message || ""}\n\n${sign(d.agent)}`, sms: fit(`${smsFrom(d.agent)}${d.message || ""}`, 300) + smsEnd })
  };
  // Spanish versions (data.lang === "es").
  const dayEs = d => d ? new Date(d + "T12:00:00").toLocaleDateString("es-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }) : "";
  const dayShortEs = d => d ? new Date(d + "T12:00:00").toLocaleDateString("es-US", { weekday: "short", month: "numeric", day: "numeric", timeZone: "UTC" }) : "";
  const firstEs = n => String(n || "").trim().split(/\s+/)[0] || "";
  const hola = n => firstEs(n) ? `Hola ${firstEs(n)},` : "Hola,";
  const casas = n => `${n} ${n === 1 ? "casa" : "casas"}`;
  const smsEndEs = " Responda STOP para cancelar.";
  const LABEL_ES = { "Inspection objection deadline": "fecha límite para objeciones de inspección", "Appraisal deadline": "fecha límite del avalúo", "Loan terms deadline": "fecha límite de los términos del préstamo", "Closing date": "fecha de cierre", "Possession date": "fecha de entrega de la casa" };
  const lab = l => LABEL_ES[l] || l;
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const EVENTS_ES = {
    showing_scheduled: d => ({ title: `Visitas programadas para el ${dayEs(d.date)}`, subject: `Sus visitas: ${dayEs(d.date)}`,
      text: `${hola(d.client)}\n\nTodo está listo para ver ${casas(d.stops.length)} el ${dayEs(d.date)}:\n\n${stopLines(d.stops)}\n\n${d.meet || "Nos vemos en la primera casa."} El archivo de calendario adjunto agrega cada visita a su calendario.\n\n¿Necesita otro horario? Solo responda.\n\n${sign(d.agent)}`,
      sms: fit(`${smsFrom(d.agent)}Visitas el ${dayShortEs(d.date)}: ${smsStops(d.stops)}. Detalles por correo.`, 300) + smsEndEs, ics: ics(d) }),
    showing_updated: d => ({ title: `Cambio en sus visitas del ${dayEs(d.date)}`, subject: `Actualización: sus visitas del ${dayEs(d.date)}`,
      text: `${hola(d.client)}\n\nHay un cambio en sus visitas. Este es el plan actualizado para el ${dayEs(d.date)}:\n\n${stopLines(d.stops)}\n\nEl archivo de calendario adjunto tiene los nuevos horarios.\n\n${sign(d.agent)}`,
      sms: fit(`${smsFrom(d.agent)}Cambio en sus visitas del ${dayShortEs(d.date)}: ${smsStops(d.stops)}.`, 300) + smsEndEs, ics: ics(d) }),
    showing_canceled: d => ({ title: `Visitas del ${dayEs(d.date)} canceladas`, subject: `Canceladas: visitas del ${dayEs(d.date)}`,
      text: `${hola(d.client)}\n\nLas visitas planeadas para el ${dayEs(d.date)} quedan canceladas. Me comunicaré con usted para programar otro horario.\n\n${sign(d.agent)}`,
      sms: fit(`${smsFrom(d.agent)}Las visitas del ${dayShortEs(d.date)} quedan canceladas. Le escribo para reprogramar.`, 300) + smsEndEs }),
    showing_reminder: d => ({ title: "Recordatorio: visitas mañana", subject: "Mañana: sus visitas",
      text: `${hola(d.client)}\n\nLe recuerdo que mañana, ${dayEs(d.date)}, vamos a ver ${casas(d.stops.length)}:\n\n${stopLines(d.stops)}\n\n¡Nos vemos! Responda si algo cambia.\n\n${sign(d.agent)}`,
      sms: fit(`${smsFrom(d.agent)}Recordatorio, visitas mañana: ${smsStops(d.stops)}.`, 300) + smsEndEs, ics: ics(d) }),
    milestone: d => ({ title: `${cap(lab(d.label))}: ${dayEs(d.date)}`, subject: `${d.address}: ${lab(d.label)} ${d.soon ? "es mañana" : "el " + dayEs(d.date)}`,
      text: `${hola(d.client)}\n\nUna actualización sobre ${d.address}: la ${lab(d.label)} es ${d.soon ? "mañana, " : "el "}${dayEs(d.date)}.${d.note ? `\n\n${d.note}` : ""}\n\n¿Preguntas? Solo responda.\n\n${sign(d.agent)}`,
      sms: fit(`${smsFrom(d.agent)}${d.address}: ${lab(d.label)} ${d.soon ? "mañana" : dayShortEs(d.date)}.${d.note ? " " + d.note : ""}`, 300) + smsEndEs }),
    custom: d => ({ title: d.subject || "Novedades de su agente", subject: d.subject || "Novedades de su agente",
      text: `${hola(d.client)}\n\n${d.message || ""}\n\n${sign(d.agent)}`, sms: fit(`${smsFrom(d.agent)}${d.message || ""}`, 300) + smsEndEs })
  };
  // Dates on a transaction that clients care about.
  const CLIENT_DATES = ["Inspection objection deadline", "Appraisal deadline", "Loan terms deadline", "Closing date", "Possession date"];
  function compose(event, data) { const f = ((data || {}).lang === "es" ? EVENTS_ES : EVENTS)[event]; if (!f) throw new Error("Unknown update type"); return { event, lang: (data || {}).lang === "es" ? "es" : "en", ...f({ stops: [], agent: {}, ...data }) }; }
  return { compose, ics, EVENTS: Object.keys(EVENTS), CLIENT_DATES, day, time };
});
