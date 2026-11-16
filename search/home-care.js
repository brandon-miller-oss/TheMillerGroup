/* =========================================================================
   The Miller Group: homeowner portal rules (shared by the app and the
   monthly reminder email; server/lib/home-care.js is a copy).
   - tasks(home, month): Colorado Front Range home care for that month
   - taxNotes(today): property tax due dates and the odd-year protest window
   - balance(loan, today): remaining mortgage balance
   - summary(home, today): value, equity, years owned
   English and Spanish text ("en" | "es").
   ========================================================================= */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.HomeCare = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const isCondo = t => /condo|apartment|stock cooperative/i.test(t || "");
  const isAttached = t => isCondo(t) || /town|attached|duplex|half/i.test(t || "");
  // [key, months, test(home), English, Spanish]
  const TASKS = [
    ["filter", [1, 4, 7, 10], () => true, "Replace the furnace filter (every 1–3 months; more often with pets).", "Cambie el filtro del calentador (cada 1 a 3 meses; más seguido si tiene mascotas)."],
    ["radon", [1], () => true, "January is Radon Action Month. Test every two years, or check that the mitigation fan’s gauge still shows suction.", "Enero es el mes de acción contra el radón. Haga una prueba cada dos años o revise que el medidor del ventilador de mitigación siga marcando succión."],
    ["waterheater", [2], () => true, "Flush the water heater to clear sediment; Colorado’s hard water builds it up fast.", "Purgue el calentador de agua para sacar el sedimento; el agua dura de Colorado lo acumula rápido."],
    ["detectors", [3], () => true, "Test smoke and carbon monoxide alarms and change the batteries. Colorado requires CO alarms near sleeping areas.", "Pruebe las alarmas de humo y de monóxido de carbono y cambie las baterías. Colorado exige alarmas de CO cerca de los dormitorios."],
    ["roofspring", [4], h => !isCondo(h.type), "Walk around the outside after winter: roof shingles, gutters, downspouts pointing away from the foundation.", "Revise el exterior después del invierno: tejas del techo, canaletas y bajantes que alejen el agua de los cimientos."],
    ["sprinklerOn", [5], h => !isAttached(h.type), "Turn the sprinklers on after the last hard freeze (usually mid-May in Denver) and check every head.", "Encienda los aspersores después de la última helada fuerte (en Denver, normalmente a mediados de mayo) y revise cada cabezal."],
    ["ac", [5], () => true, "Service the air conditioner before the first hot week, and clear debris around the outdoor unit.", "Dé mantenimiento al aire acondicionado antes de la primera semana de calor y limpie alrededor de la unidad exterior."],
    ["hail", [6, 7], h => !isCondo(h.type), "Hail season: after any storm, check the roof, gutters, siding, and window screens. Insurance claims have time limits, so photograph damage right away.", "Temporada de granizo: después de cada tormenta revise el techo, las canaletas, el revestimiento y los mosquiteros. Los reclamos al seguro tienen plazos, así que tome fotos del daño de inmediato."],
    ["dryer", [7], () => true, "Clean the dryer vent all the way to the outside. Lint buildup is a leading cause of house fires.", "Limpie el ducto de la secadora hasta la salida exterior. La pelusa acumulada es una causa principal de incendios."],
    ["deck", [8], h => !isCondo(h.type), "Check the deck, fence, and exterior paint and caulk before fall. Reseal wood that soaks up water.", "Revise la terraza, la cerca, la pintura y el sellador exterior antes del otoño. Vuelva a sellar la madera que absorbe agua."],
    ["furnace", [9], () => true, "Have the furnace inspected before heating season.", "Pida una inspección del calentador antes de la temporada de calefacción."],
    ["septic", [9], h => (Number(h.lot) || 0) >= 1 && !/denver/i.test(h.city || ""), "Septic system: have it inspected, and pumped every 3–5 years.", "Sistema séptico: hágalo inspeccionar y vaciar cada 3 a 5 años."],
    ["blowout", [10], h => !isAttached(h.type), "Blow out the sprinklers before the first hard freeze (early to mid-October) and disconnect garden hoses.", "Purgue los aspersores con aire antes de la primera helada fuerte (de principios a mediados de octubre) y desconecte las mangueras."],
    ["hosebib", [10], () => true, "Cover outdoor faucets and seal drafts around doors and windows.", "Cubra las llaves de agua exteriores y selle las corrientes de aire en puertas y ventanas."],
    ["gutters", [11], h => !isCondo(h.type), "Clean the gutters once the leaves are down, so melting snow can drain.", "Limpie las canaletas cuando caigan las hojas, para que la nieve derretida pueda drenar."],
    ["freeze", [12], () => true, "Cold snaps: know where the main water shutoff is, keep the heat at 55°F or higher if you travel, and open cabinet doors under sinks on outside walls.", "Olas de frío: sepa dónde está la llave de paso principal, deje la calefacción en 55 °F o más si viaja, y abra los gabinetes bajo los lavabos en paredes exteriores."]
  ];
  const MONTHS = { en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"], es: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"] };
  function tasks(home = {}, month, lang = "en") {
    return TASKS.filter(([, ms, test]) => ms.includes(month) && test(home)).map(([key, , , en, es]) => ({ key, text: lang === "es" ? es : en }));
  }
  const ymd = d => new Date(d + "T12:00:00Z");
  // June 8, or the next business day when it falls on a weekend.
  function appealDeadline(year) { const d = new Date(Date.UTC(year, 5, 8, 12)); while ([0, 6].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); }
  function taxNotes(today, lang = "en") {
    const d = ymd(today), y = d.getUTCFullYear(), m = d.getUTCMonth() + 1, es = lang === "es", out = [];
    if (y % 2 === 1 && today <= appealDeadline(y) && m >= 4) {
      const dl = appealDeadline(y), dlTxt = ymd(dl).toLocaleDateString(es ? "es-US" : "en-US", { month: "long", day: "numeric", timeZone: "UTC" });
      out.push({ key: "protest", urgent: m >= 5, title: es ? `${y} es año de revaluación` : `${y} is a reassessment year`,
        text: es ? `Su aviso de valor (Notice of Value) del condado llega a más tardar el 1 de mayo. Si el valor parece alto comparado con ventas similares cerca de usted, puede apelar ante el tasador del condado del 1 de mayo al ${dlTxt}. Pida a su agente las ventas comparables; es gratis.`
          : `Your county Notice of Value arrives by May 1. If the value looks high compared with similar sales near you, you can appeal to the county assessor from May 1 through ${dlTxt}. Ask your agent for comparable sales; it’s free.` });
    }
    if (m === 2) out.push({ key: "halfone", title: es ? "Impuestos a la propiedad" : "Property taxes", text: es ? "La primera mitad vence el último día de febrero (o pague todo antes del 30 de abril). Si su hipoteca tiene cuenta de depósito (escrow), su prestamista paga por usted." : "The first half is due the last day of February (or pay it all by April 30). If your mortgage has an escrow account, your lender pays it for you." });
    if (m === 6) out.push({ key: "halftwo", title: es ? "Impuestos a la propiedad" : "Property taxes", text: es ? "La segunda mitad vence el 15 de junio, a menos que su prestamista pague desde su cuenta de depósito (escrow)." : "The second half is due June 15, unless your lender pays it from escrow." });
    return out;
  }
  function balance(loan, today) {
    const P = Number(loan && loan.amount) || 0, rate = Number(loan && loan.rate) || 0, years = Number(loan && loan.termYears) || 30;
    if (!P || !loan.start) return null;
    const s = ymd(loan.start), t = ymd(today), k = Math.max(0, (t.getUTCFullYear() - s.getUTCFullYear()) * 12 + (t.getUTCMonth() - s.getUTCMonth()));
    const n = years * 12, r = rate / 1200;
    if (k >= n) return 0;
    if (!r) return P * (1 - k / n);
    const pmt = P * r / (1 - Math.pow(1 + r, -n));
    return Math.max(0, P * Math.pow(1 + r, k) - pmt * (Math.pow(1 + r, k) - 1) / r);
  }
  function summary(home = {}, today) {
    const value = Number(home.value && home.value.amount) || 0, price = Number(home.purchasePrice) || 0;
    const bal = balance(home.loan, today);
    const yrs = home.purchaseDate ? (ymd(today) - ymd(home.purchaseDate)) / (365.25 * 86400000) : null;
    return { value, valueDate: home.value && home.value.date || "", price, balance: bal, equity: value && bal != null ? value - bal : null, gain: value && price ? value - price : null, years: yrs };
  }
  // The monthly reminder email body (plain text).
  function monthlyText(home, today, lang = "en") {
    const m = ymd(today).getUTCMonth() + 1, es = lang === "es", t = tasks(home, m, lang), n = taxNotes(today, lang);
    const lines = [es ? `Hola${home.firstName ? " " + home.firstName : ""},` : `Hi${home.firstName ? " " + home.firstName : ""},`, "",
      es ? `Esto es lo que conviene hacer en ${MONTHS.es[m - 1]} en ${home.address || "su casa"}:` : `Here’s what’s worth doing at ${home.address || "your home"} in ${MONTHS.en[m - 1]}:`, "", ...t.map(x => `- ${x.text}`)];
    n.forEach(x => lines.push("", `${x.title}: ${x.text}`));
    lines.push("", es ? "Marque cada tarea en su portal de propietario, o responda si quiere recomendaciones de profesionales de confianza." : "Check them off in your homeowner portal, or reply if you’d like a referral to someone we trust.");
    return { subject: es ? `Su casa en ${MONTHS.es[m - 1]}: ${t.length} tareas` : `Your home in ${MONTHS.en[m - 1]}: ${t.length} things to do`, text: lines.join("\n"), count: t.length + n.length };
  }
  return { TASKS, MONTHS, tasks, taxNotes, appealDeadline, balance, summary, monthlyText };
});
