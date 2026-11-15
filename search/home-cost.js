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

  const LINKS = {
    flood: "https://msc.fema.gov/portal/search",
    wildfire: "https://climate.colorado.gov/colorado-wildfire-risk-public-viewer",
    radon: "https://cdphe.colorado.gov/hm/understanding-radon",
    metro: "https://dlg.colorado.gov/special-districts-map"
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

    // Principal and interest
    const loan = price * (1 - down / 100), r = rate / 1200, n = C.termYears * 12;
    const pi = loan ? (r ? loan * r / (1 - Math.pow(1 + r, -n)) : loan / n) : 0;
    lines.push({ key: "pi", label: "Principal and interest", monthly: pi, source: "estimate", basis: `${C.termYears}-year fixed at ${rate}% with ${down}% down` });
    if (loan && down < 20) lines.push({ key: "pmi", label: "Mortgage insurance", monthly: loan * C.pmiRate / 12, source: "estimate", basis: "Usually required with less than 20% down; drops off as you build equity" });

    // Property tax
    const metro = String(facts.metroDistrict || "").toLowerCase();
    const estRate = (C.taxRate[l.city] || C.taxRate.default) + (metro === "yes" ? C.metroAdd : 0);
    const estTax = price * estRate;
    const factTax = num(facts.taxAnnual), mlsTax = num(l.taxAnnual);
    if (factTax) lines.push({ key: "tax", label: "Property tax", monthly: factTax / 12, source: "agent", basis: `${money(factTax)} a year${facts.taxYear ? ` (${facts.taxYear} bill)` : ""}${metro === "yes" ? ", includes metro district" : ""}` });
    else if (mlsTax) {
      lines.push({ key: "tax", label: "Property tax", monthly: mlsTax / 12, source: "mls", basis: `${money(mlsTax)} a year${l.taxYear ? ` (${l.taxYear} bill)` : ""} from the listing` });
      if (num(l.year) >= thisYear - 2 && mlsTax < estTax * 0.45) flags.push({ key: "landonly", text: `The tax bill on the listing looks low for a home built in ${l.year}. New construction is often taxed as vacant land the first year, so the next bill could be closer to ${money(estTax)} a year.` });
    } else lines.push({ key: "tax", label: "Property tax", monthly: estTax / 12, source: "estimate", basis: `About ${(estRate * 100).toFixed(2)}% of the price a year${metro === "yes" ? ", including a metro district" : ""}; the county assessor has the actual bill` });

    // HOA (Colorado often has a master and a sub-association)
    const factHoa = num(facts.hoaMonthly);
    const mlsHoa = perMonth(l.hoaFee, l.hoaFreq) + perMonth(l.hoaFee2, l.hoaFreq2);
    if (factHoa) lines.push({ key: "hoa", label: "HOA dues", monthly: factHoa, source: "agent", basis: facts.hoaNote || "Verified by your agent" });
    else if (mlsHoa) lines.push({ key: "hoa", label: "HOA dues", monthly: mlsHoa, source: "mls", basis: num(l.hoaFee2) ? "Two associations, from the listing" : "From the listing" });
    else if (isCondo(l.type) || isTown(l.type)) flags.push({ key: "hoa", text: "HOA dues aren’t listed. Condos and townhomes almost always have them; ask for the amount and what it covers." });

    // Homeowners insurance
    const wf = String(facts.wildfire || "").toLowerCase(), mult = C.wildfire[wf] || 1;
    const factIns = num(facts.insuranceMonthly);
    if (factIns) lines.push({ key: "ins", label: "Homeowners insurance", monthly: factIns, source: "agent", basis: facts.insuranceNote || "From a quote" });
    else if (isCondo(l.type)) lines.push({ key: "ins", label: "Homeowners insurance", monthly: C.condoIns, source: "estimate", basis: "Condo (HO-6) policy; the HOA’s master policy covers the building" });
    else if (isTown(l.type)) lines.push({ key: "ins", label: "Homeowners insurance", monthly: C.townIns * mult, source: "estimate", basis: "Check whether the HOA insures the exterior and roof" });
    else {
      const sq = num(l.sqft) || 1800, dwelling = sq * C.rebuildPerSqft;
      lines.push({ key: "ins", label: "Homeowners insurance", monthly: dwelling * C.insRate * mult / 12, source: "estimate", basis: `Based on about ${money(dwelling)} to rebuild${mult > 1 ? `, with ${wf} wildfire risk` : ""}` });
    }
    if (wf === "high" || wf === "very high") flags.push({ key: "wildfire", text: `This home is in a ${wf} wildfire risk area. Get insurance quotes before your inspection deadline; some carriers won’t write new policies there, and premiums can be much higher.` });

    // Flood
    const zone = String(facts.floodZone || l.floodZone || "").trim();
    const factFlood = num(facts.floodMonthly);
    if (SFHA(zone)) {
      if (factFlood) lines.push({ key: "flood", label: "Flood insurance", monthly: factFlood, source: "agent", basis: `Zone ${zone}; from a quote` });
      else flags.push({ key: "flood", text: `FEMA flood zone ${zone}. Lenders require flood insurance here, and it isn’t in this total. Get a quote early.` });
    }

    const total = lines.reduce((s, x) => s + x.monthly, 0);

    // Checks before you buy
    const yr = num(l.year), lot = Number(l.lot) || 0;
    checks.push(zone ? { key: "flood", label: "Flood zone", status: SFHA(zone) ? "warn" : "ok", note: SFHA(zone) ? `Zone ${zone}: high-risk area; flood insurance required by lenders` : `Zone ${zone}: outside the high-risk area`, link: LINKS.flood }
      : { key: "flood", label: "Flood zone", status: "check", note: "Look up the address on FEMA’s flood map", link: LINKS.flood });
    checks.push(wf ? { key: "wildfire", label: "Wildfire risk", status: mult > 1.3 ? "warn" : "ok", note: `${wf[0].toUpperCase() + wf.slice(1)} risk${mult > 1 ? "; affects insurance cost and availability" : ""}`, link: LINKS.wildfire }
      : { key: "wildfire", label: "Wildfire risk", status: "check", note: "Check the Colorado Wildfire Risk Public Viewer, then get an insurance quote", link: LINKS.wildfire });
    checks.push(metro ? { key: "metro", label: "Metro district", status: metro === "yes" ? "warn" : "ok", note: metro === "yes" ? (facts.metroNote || "Yes: adds a separate mill levy to the property tax bill") : "Not in a metro district" , link: LINKS.metro }
      : { key: "metro", label: "Metro district", status: "check", note: yr >= 1990 && !isCondo(l.type) ? "Common in newer subdivisions; check the tax bill for a metro district levy" : "Check the tax bill for any metro district levy", link: LINKS.metro });
    checks.push({ key: "radon", label: "Radon test", status: facts.radon ? (/mitigat|below|pass|ok/i.test(facts.radon) ? "ok" : "warn") : "check", note: facts.radon || "About half of Colorado homes test above the EPA action level. Test during inspection; mitigation typically runs $1,000 to $2,500.", link: LINKS.radon });
    if (yr && yr < 1990 && !isCondo(l.type)) checks.push({ key: "sewer", label: "Sewer scope", status: facts.sewer ? (/clear|good|ok|pass/i.test(facts.sewer) ? "ok" : "warn") : "check", note: facts.sewer || `Built in ${yr}: older clay and cast-iron sewer lines often crack or fill with roots. A scope costs about $150–$300; repairs can run into the thousands.` });
    if (yr && yr < 1978) checks.push({ key: "lead", label: "Lead-based paint", status: "check", note: "Built before 1978, so the seller must give a lead-based paint disclosure. Plan for safe practices if you renovate." });
    if (lot >= 1 && !/denver/i.test(l.city || "")) checks.push({ key: "well", label: "Well and septic", status: facts.wellSeptic ? "ok" : "check", note: facts.wellSeptic || "On a larger lot, confirm whether water is from a well and waste goes to a septic system. Check the Source of Water Disclosure, the well permit, and get a septic inspection." });
    if (isCondo(l.type) || isTown(l.type) || mlsHoa || factHoa) checks.push({ key: "hoadocs", label: "HOA documents", status: facts.hoaDocs ? "ok" : "check", note: facts.hoaDocs || "Review the budget, reserves, any special assessments, rental rules, and the master insurance policy." });

    return { lines, total, checks, flags, inputs: { down, rate }, updatedBy: facts.byName || "", updatedAt: facts.at || "" };
  }
  function money(n) { return "$" + Math.round(n).toLocaleString("en-US"); }
  // Quick all-in number for cards.
  const monthly = (l, facts, config) => estimate(l, {}, facts, config).total;
  return { estimate, monthly, perMonth, DEFAULTS, LINKS, SFHA, money };
});
