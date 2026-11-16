/* =========================================================================
   The Miller Group: true cost of ownership.
   HomeCost.estimate(listing, { down, rate }, facts, config)
     -> { lines, total, checks, flags, inputs }
   Every line says where its number came from:
     "mls"      the listing feed (tax bill, HOA dues)
     "agent"    verified by a Miller Group agent (cost facts)
     "estimate" a rough figure from the rules below
   Shared by the app and its tests. Not a loan offer or an insurance quote.
   ========================================================================= */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.HomeCost = factory();
})(typeof self !== "undefined" ? self : this, function () {
  // Defaults the broker can change in company settings (company/costconfig).
  const DEFAULTS = {
    rate: 6.5, down: 20, termYears: 30,
    // Rough effective property tax as a share of price, per year. The county tax bill is always the real number.
    taxRate: { default: 0.0062, Denver: 0.0055, Boulder: 0.0065, Aurora: 0.0068, Lakewood: 0.0058, Littleton: 0.006, Arvada: 0.0062, Westminster: 0.0066, Thornton: 0.0072, Parker: 0.0068, "Castle Rock": 0.0066, "Highlands Ranch": 0.0066, Breckenridge: 0.0042, Frisco: 0.0042, Dillon: 0.0042, Silverthorne: 0.0042 },
    metroAdd: 0.0035,          // extra when the home is in a metro district and the tax bill isn't known
    rebuildPerSqft: 275,       // insurance rebuild cost estimate
    insRate: 0.0055,           // homeowners premium per dollar of rebuild cost, per year (Colorado hail and wind included)
    wildfire: { low: 1, moderate: 1.25, high: 1.6, "very high": 2 },
    condoIns: 45, townIns: 90, // HO-6 and townhome policies, per month
    pmiRate: 0.006             // per year of the loan, when the down payment is under 20%
  };
  const FREQ = { monthly: 1, "bi-monthly": 0.5, bimonthly: 0.5, quarterly: 1 / 3, "semi-annually": 1 / 6, semiannually: 1 / 6, "semi-annual": 1 / 6, annually: 1 / 12, annual: 1 / 12, yearly: 1 / 12, weekly: 52 / 12 };
  const perMonth = (amt, freq) => { const a = Number(amt); if (!(a > 0)) return 0; const f = FREQ[String(freq || "monthly").toLowerCase().trim()]; return a * (f == null ? 1 : f); };
  const num = v => { const n = Number(String(v == null ? "" : v).replace(/[$,\s]/g, "")); return isFinite(n) && n > 0 ? n : 0; };
  const isCondo = t => /condo|apartment|stock cooperative/i.test(t || "");
  const isTown = t => /town|attached|duplex|half/i.test(t || "");
  const SFHA = z => /^(A|AE|AH|AO|AR|A99|V|VE)\b/i.test(String(z || "").trim());

  const WF_ES = { low: "bajo", moderate: "moderado", high: "alto", "very high": "muy alto" };
  // Cities named by the Colorado Department of Local Affairs as covered by HB24-1152 (the ADU law). The full list and map: LINKS.adu.
  const ADU_CITIES = ["Denver", "Aurora", "Boulder", "Colorado Springs", "Fort Collins", "Westminster", "Highlands Ranch"];
  const STR_RULES = {
    denver: { warn: true, link: "https://www.denvergov.org/Government/Agencies-Departments-Offices/Agencies-Departments-Offices-Directory/Business-Licensing/Business-licenses/Short-term-rentals",
      en: "Denver allows short-term rentals only in the host’s primary residence, with a city license. An investment property can’t be a short-term rental here.",
      es: "Denver solo permite rentas a corto plazo en la residencia principal del anfitrión, con licencia de la ciudad. Una propiedad de inversión no puede rentarse a corto plazo aquí." },
    breckenridge: { warn: true, link: "https://www.townofbreckenridge.com/departments/finance/business-and-accommodation-unit-licenses/accommodation-unit-short-term-rentals-licenses",
      en: "Breckenridge caps short-term rental licenses by zone, and licenses don’t transfer when the home sells. Check the zone map and whether a license is available before buying for rental income.",
      es: "Breckenridge limita las licencias de renta a corto plazo por zona, y las licencias no se transfieren al vender la casa. Revise el mapa de zonas y si hay licencias disponibles antes de comprar para rentar." }
  };
  const LINKS = {
    flood: "https://msc.fema.gov/portal/search",
    wildfire: "https://climate.colorado.gov/colorado-wildfire-risk-public-viewer",
    radon: "https://cdphe.colorado.gov/hm/understanding-radon",
    metro: "https://dlg.colorado.gov/special-districts-map",
    adu: "https://dlg.colorado.gov/accessory-dwelling-units"
  };

  function estimate(l, opts = {}, facts = {}, config = {}) {
    const C = { ...DEFAULTS, ...config, taxRate: { ...DEFAULTS.taxRate, ...(config.taxRate || {}) }, wildfire: { ...DEFAULTS.wildfire, ...(config.wildfire || {}) } };
    facts = facts || {};
    const price = num(l && l.price);
    const down = isFinite(+opts.down) && +opts.down >= 0 && +opts.down < 100 ? +opts.down : C.down;
    const rate = isFinite(+opts.rate) && +opts.rate >= 0 ? +opts.rate : C.rate;
    const lines = [], flags = [], checks = [];
    if (!price) return { lines, total: 0, checks, flags, inputs: { down, rate } };
    const thisYear = new Date().getFullYear();
    const es = opts.lang === "es", T = (en, sp) => es ? sp : en;

    // Principal and interest
    const loan = price * (1 - down / 100), r = rate / 1200, n = C.termYears * 12;
    const pi = loan ? (r ? loan * r / (1 - Math.pow(1 + r, -n)) : loan / n) : 0;
    lines.push({ key: "pi", label: T("Principal and interest", "Capital e intereses"), monthly: pi, source: "estimate", basis: T(`${C.termYears}-year fixed at ${rate}% with ${down}% down`, `Tasa fija a ${C.termYears} años al ${rate}% con ${down}% de enganche`) });
    if (loan && down < 20) lines.push({ key: "pmi", label: T("Mortgage insurance", "Seguro hipotecario"), monthly: loan * C.pmiRate / 12, source: "estimate", basis: T("Usually required with less than 20% down; drops off as you build equity", "Normalmente se exige con menos del 20% de enganche; se elimina a medida que acumula plusvalía") });

    // Property tax
    const metro = String(facts.metroDistrict || "").toLowerCase();
    const estRate = (C.taxRate[l.city] || C.taxRate.default) + (metro === "yes" ? C.metroAdd : 0);
    const estTax = price * estRate;
    const factTax = num(facts.taxAnnual), mlsTax = num(l.taxAnnual);
    if (factTax) lines.push({ key: "tax", label: T("Property tax", "Impuesto a la propiedad"), monthly: factTax / 12, source: "agent", basis: T(`${money(factTax)} a year${facts.taxYear ? ` (${facts.taxYear} bill)` : ""}${metro === "yes" ? ", includes metro district" : ""}`, `${money(factTax)} al año${facts.taxYear ? ` (recibo de ${facts.taxYear})` : ""}${metro === "yes" ? ", incluye el distrito metropolitano" : ""}`) });
    else if (mlsTax) {
      lines.push({ key: "tax", label: T("Property tax", "Impuesto a la propiedad"), monthly: mlsTax / 12, source: "mls", basis: T(`${money(mlsTax)} a year${l.taxYear ? ` (${l.taxYear} bill)` : ""} from the listing`, `${money(mlsTax)} al año${l.taxYear ? ` (recibo de ${l.taxYear})` : ""}, según el anuncio`) });
      if (num(l.year) >= thisYear - 2 && mlsTax < estTax * 0.45) flags.push({ key: "landonly", text: T(`The tax bill on the listing looks low for a home built in ${l.year}. New construction is often taxed as vacant land the first year, so the next bill could be closer to ${money(estTax)} a year.`, `El impuesto del anuncio parece bajo para una casa construida en ${l.year}. Las casas nuevas a menudo pagan como terreno baldío el primer año, así que el próximo recibo podría acercarse a ${money(estTax)} al año.`) });
    } else lines.push({ key: "tax", label: T("Property tax", "Impuesto a la propiedad"), monthly: estTax / 12, source: "estimate", basis: T(`About ${(estRate * 100).toFixed(2)}% of the price a year${metro === "yes" ? ", including a metro district" : ""}; the county assessor has the actual bill`, `Cerca del ${(estRate * 100).toFixed(2)}% del precio al año${metro === "yes" ? ", con distrito metropolitano" : ""}; el tasador del condado tiene el recibo real`) });

    // HOA (Colorado often has a master and a sub-association)
    const factHoa = num(facts.hoaMonthly);
    const mlsHoa = perMonth(l.hoaFee, l.hoaFreq) + perMonth(l.hoaFee2, l.hoaFreq2);
    if (factHoa) lines.push({ key: "hoa", label: T("HOA dues", "Cuotas de la HOA"), monthly: factHoa, source: "agent", basis: facts.hoaNote || T("Verified by your agent", "Verificado por su agente") });
    else if (mlsHoa) lines.push({ key: "hoa", label: T("HOA dues", "Cuotas de la HOA"), monthly: mlsHoa, source: "mls", basis: num(l.hoaFee2) ? T("Two associations, from the listing", "Dos asociaciones, según el anuncio") : T("From the listing", "Según el anuncio") });
    else if (isCondo(l.type) || isTown(l.type)) flags.push({ key: "hoa", text: T("HOA dues aren’t listed. Condos and townhomes almost always have them; ask for the amount and what it covers.", "El anuncio no muestra cuotas de HOA. Los condominios y casas adosadas casi siempre las tienen; pregunte el monto y qué cubren.") });

    // Homeowners insurance
    const wf = String(facts.wildfire || "").toLowerCase(), mult = C.wildfire[wf] || 1;
    const factIns = num(facts.insuranceMonthly);
    if (factIns) lines.push({ key: "ins", label: T("Homeowners insurance", "Seguro de vivienda"), monthly: factIns, source: "agent", basis: facts.insuranceNote || T("From a quote", "Según una cotización") });
    else if (isCondo(l.type)) lines.push({ key: "ins", label: T("Homeowners insurance", "Seguro de vivienda"), monthly: C.condoIns, source: "estimate", basis: T("Condo (HO-6) policy; the HOA’s master policy covers the building", "Póliza de condominio (HO-6); la póliza principal de la HOA cubre el edificio") });
    else if (isTown(l.type)) lines.push({ key: "ins", label: T("Homeowners insurance", "Seguro de vivienda"), monthly: C.townIns * mult, source: "estimate", basis: T("Check whether the HOA insures the exterior and roof", "Confirme si la HOA asegura el exterior y el techo") });
    else {
      const sq = num(l.sqft) || 1800, dwelling = sq * C.rebuildPerSqft;
      lines.push({ key: "ins", label: T("Homeowners insurance", "Seguro de vivienda"), monthly: dwelling * C.insRate * mult / 12, source: "estimate", basis: T(`Based on about ${money(dwelling)} to rebuild${mult > 1 ? `, with ${wf} wildfire risk` : ""}`, `Según un costo de reconstrucción de unos ${money(dwelling)}${mult > 1 ? `, con riesgo de incendio ${WF_ES[wf] || wf}` : ""}`) });
    }
    if (wf === "high" || wf === "very high") flags.push({ key: "wildfire", text: T(`This home is in a ${wf} wildfire risk area. Get insurance quotes before your inspection deadline; some carriers won’t write new policies there, and premiums can be much higher.`, `Esta casa está en una zona de riesgo de incendio forestal ${WF_ES[wf] || wf}. Pida cotizaciones de seguro antes de la fecha límite de inspección; algunas aseguradoras no emiten pólizas nuevas allí y las primas pueden ser mucho más altas.`) });

    // Flood
    const zone = String(facts.floodZone || l.floodZone || "").trim();
    const factFlood = num(facts.floodMonthly);
    if (SFHA(zone)) {
      if (factFlood) lines.push({ key: "flood", label: T("Flood insurance", "Seguro contra inundaciones"), monthly: factFlood, source: "agent", basis: T(`Zone ${zone}; from a quote`, `Zona ${zone}; según una cotización`) });
      else flags.push({ key: "flood", text: T(`FEMA flood zone ${zone}. Lenders require flood insurance here, and it isn’t in this total. Get a quote early.`, `Zona de inundación ${zone} de FEMA. Los prestamistas exigen seguro contra inundaciones aquí y no está incluido en este total. Pida una cotización pronto.`) });
    }

    const total = lines.reduce((s, x) => s + x.monthly, 0);

    // Checks before you buy
    const yr = num(l.year), lot = Number(l.lot) || 0;
    checks.push(zone ? { key: "flood", label: T("Flood zone", "Zona de inundación"), status: SFHA(zone) ? "warn" : "ok", note: SFHA(zone) ? T(`Zone ${zone}: high-risk area; flood insurance required by lenders`, `Zona ${zone}: área de alto riesgo; los prestamistas exigen seguro contra inundaciones`) : T(`Zone ${zone}: outside the high-risk area`, `Zona ${zone}: fuera del área de alto riesgo`), link: LINKS.flood }
      : { key: "flood", label: T("Flood zone", "Zona de inundación"), status: "check", note: T("Look up the address on FEMA’s flood map", "Busque la dirección en el mapa de inundaciones de FEMA"), link: LINKS.flood });
    checks.push(wf ? { key: "wildfire", label: T("Wildfire risk", "Riesgo de incendio forestal"), status: mult > 1.3 ? "warn" : "ok", note: T(`${wf[0].toUpperCase() + wf.slice(1)} risk${mult > 1 ? "; affects insurance cost and availability" : ""}`, `Riesgo ${WF_ES[wf] || wf}${mult > 1 ? "; afecta el costo y la disponibilidad del seguro" : ""}`), link: LINKS.wildfire }
      : { key: "wildfire", label: T("Wildfire risk", "Riesgo de incendio forestal"), status: "check", note: T("Check the Colorado Wildfire Risk Public Viewer, then get an insurance quote", "Consulte el mapa público de riesgo de incendios de Colorado y luego pida una cotización de seguro"), link: LINKS.wildfire });
    checks.push(metro ? { key: "metro", label: T("Metro district", "Distrito metropolitano"), status: metro === "yes" ? "warn" : "ok", note: metro === "yes" ? (facts.metroNote || T("Yes: adds a separate mill levy to the property tax bill", "Sí: agrega un impuesto adicional al recibo de la propiedad")) : T("Not in a metro district", "No está en un distrito metropolitano"), link: LINKS.metro }
      : { key: "metro", label: T("Metro district", "Distrito metropolitano"), status: "check", note: yr >= 1990 && !isCondo(l.type) ? T("Common in newer subdivisions; check the tax bill for a metro district levy", "Común en fraccionamientos nuevos; revise si el recibo de impuestos incluye un distrito metropolitano") : T("Check the tax bill for any metro district levy", "Revise si el recibo de impuestos incluye un distrito metropolitano"), link: LINKS.metro });
    checks.push({ key: "radon", label: T("Radon test", "Prueba de radón"), status: facts.radon ? (/mitigat|below|pass|ok/i.test(facts.radon) ? "ok" : "warn") : "check", note: facts.radon || T("About half of Colorado homes test above the EPA action level. Test during inspection; mitigation typically runs $1,000 to $2,500.", "Cerca de la mitad de las casas en Colorado superan el nivel de acción de la EPA. Haga la prueba durante la inspección; la mitigación suele costar de $1,000 a $2,500."), link: LINKS.radon });
    if (yr && yr < 1990 && !isCondo(l.type)) checks.push({ key: "sewer", label: T("Sewer scope", "Inspección del drenaje"), status: facts.sewer ? (/clear|good|ok|pass/i.test(facts.sewer) ? "ok" : "warn") : "check", note: facts.sewer || T(`Built in ${yr}: older clay and cast-iron sewer lines often crack or fill with roots. A scope costs about $150–$300; repairs can run into the thousands.`, `Construida en ${yr}: las tuberías de drenaje antiguas de barro o hierro fundido suelen agrietarse o llenarse de raíces. Una inspección con cámara cuesta unos $150–$300; las reparaciones pueden costar miles.`) });
    if (yr && yr < 1978) checks.push({ key: "lead", label: T("Lead-based paint", "Pintura con plomo"), status: "check", note: T("Built before 1978, so the seller must give a lead-based paint disclosure. Plan for safe practices if you renovate.", "Construida antes de 1978, así que el vendedor debe entregar la divulgación de pintura con plomo. Use prácticas seguras si remodela.") });
    if (lot >= 1 && !/denver/i.test(l.city || "")) checks.push({ key: "well", label: T("Well and septic", "Pozo y séptico"), status: facts.wellSeptic ? "ok" : "check", note: facts.wellSeptic || T("On a larger lot, confirm whether water is from a well and waste goes to a septic system. Check the Source of Water Disclosure, the well permit, and get a septic inspection.", "En un terreno grande, confirme si el agua viene de un pozo y si el drenaje va a un sistema séptico. Revise la divulgación de la fuente de agua y el permiso del pozo, y pida una inspección del séptico.") });
    // ADU: Colorado HB24-1152 requires covered cities to allow one ADU wherever a single-unit home is allowed.
    const city = String(l.city || "").trim(), hasHoa = !!(mlsHoa || factHoa);
    const flagOf = v => /\b(no|not|prohibit\w*|ban\w*|denied|none|waitlist\w*|can['’]t|cannot|unpermitted|limit\w*|cap\w*)\b/i.test(v) ? "warn" : "ok";
    if (facts.adu) checks.push({ key: "adu", label: T("ADU (backyard unit)", "ADU (unidad adicional)"), status: flagOf(facts.adu), note: facts.adu, link: LINKS.adu });
    else if (!isCondo(l.type) && !isTown(l.type)) {
      const covered = ADU_CITIES.some(c => c.toLowerCase() === city.toLowerCase());
      checks.push({ key: "adu", label: T("ADU (backyard unit)", "ADU (unidad adicional)"), status: "check", link: LINKS.adu,
        note: covered ? T(`${city} is covered by Colorado’s ADU law, so one ADU is allowed wherever a single-family home is. Check the lot’s zoning, utility taps and fees, and any HOA covenants${hasHoa ? " (this home has an HOA)" : ""}.`, `${city} está cubierta por la ley de ADU de Colorado, así que se permite una ADU donde se permite una casa unifamiliar. Revise la zonificación del terreno, las conexiones y cuotas de servicios, y las restricciones de la HOA${hasHoa ? " (esta casa tiene HOA)" : ""}.`)
          : T("Colorado’s ADU law covers most cities in the Front Range metro areas; check the state’s map for this address, then the local zoning and HOA covenants.", "La ley de ADU de Colorado cubre la mayoría de las ciudades de las áreas metropolitanas del Front Range; revise el mapa del estado para esta dirección y luego la zonificación local y las restricciones de la HOA.") });
    }
    // Short-term rentals: local rules decide, and HOAs can prohibit them.
    const strRule = STR_RULES[city.toLowerCase()];
    if (facts.str) checks.push({ key: "str", label: T("Short-term rental", "Renta a corto plazo"), status: flagOf(facts.str), note: facts.str, link: (strRule && strRule.link) || "" });
    else checks.push({ key: "str", label: T("Short-term rental", "Renta a corto plazo"), status: strRule && strRule.warn ? "warn" : "check", link: strRule ? strRule.link : "",
      note: (strRule ? (es ? strRule.es : strRule.en) : T("Short-term rental rules are set by the city or county and many require a license; check before counting on rental income.", "Las reglas de renta a corto plazo las fija la ciudad o el condado y muchas exigen licencia; verifíquelas antes de contar con ese ingreso.")) + (hasHoa || isCondo(l.type) || isTown(l.type) ? T(" Check the HOA declarations too; many ban or limit rentals under 30 days.", " Revise también las reglas de la HOA; muchas prohíben o limitan las rentas de menos de 30 días.") : "") });
    if (isCondo(l.type) || isTown(l.type) || mlsHoa || factHoa) checks.push({ key: "hoadocs", label: T("HOA documents", "Documentos de la HOA"), status: facts.hoaDocs ? "ok" : "check", note: facts.hoaDocs || T("Review the budget, reserves, any special assessments, rental rules, and the master insurance policy.", "Revise el presupuesto, las reservas, cualquier cuota especial, las reglas de renta y la póliza de seguro principal.") });

    return { lines, total, checks, flags, inputs: { down, rate }, updatedBy: facts.byName || "", updatedAt: facts.at || "" };
  }
  function money(n) { return "$" + Math.round(n).toLocaleString("en-US"); }
  // Quick all-in number for cards.
  const monthly = (l, facts, config) => estimate(l, {}, facts, config).total;
  return { estimate, monthly, perMonth, DEFAULTS, LINKS, SFHA, money };
});
