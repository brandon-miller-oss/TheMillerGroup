/* =========================================================================
   The Miller Group: Print studio (inside Marketing).
   Business cards, postcards, event mailers, tri-fold listing brochures, and
   flyers. Agents pick a listing, choose and order its photos (or add their
   own), edit the words, preview each side, and download a print-ready PDF
   (optional 1/8" bleed for print shops).

   Each design is a list of drawing operations in inches. The same list draws
   the on-screen SVG preview and the vector PDF (jsPDF), so they match.
   ========================================================================= */
(function () {
  const PS = window.PrintStudio = {};
  const C = window.MG_CONFIG || {};
  const QR_SRC = "https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js";

  const PRODUCTS = [
    ["flyer", "Flyer", "8.5 × 11 in", "Listing flyer with a hero photo and three more"],
    ["brochure", "Listing brochure", "Tri-fold, 11 × 8.5 in", "Six panels: cover, photos, details, and your info"],
    ["postcard", "Postcard", "6 × 4 or 9 × 6 in", "Just listed, just sold, open house, farming, and market updates"],
    ["mailer", "Event mailer", "5 × 7 in", "Open houses, client appreciation, homebuyer seminars"],
    ["bizcard", "Business card", "3.5 × 2 in", "Front and back with your contact details and QR code"],
    ["onepager", "Meet your agent", "8.5 × 11 in", "Your story, services, and what clients say"],
    ["letterhead", "Letterhead", "8.5 × 11 in", "For letters, notes, and offers"],
    ["signin", "Open house sign-in", "8.5 × 11 in", "Sign-in sheet with a QR code to the listing"]
  ];
  const THEMES = {
    flyer: [["just-listed", "Just listed"], ["coming-soon", "Coming soon"], ["open-house", "Open house"], ["price-improved", "Price improved"], ["off-market", "Off-market opportunity"]],
    brochure: [["just-listed", "Just listed"], ["coming-soon", "Coming soon"], ["open-house", "Open house"], ["off-market", "Off-market opportunity"]],
    postcard: [["just-listed", "Just listed"], ["just-sold", "Just sold"], ["open-house", "Open house"], ["coming-soon", "Coming soon"], ["price-improved", "Price improved"], ["thinking", "Thinking of selling?"], ["market", "Market update"]],
    mailer: [["open-house", "Open house"], ["appreciation", "Client appreciation event"], ["seminar", "Homebuyer seminar"], ["event", "Other event"]],
    bizcard: [["classic", "Classic"], ["light", "Light"]],
    onepager: [["standard", "Standard"]], brandsheet: [["standard", "Standard"]], letterhead: [["standard", "Standard"]], signin: [["standard", "Standard"]]
  };
  const HEADLINES = { "just-listed": "Just listed", "just-sold": "Just sold", "open-house": "Open house", "coming-soon": "Coming soon", "price-improved": "Price improved", "off-market": "Off-market opportunity",
    thinking: "Curious what your home is worth?", market: "Your neighborhood market update", appreciation: "You’re invited", seminar: "Homebuyer seminar", event: "You’re invited", classic: "Real estate along the Front Range", light: "Real estate along the Front Range", standard: "" };
  const USES_LISTING = { flyer: true, brochure: true, postcard: t => !["thinking", "market"].includes(t), mailer: t => t === "open-house", bizcard: false, onepager: false, brandsheet: false, letterhead: false, signin: true };
  const PHOTO_SLOTS = { flyer: 4, brochure: 5, postcard: 1, mailer: 1, bizcard: 0, onepager: 0, brandsheet: 0, letterhead: 0, signin: 0 };

  const S = PS.state = { product: "flyer", theme: "just-listed", size: "6x4", key: "", picks: null, uploads: [], headline: "", body: "", bleed: false, side: 0,
    ev: { title: "", date: "", start: "", end: "", place: "", rsvp: "" }, busy: false, msg: "", ready: false, loading: false };

  /* ------------------------------ Helpers ------------------------------ */
  const B = () => (window.AgentBrand && AgentBrand.palette()) || (window.CMAReport && CMAReport.brand) || { midnight: [20, 26, 38], gold: [184, 147, 90], linen: [244, 239, 231], ink: [20, 26, 38], gray: [110, 116, 128], line: [221, 212, 197] };
  const hex = c => "#" + c.map(v => v.toString(16).padStart(2, "0")).join("");
  const WHITE = [255, 255, 255];
  const clean = s => (window.CMAReport && CMAReport.clean ? CMAReport.clean(String(s ?? "")) : String(s ?? ""));
  const usesListing = () => { const u = USES_LISTING[S.product]; return typeof u === "function" ? u(S.theme) : u; };
  const listing = () => S.key ? marketingPool().find(p => p.key === S.key) : null;
  const agent = () => {
    if (window.AgentBrand) return AgentBrand.current();
    const t = (Store.team || {})[Store.crmOwner] || {};
    return { name: t.name || IDX.BROKER.name, title: t.title || "Broker", phone: t.phone || IDX.BROKER.phone, email: t.email || "", firm: IDX.BROKER.firm || "The Miller Group", display: IDX.BROKER.firm || "The Miller Group", byline: "", brand: null, photo: t.photoUrl || "",
      link: IDX.APP_URL + (t.slug ? `?agent=${encodeURIComponent(t.slug)}` : ""), web: (C.SITE_URL || "").replace(/^https?:\/\//, "").replace(/\/$/, "") };
  };
  const license = () => C.LICENSE_TEXT && !/\[add/i.test(C.LICENSE_TEXT) ? C.LICENSE_TEXT : "";
  const fmtDate = d => d ? new Date(d + "T12:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) : "";
  const evLine = () => { const e = S.ev; return [fmtDate(e.date), e.start ? fmtTime(e.start) + (e.end ? "–" + fmtTime(e.end) : "") : ""].filter(Boolean).join(" · "); };
  const facts = l => l ? [l.beds != null ? `${l.beds} bd` : "", l.baths != null ? `${l.baths} ba` : "", l.sqft ? `${Number(l.sqft).toLocaleString()} sq ft` : ""].filter(Boolean).join("  ·  ") : "";

  // Photos the agent can choose from: the listing's photos, photos they added, and a drawn placeholder.
  function photoPool() {
    const l = listing(), out = [];
    if (l) (l.photos || []).forEach((u, i) => out.push({ id: "l" + i, kind: "url", src: u, label: `Listing photo ${i + 1}` }));
    S.uploads.forEach(u => out.push(u));
    if (l && !(l.photos || []).length) out.push({ id: "art", kind: "art", src: l.key, label: "Illustration (until photos arrive)" });
    return out;
  }
  function chosen() {
    const pool = photoPool(), n = PHOTO_SLOTS[S.product];
    let picks = (S.picks || pool.map(p => p.id)).map(id => pool.find(p => p.id === id)).filter(Boolean);
    if (!picks.length && pool.length) picks = [pool[0]];
    const out = []; for (let i = 0; i < n; i++) out.push(picks.length ? picks[i % picks.length] : { kind: "blank" });
    return out;
  }

  /* --------------------------- Design builders --------------------------- */
  // Ops: rect{x,y,w,h,fill,stroke,r}, img{x,y,w,h,photo}, text{x,y,text,size,font,style,color,align,maxW,lh,maxLines}, line, circle, qr{x,y,size,data}, guide (preview only)
  function design() {
    const b = B(), l = usesListing() ? listing() : null, a = agent(), p = chosen();
    const theme = (THEMES[S.product].find(t => t[0] === S.theme) || THEMES[S.product][0]);
    const head = S.headline || HEADLINES[theme[0]] || theme[1];
    const R = (x, y, w, h, fill, extra = {}) => ({ t: "rect", x, y, w, h, fill, ...extra });
    const T = (text, x, y, size, o = {}) => ({ t: "text", text, x, y, size, font: "sans", style: "normal", color: b.ink, align: "left", ...o });
    const I = (x, y, w, h, photo) => ({ t: "img", x, y, w, h, photo: photo || { kind: "blank" } });
    const L = (x1, y1, x2, y2, color = b.gold, w = 0.02) => ({ t: "line", x1, y1, x2, y2, color, w });
    const firmLine = [a.byline || a.firm, license()].filter(Boolean).join("  ·  ");
    // The agent's brand mark (logo or name) with "Brokered by The Miller Group" kept clear and readable.
    const mark = (x, y, size, o = {}) => {
      const align = o.align || "left", col = o.color || b.gold, bcol = o.bycolor || (o.dark ? WHITE : b.midnight), bys = Math.max(o.minBy || 6.5, size * 0.48), ops = [];
      if (!a.brand) return [T(a.firm, x, y, size, { font: "serif", style: "bold", color: col, align, shadow: o.shadow, maxW: o.maxW })];
      const logo = o.dark ? a.brand.logoDark : a.brand.logo, lw0 = o.dark ? a.brand.logoDarkW : a.brand.logoW, lh0 = o.dark ? a.brand.logoDarkH : a.brand.logoH;
      let byY;
      if (logo && lw0 && lh0) {
        let h = size / 72 * 1.8, w = h * lw0 / lh0; const mw = o.maxW || 3.2; if (w > mw) { w = mw; h = w * lh0 / lw0; }
        const lx = align === "center" ? x - w / 2 : align === "right" ? x - w : x, top = y - size / 72 * 1.05;
        ops.push({ t: "logo", x: lx, y: top, w, h, src: logo }); byY = top + h + bys / 72 * 1.15;
      } else { ops.push(T(a.display, x, y, size, { font: "serif", style: "bold", color: col, align, shadow: o.shadow, maxW: o.maxW, maxLines: 1 })); byY = y + bys / 72 * 1.35; }
      if (!o.noBy) ops.push(T(a.byline, x, byY, bys, { style: "bold", color: bcol, align, shadow: o.shadow }));
      return ops;
    };
    const eho = "Equal Housing Opportunity";
    const mountains = (x, y, w, h, color = b.gold) => { const pts = [[0, .7], [.12, .35], [.2, .55], [.33, .1], [.45, .5], [.55, .3], [.68, .62], [.8, .2], [.9, .45], [1, .3]]; return pts.slice(1).map((q, i) => L(x + pts[i][0] * w, y + pts[i][1] * h, x + q[0] * w, y + q[1] * h, color, 0.025)); };
    const body = S.body || defaultBody(theme[0], l, a);

    if (S.product === "flyer") {
      const W = 8.5, H = 11, ops = [];
      const bandH = a.brand ? 1.1 : 0.85;
      ops.push(R(0, 0, W, bandH, b.midnight), ...mark(0.5, a.brand ? 0.58 : 0.56, a.brand ? 26 : 20, { dark: true, maxW: 5, minBy: 11 }), T(head, W - 0.5, a.brand ? 0.66 : 0.56, 15, { style: "bold", color: WHITE, align: "right" }));
      ops.push(I(0, bandH, W, 5.85 - bandH, p[0]), R(0, 5.85, W, 0.04, b.gold));
      [1, 2, 3].forEach(i => ops.push(I(0.5 + (i - 1) * 2.55, 6.05, 2.45, 1.55, p[i])));
      ops.push(T(l ? money(l.price) : "", 0.5, 8.25, 30, { font: "serif", style: "bold", color: b.midnight }), T(l ? l.address : "", 0.5, 8.6, 13, { style: "bold" }), T(l ? [l.hood, l.city].filter(Boolean).join(", ") : "", 0.5, 8.85, 11, { color: b.gray }),
        T(facts(l), 0.5, 9.2, 11.5, { color: b.midnight }), S.theme === "open-house" && evLine() ? T(evLine(), 0.5, 9.5, 11.5, { style: "bold", color: b.gold }) : null,
        T(body, 4.4, 8.05, 10, { maxW: 3.6, lh: 1.4, maxLines: 10 }));
      ops.push(R(0, 9.9, W, 1.1, b.midnight), T(a.name, 0.5, 10.3, 15, { font: "serif", style: "bold", color: WHITE }), T([a.title, a.phone, a.email].filter(Boolean).join("  ·  "), 0.5, 10.55, 9.5, { color: b.linen }),
        T([firmLine, eho].join("  ·  "), 0.5, 10.8, 7, { color: [190, 184, 172] }), R(W - 1.4, 10.0, 0.9, 0.9, WHITE), { t: "qr", x: W - 1.35, y: 10.05, size: 0.8, data: qrData(l, a) });
      return { w: W, h: H, sides: [ops.filter(Boolean)] };
    }

    if (S.product === "brochure") {
      const W = 11, H = 8.5, P = W / 3, m = 0.35;
      const out = [], inn = [];
      // Outside: [inside flap | back | cover]
      out.push(R(0, 0, P, H, b.linen), T("About the home", m, 0.75, 15, { font: "serif", style: "bold", color: b.midnight }), L(m, 0.88, m + 0.5, 0.88),
        T(facts(l), m, 1.2, 10, { style: "bold", color: b.midnight, maxW: P - 2 * m }), T(l && l.year ? `Built ${l.year}  ·  ${typeName(l.type || "")}` : "", m, 1.45, 9.5, { color: b.gray }),
        I(m, 1.75, P - 2 * m, 2.6, p[3]), I(m, 4.5, P - 2 * m, 2.6, p[4]), T(l && l.hood ? `${l.hood}, ${l.city || ""}` : "", m, 7.5, 9.5, { color: b.gray, maxW: P - 2 * m }));
      out.push(R(P, 0, P, H, WHITE), { t: "avatar", x: P + P / 2 - 0.6, y: 0.8, size: 1.2, initials: initials(a.name), photo: a.photo }, T(a.name, P + P / 2, 2.45, 16, { font: "serif", style: "bold", color: b.midnight, align: "center" }),
        T(a.title, P + P / 2, 2.7, 9.5, { color: b.gray, align: "center" }), L(P + P / 2 - 0.4, 2.9, P + P / 2 + 0.4, 2.9), T(a.phone, P + P / 2, 3.25, 11, { align: "center" }), T(a.email, P + P / 2, 3.48, 10, { align: "center", color: b.gray }),
        R(P + P / 2 - 0.65, 3.9, 1.3, 1.3, WHITE, { stroke: b.line }), { t: "qr", x: P + P / 2 - 0.6, y: 3.95, size: 1.2, data: qrData(l, a) }, T("Scan for photos and details", P + P / 2, 5.45, 8.5, { align: "center", color: b.gray }),
        ...mark(P + P / 2, 7.25, 14, { align: "center", color: b.midnight, maxW: P - 0.6, minBy: 8 }), T([license(), eho].filter(Boolean).join("  ·  "), P + P / 2, 7.95, 6.5, { align: "center", color: b.gray, maxW: P - 0.5 }));
      out.push(R(2 * P, 0, P, H, b.midnight), I(2 * P, 0, P, 4.9, p[0]), R(2 * P, 4.9, P, 0.04, b.gold), T(head, 2 * P + m, 5.5, 13, { font: "serif", style: "italic", color: b.gold }),
        T(l ? l.address : "", 2 * P + m, 5.95, 17, { font: "serif", style: "bold", color: WHITE, maxW: P - 2 * m, lh: 1.15, maxLines: 2 }), T(l ? money(l.price) : "", 2 * P + m, 6.85, 20, { font: "serif", style: "bold", color: WHITE }),
        S.theme === "open-house" && evLine() ? T(evLine(), 2 * P + m, 7.15, 9.5, { color: b.gold, maxW: P - 2 * m }) : null, ...mark(2 * P + m, 7.75, 12, { dark: true, maxW: P - 2 * m, minBy: 7.5 }));
      // Inside: three panels
      inn.push(R(0, 0, W, H, WHITE), T(S.headline || "Welcome home", m, 0.8, 18, { font: "serif", style: "bold", color: b.midnight }), L(m, 0.95, m + 0.5, 0.95), T(body, m, 1.3, 10, { maxW: P - 2 * m, lh: 1.45, maxLines: 28 }));
      inn.push(I(P + m * 0.5, m, P - m, 3.4, p[1]), T("Home facts", P + m, 4.25, 13, { font: "serif", style: "bold", color: b.midnight }));
      const rows = l ? [["Price", money(l.price)], ["Bedrooms", l.beds], ["Bathrooms", l.baths], ["Living area", l.sqft ? Number(l.sqft).toLocaleString() + " sq ft" : ""], ["Year built", l.year], ["Type", typeName(l.type || "")], ["Neighborhood", l.hood], ["MLS #", l.exclusive ? "" : l.mlsId]].filter(r => r[1] !== "" && r[1] != null) : [];
      rows.forEach((r, i) => { const y = 4.6 + i * 0.36; if (i % 2 === 0) inn.push(R(P + m * 0.5, y - 0.24, P - m, 0.36, b.linen)); inn.push(T(r[0], P + m, y, 9.5, { color: b.gray }), T(String(r[1]), 2 * P - m, y, 9.5, { style: "bold", align: "right" })); });
      inn.push(I(2 * P + m * 0.5, m, P - m, 3.4, p[2]), R(2 * P + m * 0.5, 4.0, P - m, 4.15, b.midnight), T("See it in person", 2 * P + m, 4.6, 16, { font: "serif", style: "bold", color: b.gold }),
        T(`Call or text ${a.name.split(" ")[0]} at ${a.phone} to schedule a private showing.`, 2 * P + m, 5.0, 10.5, { color: WHITE, maxW: P - 2 * m, lh: 1.4 }),
        S.theme === "open-house" && evLine() ? T(`Open house: ${evLine()}`, 2 * P + m, 5.9, 10, { color: b.gold, maxW: P - 2 * m, style: "bold" }) : null,
        T(a.name, 2 * P + m, 7.15, 12, { font: "serif", style: "bold", color: WHITE }), T([a.phone, a.email].filter(Boolean).join("  ·  "), 2 * P + m, 7.4, 8.5, { color: b.linen, maxW: P - 2 * m }), T(a.display, 2 * P + m, 7.65, 8.5, { color: b.linen, style: "bold" }), a.brand ? T(a.byline, 2 * P + m, 7.85, 8, { color: b.linen }) : null,
        { t: "guide", x1: P, y1: 0, x2: P, y2: H }, { t: "guide", x1: 2 * P, y1: 0, x2: 2 * P, y2: H });
      out.push({ t: "guide", x1: P, y1: 0, x2: P, y2: H }, { t: "guide", x1: 2 * P, y1: 0, x2: 2 * P, y2: H });
      return { w: W, h: H, sides: [out.filter(Boolean), inn.filter(Boolean)], sideNames: ["Outside", "Inside"] };
    }

    if (S.product === "postcard") {
      const [W, H] = S.size === "9x6" ? [9, 6] : [6, 4], k = W / 6, m = 0.3 * k;
      const front = [], back = [];
      const listingTheme = usesListing() && l;
      if (p[0].kind !== "blank") front.push(I(0, 0, W, H, p[0])); else front.push(R(0, 0, W, H, b.midnight), ...mountains(0, H * 0.55, W, H * 0.3));
      const bw = W * 0.58, bh = listingTheme ? 1.25 * k : 1.05 * k;
      front.push(R(m, H - m - bh, bw, bh, b.midnight, { opacity: 0.92 }), T(listingTheme ? head : head, m + 0.18 * k, H - m - bh + 0.38 * k, 13 * k, { font: "serif", style: "italic", color: b.gold, maxW: bw - 0.3 * k }));
      if (listingTheme) front.push(T(S.theme === "just-sold" ? l.address : money(l.price), m + 0.18 * k, H - m - bh + 0.72 * k, 17 * k, { font: "serif", style: "bold", color: WHITE }), T(S.theme === "just-sold" ? (l.hood || "") : `${l.address}${l.hood ? ", " + l.hood : ""}`, m + 0.18 * k, H - m - 0.2 * k, 8 * k, { color: b.linen, maxW: bw - 0.3 * k }));
      else front.push(T(a.display, m + 0.18 * k, H - m - 0.25 * k, 10 * k, { style: "bold", color: WHITE }));
      front.push(...mark(W - m, m + 0.24 * k, 12 * k, { dark: true, color: WHITE, align: "right", shadow: true, maxW: W * 0.45, minBy: 7 * k }));
      // Back: left half message, right half kept clear for postage and address.
      const half = W * 0.5;
      const bh2 = T(S.theme === "market" ? "Market update" : head, m + 0.05, m + 0.32 * k, 13 * k, { font: "serif", style: "bold", color: b.midnight, maxW: half - m - 0.2, lh: 1.1, maxLines: 2 });
      back.push(R(0, 0, W, H, WHITE), R(0, 0, 0.12 * k, H, b.gold), bh2);
      let by = m + 0.32 * k + (lines(bh2).length - 1) * lh(bh2) + 0.3 * k;
      if (S.theme === "market") {
        const mk = window.Presentation ? Presentation._t.market() : {}, stats = [[money(mk.median), "Median price"], [`${mk.dom} days`, "Days on market"], [String(mk.monthsSupply), "Months of supply"]];
        const sw = (half - m - 0.25) / 3; stats.forEach((s, i) => { back.push(T(s[0], m + 0.05 + i * sw, by + 0.12 * k, 11 * k, { font: "serif", style: "bold", color: b.midnight }), T(s[1], m + 0.05 + i * sw, by + 0.3 * k, 6 * k, { color: b.gray })); });
        by += 0.55 * k; back.push(T(`${mk.area || "Denver metro"}, ${mk.asOf || ""}. Source: ${mk.source || ""}`, m + 0.05, by + 1.25 * k, 5 * k, { color: b.gray, maxW: half - m - 0.25, lh: 1.25, maxLines: 3 }));
      }
      back.push(T(body, m + 0.05, by, 7.5 * k, { maxW: half - m - 0.25, lh: 1.4, maxLines: S.theme === "market" ? 5 : 8 }));
      back.push(T(a.name, m + 0.05, H - m - 0.62 * k, 10 * k, { font: "serif", style: "bold", color: b.midnight }), T([a.phone, a.email].filter(Boolean).join("  ·  "), m + 0.05, H - m - 0.45 * k, 6.5 * k, { color: b.ink, maxW: half - 0.9 * k }),
        T(a.brand ? `${a.display} · ${a.byline}` : a.firm, m + 0.05, H - m - 0.3 * k, 6.5 * k, { style: "bold", color: b.midnight, maxW: half - 0.9 * k }), { t: "qr", x: half - 0.7 * k, y: H - m - 0.78 * k, size: 0.55 * k, data: qrData(listingTheme ? l : null, a) },
        T([license(), eho, "If your home is listed with another broker, this is not a solicitation."].filter(Boolean).join("  ·  "), m + 0.05, H - 0.12 * k, 4.2 * k, { color: b.gray, maxW: half - m }),
        { t: "guide", box: [half + 0.1, 0.15, W - half - 0.25, H - 0.3], label: "Postage and mailing address (leave blank)" });
      return { w: W, h: H, sides: [front, back], sideNames: ["Front", "Back (address side)"] };
    }

    if (S.product === "mailer") {
      const W = 5, H = 7, m = 0.35, front = [], back = [];
      const title = S.ev.title || (S.theme === "open-house" && l ? l.address : S.theme === "seminar" ? "Your path to homeownership" : S.theme === "appreciation" ? "Client appreciation party" : "Join us");
      front.push(R(0, 0, W, H, b.midnight));
      if (p[0].kind !== "blank") front.push(I(0, 0, W, 3.9, p[0])); else front.push(...mountains(0, 2.6, W, 1.1));
      front.push(R(0, 3.9, W, 0.04, b.gold), T(head, m, 4.5, 15, { font: "serif", style: "italic", color: b.gold }), T(title, m, 5.0, 22, { font: "serif", style: "bold", color: WHITE, maxW: W - 2 * m, lh: 1.1, maxLines: 2 }),
        T(evLine(), m, 5.95, 11, { style: "bold", color: b.linen, maxW: W - 2 * m }), T(S.ev.place || (S.theme === "open-house" && l ? `${l.address}${l.hood ? ", " + l.hood : ""}` : ""), m, 6.2, 10, { color: b.linen, maxW: W - 2 * m }),
        ...mark(m, a.brand ? H - 0.42 : H - 0.3, 11, { dark: true, maxW: W - 2 * m, minBy: 7.5 }));
      back.push(R(0, 0, W, H, WHITE), R(0, 0, W, 0.12, b.gold), T(title, m, 0.75, 16, { font: "serif", style: "bold", color: b.midnight, maxW: W - 2 * m, maxLines: 2 }), L(m, 0.92, m + 0.5, 0.92));
      [["When", evLine()], ["Where", S.ev.place || (l ? `${l.address}${l.hood ? ", " + l.hood : ""}` : "")], ["RSVP", S.ev.rsvp || [a.phone, a.email].filter(Boolean).join(" or ")]].forEach((r, i) => back.push(T(r[0], m, 1.3 + i * 0.42, 8.5, { style: "bold", color: b.gold }), T(r[1] || "To be announced", m + 0.75, 1.3 + i * 0.42, 9.5, { maxW: W - 2 * m - 0.75, maxLines: 2 })));
      back.push(T(body, m, 2.75, 9.5, { maxW: W - 2 * m, lh: 1.45, maxLines: 9 }));
      back.push(R(m, 5.35, W - 2 * m, 1.05, b.linen), T(a.name, m + 0.15, 5.68, 13, { font: "serif", style: "bold", color: b.midnight }), T(a.title, m + 0.15, 5.88, 8.5, { color: b.gray }),
        T([a.phone, a.email].filter(Boolean).join("  ·  "), m + 0.15, 6.1, 8.5, { maxW: W - 2 * m - 1.1 }), T(a.brand ? `${a.display} · ${a.byline}` : a.firm, m + 0.15, 6.3, 8, { style: "bold", color: b.midnight, maxW: W - 2 * m - 1.1 }),
        R(W - m - 0.95, 5.43, 0.9, 0.9, WHITE), { t: "qr", x: W - m - 0.92, y: 5.46, size: 0.84, data: qrData(S.theme === "open-house" ? l : null, a) },
        T([license(), eho].filter(Boolean).join("  ·  "), W / 2, H - 0.2, 6, { color: b.gray, align: "center", maxW: W - 0.5 }));
      return { w: W, h: H, sides: [front.filter(Boolean), back.filter(Boolean)] };
    }

    if (S.product !== "bizcard") return extraDesign({ b, a, l, p, head, body, R, T, I, L, mark, firmLine, eho });
    // Business card
    const W = 3.5, H = 2, light = S.theme === "light", front = [], back = [];
    const tag = S.headline || (a.brand ? a.tagline : "") || (a.brand ? "" : head);
    front.push(R(0, 0, W, H, light ? b.linen : b.midnight), ...mark(W / 2, a.brand ? 0.86 : 0.98, a.brand ? 18 : 20, { dark: !light, color: light ? b.midnight : b.gold, align: "center", maxW: W - 0.5, noBy: true }),
      L(W / 2 - 0.35, a.brand ? 1.08 : 1.13, W / 2 + 0.35, a.brand ? 1.08 : 1.13, b.gold, 0.012), tag ? T(tag, W / 2, a.brand ? 1.3 : 1.38, 7.5, { color: light ? b.gray : b.linen, align: "center", maxW: W - 0.5 }) : null,
      a.brand ? T(a.byline, W / 2, tag ? 1.6 : 1.4, 8.5, { style: "bold", color: light ? b.midnight : WHITE, align: "center" }) : null);
    back.push(R(0, 0, W, H, WHITE), R(0, 0, W, 0.08, b.gold), { t: "avatar", x: 0.22, y: 0.42, size: 0.72, initials: initials(a.name), photo: a.photo },
      T(a.name, 1.1, 0.62, 12.5, { font: "serif", style: "bold", color: b.midnight }), T(a.title, 1.1, 0.8, 7, { color: b.gray }),
      T(a.phone, 1.1, 1.08, 8), T(a.email, 1.1, 1.24, 7.5, { maxW: 1.65 }), a.web && a.web.length <= 34 ? T(a.web, 1.1, 1.4, 7, { color: b.gray }) : null,
      { t: "qr", x: W - 0.82, y: 0.6, size: 0.62, data: a.link }, T(a.brand ? `${a.display} · ${a.byline}` : a.firm, 0.22, H - 0.3, a.brand ? 6.8 : 7.5, { style: "bold", color: b.midnight, maxW: W - 0.44 }),
      T([license(), eho].filter(Boolean).join("  ·  "), 0.22, H - 0.14, 4.6, { color: b.gray, maxW: W - 0.44 }));
    if (S.product === "bizcard") return { w: W, h: H, sides: [front.filter(Boolean), back.filter(Boolean)] };
    return extraDesign({ b, a, l, p, head, body, R, T, I, L, mark, firmLine, eho });
  }
  // Meet your agent, letterhead, open house sign-in, and the kit's brand sheet.
  function extraDesign({ b, a, l, p, head, body, R, T, I, L, mark, firmLine, eho }) {
    const W = 8.5, H = 11, m = 0.6, ops = [], prof = (Store.team || {})[a.id] || Store.site || {};
    const footer = (y = H - 0.75) => [R(0, y, W, H - y, b.midnight), T(a.name, m, y + 0.32, 12, { font: "serif", style: "bold", color: WHITE }), T([a.title, a.phone, a.email].filter(Boolean).join("  ·  "), m, y + 0.52, 8.5, { color: b.linen }),
      T([a.brand ? `${a.display} · ${a.byline}` : a.firm, license(), eho].filter(Boolean).join("  ·  "), W - m, y + 0.52, 7, { color: b.linen, align: "right", maxW: 3.6 })];
    if (S.product === "letterhead") {
      ops.push(R(0, 0, W, 0.12, b.gold), ...mark(m, 0.85, 22, { maxW: 4, minBy: 9, color: b.midnight }), T(a.name, W - m, 0.62, 10.5, { style: "bold", align: "right", color: b.midnight }),
        T([a.title, a.phone, a.email].filter(Boolean).join("\n"), W - m, 0.8, 8.5, { align: "right", color: b.gray, maxW: 3, lh: 1.35 }), L(m, 1.45, W - m, 1.45, b.line, 0.01),
        { t: "guide", box: [m, 1.75, W - 2 * m, 8.3], label: "Letter body" }, L(m, H - 0.75, W - m, H - 0.75, b.line, 0.01),
        T([a.brand ? `${a.display} · ${a.byline}` : a.firm, a.web, license(), eho].filter(Boolean).join("  ·  "), W / 2, H - 0.5, 7.5, { align: "center", color: b.gray, maxW: W - 2 * m }));
      return { w: W, h: H, sides: [ops.filter(Boolean)] };
    }
    if (S.product === "signin") {
      ops.push(R(0, 0, W, 1.25, b.midnight), ...mark(m, 0.55, 18, { dark: true, maxW: 4, minBy: 8.5 }), T("Open house", W - m, 0.58, 20, { font: "serif", style: "italic", color: b.gold, align: "right" }),
        T(l ? l.address : "", W - m, 0.88, 11, { color: WHITE, align: "right", maxW: 4 }), T(evLine() || "Date: ____________________", m, 1.7, 10.5, { style: "bold", color: b.midnight }),
        T("Welcome! Please sign in. Are you working with an agent? Let us know so we can respect that relationship.", m, 1.98, 9.5, { color: b.gray, maxW: W - 2 * m - 1.3 }));
      if (l) ops.push(R(W - m - 1.05, 1.42, 1.05, 1.05, WHITE, { stroke: b.line }), { t: "qr", x: W - m - 1.0, y: 1.47, size: 0.95, data: qrData(l, a) }, T("Photos and details", W - m - 0.52, 2.65, 7, { align: "center", color: b.gray }));
      const cols = [["Name", 2.0], ["Phone", 1.45], ["Email", 2.2], ["Agent?", 0.85], ["Pre-approved?", 0.8]], top = 2.95, rh = 0.42; let x = m;
      ops.push(R(m, top, W - 2 * m, 0.34, b.midnight)); cols.forEach(([h, w]) => { ops.push(T(h, x + 0.08, top + 0.23, 8.5, { style: "bold", color: WHITE })); x += w; });
      for (let i = 0; i < 16; i++) { const y = top + 0.34 + i * rh; if (i % 2) ops.push(R(m, y, W - 2 * m, rh, b.linen)); ops.push(L(m, y + rh, W - m, y + rh, b.line, 0.008)); }
      x = m; cols.slice(0, -1).forEach(([, w]) => { x += w; ops.push(L(x, top + 0.34, x, top + 0.34 + 16 * rh, b.line, 0.008)); });
      ops.push(...footer(H - 0.75), T("We never share your information. Fair Housing applies to every showing.", W / 2, H - 0.88, 7, { align: "center", color: b.gray }));
      return { w: W, h: H, sides: [ops.filter(Boolean)] };
    }
    if (S.product === "brandsheet") {
      const P = b.midnight, A = b.gold;
      ops.push(R(0, 0, W, 2.6, P), ...mark(m, 1.25, 30, { dark: true, maxW: 5.5, minBy: 13 }), a.tagline ? T(a.tagline, m, 2.2, 11, { color: b.linen }) : null,
        T("Brand sheet", m, 3.2, 16, { font: "serif", style: "bold", color: P }), L(m, 3.33, m + 0.5, 3.33, A, 0.02),
        R(m, 3.6, 1.4, 1.0, P), R(m + 1.6, 3.6, 1.4, 1.0, A), R(m + 3.2, 3.6, 1.4, 1.0, b.linen, { stroke: b.line }),
        T("Main  " + hex(P).toUpperCase(), m, 4.85, 8.5, { style: "bold" }), T("Accent  " + hex(A).toUpperCase(), m + 1.6, 4.85, 8.5, { style: "bold" }), T("Light  " + hex(b.linen).toUpperCase(), m + 3.2, 4.85, 8.5, { style: "bold" }),
        T("Type: headlines in a classic serif (Times, Georgia, or similar); everything else in a clean sans serif (Helvetica, Arial).", m, 5.35, 9.5, { maxW: W - 2 * m }),
        T("Using your brand", m, 5.95, 13, { font: "serif", style: "bold", color: P }));
      const rules = [`Every ad, sign, card, post, website page, and email signature includes "${a.firm}" clearly and conspicuously with ${a.brand ? a.display : "your name"}. Colorado Rule 6.10 requires it.`,
        `Keep "${a.brand ? a.byline : "Brokered by " + a.firm}" readable: at least half the size of your business name, and never in the fine print.`,
        "Don’t add Realty, Real estate, Realtors, Company, Inc., LLC, or similar words to your name, and don’t present it as a separate company.",
        "Changing your name, logo, or colors? Submit it in My brand. Materials switch back to The Miller Group brand until your broker approves the change.",
        "Include Equal Housing Opportunity on print pieces, and follow Fair Housing advertising rules in every description.",
        "Only use photos you own or have permission to use. Get the listing broker’s permission before advertising another brokerage’s listing."];
      let y = 6.3; rules.forEach(r => { ops.push({ t: "circle", x: m + 0.06, y: y - 0.04, r: 0.035, fill: A }, T(r, m + 0.22, y, 9.5, { maxW: W - 2 * m - 0.25, lh: 1.35 })); y += 0.62; });
      ops.push(...footer(H - 0.75));
      return { w: W, h: H, sides: [ops.filter(Boolean)] };
    }
    // Meet your agent
    const bio = prof.presBio || prof.bio || `I help buyers and sellers across the Denver metro with clear advice, strong marketing, and steady communication from first call to closing.`;
    const pledge = (prof.presPledge && prof.presPledge.length ? prof.presPledge : ["Clear, honest advice", "Fast, steady communication", "Marketing that gets results", "Service after the sale"]).slice(0, 5);
    const quotes = (prof.testimonials || []).filter(q => q && q.quote).slice(0, 2);
    ops.push(R(0, 0, W, 3.0, b.midnight), ...mark(m, 0.85, 20, { dark: true, maxW: 4, minBy: 9 }), T("Meet your agent", m, 1.75, 12, { font: "serif", style: "italic", color: b.gold }),
      T(a.name, m, 2.25, 30, { font: "serif", style: "bold", color: WHITE }), T([a.title, prof.areas].filter(Boolean).join("  ·  "), m, 2.6, 10.5, { color: b.linen, maxW: 4.6 }),
      { t: "avatar", x: W - m - 2.0, y: 0.5, size: 2.0, initials: initials(a.name), photo: a.photo },
      T("About me", m, 3.65, 14, { font: "serif", style: "bold", color: b.midnight }), L(m, 3.78, m + 0.5, 3.78), T(bio, m, 4.1, 10.5, { maxW: 4.4, lh: 1.5, maxLines: 14 }),
      R(5.35, 3.4, W - 5.35 - m + 0.05, 3.6, b.linen), T("My promise", 5.55, 3.85, 13, { font: "serif", style: "bold", color: b.midnight }));
    pledge.forEach((t, i) => ops.push({ t: "circle", x: 5.62, y: 4.22 + i * 0.52, r: 0.035, fill: b.gold }, T(t, 5.78, 4.26 + i * 0.52, 9.5, { maxW: 2.0, lh: 1.3, maxLines: 2 })));
    ops.push(T("How I help", m, 7.45, 14, { font: "serif", style: "bold", color: b.midnight }), L(m, 7.58, m + 0.5, 7.58));
    [["Selling", "Pricing from real comps, a pre-listing walk-through, pro photos, and a marketing plan built for your home."], ["Buying", "A clear road to closed: financing options, smart offers, and every deadline tracked."], ["Investing", "Rental and value-add analysis, 1031 timing, and the right local partners."]]
      .forEach(([h, t], i) => { const x = m + i * 2.47; ops.push(T(h, x, 7.95, 11, { style: "bold", color: b.gold }), T(t, x, 8.18, 9, { maxW: 2.3, lh: 1.35, maxLines: 5 })); });
    quotes.forEach((q, i) => ops.push(T(`“${q.quote}”`, m + i * 3.15, 9.2, 8.5, { font: "serif", style: "italic", maxW: 2.9, lh: 1.3, maxLines: 5 }), T("— " + [q.name, q.place].filter(Boolean).join(", "), m + i * 3.15, 10.05, 7.5, { color: b.gray, maxW: 2.9 })));
    ops.push(...footer(H - 0.75), R(W - m - 0.95, H - 1.92, 0.95, 0.95, WHITE), { t: "qr", x: W - m - 0.9, y: H - 1.87, size: 0.85, data: a.link });
    return { w: W, h: H, sides: [ops.filter(Boolean)] };
  }
  const initials = n => String(n || "").split(/\s+/).map(s => s[0] || "").join("").slice(0, 2).toUpperCase();
  function qrData(l, a) { return l ? `${IDX.APP_URL}#home=${encodeURIComponent(l.key)}` : a.link; }
  function defaultBody(theme, l, a) {
    const first = a.name.split(" ")[0];
    if (theme === "thinking") return `Homes near you are still selling, and every street is different. If you’ve wondered what yours would sell for today, I’ll put together a free, no-pressure market analysis. Call or text ${first} at ${a.phone}.`;
    if (theme === "market") return `Thinking about a move, or just curious? I’ll walk you through what’s selling on your street and what it means for your home’s value. Call or text ${first} at ${a.phone}.`;
    if (theme === "appreciation") return `Thank you for trusting us with your moves and your referrals. Join us for an evening of food, drinks, and good company. Bring a friend.`;
    if (theme === "seminar") return `A free, no-pressure class on the road from renting to owning: budgets, loan options, Colorado down payment assistance, and how offers work. Bring your questions.`;
    if (theme === "event") return `We’d love to see you there. Details are below.`;
    if (theme === "just-sold") return l ? `We just closed on ${l.address}${l.hood ? " in " + l.hood : ""}. Buyers are still looking in your neighborhood. If you’ve thought about selling, I’d be glad to tell you what your home could sell for.` : "";
    if (theme === "classic" || theme === "light") return "";
    return l ? (l.remarks || `${typeName(l.type || "Home")} in ${l.hood || "a great location"}: ${facts(l)}. Call ${first} at ${a.phone} for a private showing.`) : "";
  }

  /* ------------------------------ Renderers ------------------------------ */
  let measureDoc = null;
  const fontName = f => f === "serif" ? "times" : "helvetica";
  const pdfStyle = s => s === "bold" ? "bold" : s === "italic" ? "italic" : s === "bolditalic" ? "bolditalic" : "normal";
  function lines(o) {
    const txt = clean(o.text || ""); if (!txt) return [];
    if (!o.maxW || !measureDoc) return [txt];
    measureDoc.setFont(fontName(o.font), pdfStyle(o.style)); measureDoc.setFontSize(o.size);
    let ls = measureDoc.splitTextToSize(txt, o.maxW);
    if (o.maxLines && ls.length > o.maxLines) { ls = ls.slice(0, o.maxLines); ls[ls.length - 1] = ls[ls.length - 1].replace(/\s+\S*$/, "") + "..."; }
    return ls;
  }
  const lh = o => o.size / 72 * (o.lh || 1.2);
  function qrMatrix(data) {
    if (!window.qrcode || !data) return null;
    try { const q = window.qrcode(0, "M"); q.addData(data); q.make(); const n = q.getModuleCount(); return { n, dark: (r, c) => q.isDark(r, c) }; } catch (e) { return null; }
  }

  function toSVG(d, side, opts = {}) {
    const k = 72, b = opts.bleedPreview ? 0 : 0, ops = d.sides[side];
    const esc2 = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    const col = c => hex(c);
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${d.w * k} ${d.h * k}" role="img" aria-label="Preview"><defs><clipPath id="psClip"><rect width="${d.w * k}" height="${d.h * k}"/></clipPath></defs><g clip-path="url(#psClip)">`;
    ops.forEach(o => {
      if (o.t === "rect") s += `<rect x="${o.x * k}" y="${o.y * k}" width="${o.w * k}" height="${o.h * k}" fill="${col(o.fill)}"${o.opacity ? ` fill-opacity="${o.opacity}"` : ""}${o.stroke ? ` stroke="${col(o.stroke)}"` : ""}/>`;
      else if (o.t === "logo") s += `<image href="${esc2(o.src)}" x="${o.x * k}" y="${o.y * k}" width="${o.w * k}" height="${o.h * k}" preserveAspectRatio="xMidYMid meet"/>`;
      else if (o.t === "circle") s += `<circle cx="${o.x * k}" cy="${o.y * k}" r="${o.r * k}" fill="${col(o.fill)}"/>`;
      else if (o.t === "line") s += `<line x1="${o.x1 * k}" y1="${o.y1 * k}" x2="${o.x2 * k}" y2="${o.y2 * k}" stroke="${col(o.color)}" stroke-width="${o.w * k}" stroke-linecap="round"/>`;
      else if (o.t === "img") s += svgImage(o, k);
      else if (o.t === "avatar") { const r = o.size / 2 * k, cx = o.x * k + r, cy = o.y * k + r; s += o.photo ? `<clipPath id="av${Math.round(cx)}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath><image href="${esc2(o.photo)}" x="${o.x * k}" y="${o.y * k}" width="${o.size * k}" height="${o.size * k}" preserveAspectRatio="xMidYMid slice" clip-path="url(#av${Math.round(cx)})"/>` : `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${col(B().gold)}"/><text x="${cx}" y="${cy + r * 0.32}" font-family="Times New Roman, Times, serif" font-weight="bold" font-size="${r * 0.9}" fill="#fff" text-anchor="middle">${esc2(o.initials)}</text>`; }
      else if (o.t === "qr") { const m = qrMatrix(o.data); if (m) { const cs = o.size * k / m.n; let path = ""; for (let r = 0; r < m.n; r++) for (let c = 0; c < m.n; c++) if (m.dark(r, c)) path += `M${(o.x * k + c * cs).toFixed(2)} ${(o.y * k + r * cs).toFixed(2)}h${cs.toFixed(2)}v${cs.toFixed(2)}h-${cs.toFixed(2)}z`; s += `<path d="${path}" fill="#141A26"/>`; } else s += `<rect x="${o.x * k}" y="${o.y * k}" width="${o.size * k}" height="${o.size * k}" fill="none" stroke="#999" stroke-dasharray="3 3"/><text x="${(o.x + o.size / 2) * k}" y="${(o.y + o.size / 2) * k}" font-size="${o.size * 9}" text-anchor="middle" fill="#999" font-family="Helvetica">QR</text>`; }
      else if (o.t === "guide" && opts.guides) { if (o.box) { const [x, y, w, h] = o.box; s += `<rect x="${x * k}" y="${y * k}" width="${w * k}" height="${h * k}" fill="none" stroke="#9AA0AA" stroke-dasharray="6 5"/><text x="${(x + w / 2) * k}" y="${(y + h / 2) * k}" font-family="Helvetica" font-size="${Math.max(7, w * 3.2)}" fill="#9AA0AA" text-anchor="middle">${esc2(o.label)}</text>`; } else s += `<line x1="${o.x1 * k}" y1="${o.y1 * k}" x2="${o.x2 * k}" y2="${o.y2 * k}" stroke="#9AA0AA" stroke-dasharray="6 5" stroke-width="1"/>`; }
      else if (o.t === "text") {
        const ls = lines(o); if (!ls.length) return;
        const fam = o.font === "serif" ? "Times New Roman, Times, serif" : "Helvetica, Arial, sans-serif", anchor = o.align === "center" ? "middle" : o.align === "right" ? "end" : "start";
        s += `<text x="${o.x * k}" y="${o.y * k}" font-family="${fam}" font-size="${o.size}" ${/bold/.test(o.style) ? 'font-weight="bold"' : ""} ${/italic/.test(o.style) ? 'font-style="italic"' : ""} fill="${col(o.color)}" text-anchor="${anchor}"${o.shadow ? ' style="paint-order:stroke" stroke="rgba(0,0,0,.35)" stroke-width="2"' : ""}>` +
          ls.map((t, i) => `<tspan x="${o.x * k}" dy="${i ? lh(o) * k : 0}">${esc2(t)}</tspan>`).join("") + `</text>`;
      }
    });
    return s + `</g></svg>`;
  }
  function svgImage(o, k) {
    const ph = o.photo, x = o.x * k, y = o.y * k, w = o.w * k, h = o.h * k;
    if (ph.kind === "url" || ph.kind === "data") return `<image href="${String(ph.src).replace(/"/g, "&quot;")}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"/>`;
    if (ph.kind === "art") { const l = marketingPool().find(p => p.key === ph.src); if (l) return art({ ...l, photos: [] }).replace("<svg ", `<svg x="${x}" y="${y}" width="${w}" height="${h}" `); }
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${hex(B().line)}"/><text x="${x + w / 2}" y="${y + h / 2}" font-family="Helvetica" font-size="${Math.max(8, w / 18)}" fill="#7A7F8A" text-anchor="middle">Add a photo</text>`;
  }

  // Photo → cropped JPEG data URL sized for print (up to 300 dpi). Falls back to null.
  const imgCache = new Map();
  async function photoData(ph, wIn, hIn) {
    if (!ph || ph.kind === "blank") return null;
    const key = ph.kind + ":" + String(ph.src).slice(0, 200) + ":" + wIn.toFixed(2) + "x" + hIn.toFixed(2);
    if (imgCache.has(key)) return imgCache.get(key);
    let out = null;
    try {
      const c = document.createElement("canvas"), g = c.getContext && c.getContext("2d"); if (!g) throw 0;
      let srcUrl;
      if (ph.kind === "art") { const l = marketingPool().find(p => p.key === ph.src); if (!l) return null; srcUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(art({ ...l, photos: [] }).replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" ')); }
      else if (ph.kind === "data") srcUrl = ph.src;
      else { const res = await fetch(ph.src, { mode: "cors" }); if (!res.ok) throw 0; srcUrl = URL.createObjectURL(await res.blob()); }
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; setTimeout(rej, 15000); i.src = srcUrl; });
      const dpi = 300, maxPx = 3300, cw = Math.min(maxPx, Math.round(wIn * dpi)), ch = Math.round(cw * hIn / wIn);
      c.width = cw; c.height = ch;
      const sr = img.width / img.height, dr = cw / ch; let sw = img.width, sh = img.height, sx = 0, sy = 0;
      if (sr > dr) { sw = img.height * dr; sx = (img.width - sw) / 2; } else { sh = img.width / dr; sy = (img.height - sh) / 2; }
      g.fillStyle = "#fff"; g.fillRect(0, 0, cw, ch); g.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
      out = c.toDataURL("image/jpeg", 0.9);
    } catch (e) { out = null; }
    imgCache.set(key, out); return out;
  }

  // Render one or more designs into a single PDF (each design keeps its own page size).
  async function renderPDF(designs, bleed) {
    const jsPDF = await CMAReport.loadPdfLib(); await loadQR();
    const bl = bleed ? 0.125 : 0; let doc = null;
    for (const d of designs) {
      const W = d.w + bl * 2, H = d.h + bl * 2, orient = W > H ? "landscape" : "portrait";
      if (!doc) { doc = new jsPDF({ unit: "in", format: [W, H], orientation: orient }); measureDoc = measureDoc || doc; } else doc.addPage([W, H], orient);
      // Expand anything touching the trim edge into the bleed.
      const grow = o => { if (!bl) return o; const e = 0.001, n = { ...o }; if (o.x <= e) { n.x -= bl; n.w += bl; } if (o.y <= e) { n.y -= bl; n.h += bl; } if (o.x + o.w >= d.w - e) n.w += bl; if (o.y + o.h >= d.h - e) n.h += bl; return n; };
      for (let si = 0; si < d.sides.length; si++) {
        if (si) doc.addPage([W, H], orient);
        for (const o0 of d.sides[si]) await drawOp(doc, (o0.t === "rect" || o0.t === "img") ? grow(o0) : o0, bl);
      }
    }
    return doc;
  }
  async function drawOp(doc, o, bl) {
    const X = v => v + bl;
    if (o.t === "rect") { doc.setFillColor(...o.fill); if (o.opacity && doc.GState) { doc.setGState(new doc.GState({ opacity: o.opacity })); } if (o.stroke) { doc.setDrawColor(...o.stroke); doc.setLineWidth(0.01); } doc.rect(X(o.x), X(o.y), o.w, o.h, o.stroke ? "FD" : "F"); if (o.opacity && doc.GState) doc.setGState(new doc.GState({ opacity: 1 })); }
    else if (o.t === "line") { doc.setDrawColor(...o.color); doc.setLineWidth(o.w); doc.line(X(o.x1), X(o.y1), X(o.x2), X(o.y2)); }
    else if (o.t === "circle") { doc.setFillColor(...o.fill); doc.circle(X(o.x), X(o.y), o.r, "F"); }
    else if (o.t === "logo") { try { doc.addImage(o.src, "PNG", X(o.x), X(o.y), o.w, o.h, undefined, "FAST"); } catch (e) { /* unreadable logo: skip */ } }
    else if (o.t === "img") { const data = await photoData(o.photo, o.w, o.h); if (data) doc.addImage(data, "JPEG", X(o.x), X(o.y), o.w, o.h, undefined, "MEDIUM"); else drawHouse(doc, X(o.x), X(o.y), o.w, o.h); }
    else if (o.t === "avatar") { const r = o.size / 2, cx = X(o.x) + r, cy = X(o.y) + r; const data = o.photo ? await photoData({ kind: "url", src: o.photo }, o.size, o.size) : null;
      if (data) { doc.saveGraphicsState(); doc.circle(cx, cy, r, null); doc.clip(); doc.discardPath(); doc.addImage(data, "JPEG", X(o.x), X(o.y), o.size, o.size); doc.restoreGraphicsState(); }
      else { doc.setFillColor(...B().gold); doc.circle(cx, cy, r, "F"); doc.setFont("times", "bold"); doc.setFontSize(r * 72 * 0.9); doc.setTextColor(255, 255, 255); doc.text(o.initials, cx, cy + r * 0.32, { align: "center" }); } }
    else if (o.t === "qr") { const m = qrMatrix(o.data); if (m) { const cs = o.size / m.n; doc.setFillColor(20, 26, 38); for (let r = 0; r < m.n; r++) for (let c = 0; c < m.n; c++) if (m.dark(r, c)) doc.rect(X(o.x) + c * cs, X(o.y) + r * cs, cs + 0.001, cs + 0.001, "F"); } }
    else if (o.t === "text") { const ls = lines(o); if (!ls.length) return; doc.setFont(fontName(o.font), pdfStyle(o.style)); doc.setFontSize(o.size); doc.setTextColor(...o.color);
      ls.forEach((t, i) => doc.text(t, X(o.x), X(o.y) + i * lh(o), o.align && o.align !== "left" ? { align: o.align } : undefined)); }
  }
  async function buildPDF() {
    await CMAReport.loadPdfLib(); await loadQR();
    if (!measureDoc) { const jsPDF = await CMAReport.loadPdfLib(); measureDoc = new jsPDF({ unit: "in", format: "letter" }); }
    const doc = await renderPDF([design()], S.bleed);
    const l = listing(), prod = PRODUCTS.find(p => p[0] === S.product)[1], who = agent();
    const name = `${who.brand ? who.display + "_" : ""}${prod}${l && usesListing() ? "_" + l.address : ""}${S.bleed ? "_print-ready" : ""}`.replace(/[^\w]+/g, "_").replace(/^_|_$/g, "") + ".pdf";
    return { doc, name, blob: doc.output("blob") };
  }
  // New-agent starter kit: brand sheet, business card, letterhead, meet-your-agent, farming postcard, open house sign-in.
  PS.buildKit = async function (agentId) {
    const jsPDF = await CMAReport.loadPdfLib(); await loadQR(); if (!measureDoc) measureDoc = new jsPDF({ unit: "in", format: "letter" });
    const prevAs = window.AgentBrand ? AgentBrand.as : null; if (window.AgentBrand && agentId) AgentBrand.as = agentId;
    const keep = { ...S, ev: { ...S.ev } }, designs = [];
    try {
      for (const [product, theme, extra] of [["brandsheet", "standard"], ["bizcard", "classic"], ["letterhead", "standard"], ["onepager", "standard"], ["postcard", "thinking", { size: "6x4" }], ["signin", "standard", { key: "" }]]) {
        Object.assign(S, { product, theme, headline: "", body: "", picks: null, ...(extra || {}) }); designs.push(design());
      }
    } finally { Object.assign(S, keep); if (window.AgentBrand) AgentBrand.as = prevAs; }
    const doc = await renderPDF(designs, false), who = (window.AgentBrand ? AgentBrand.current(agentId) : agent());
    return { doc, name: `${String(who.brand ? who.display : who.name).replace(/[^\w]+/g, "_")}_Starter_Marketing_Kit.pdf`, blob: doc.output("blob") };
  };
  function drawHouse(doc, x, y, w, h) {
    const b = B(); doc.setFillColor(...b.linen); doc.rect(x, y, w, h, "F"); const cx = x + w / 2, cy = y + h / 2, s = Math.min(w, h) / 3;
    doc.setDrawColor(...b.gold); doc.setLineWidth(Math.max(0.01, s / 30)); doc.line(cx - s, cy, cx, cy - s * 0.8); doc.line(cx, cy - s * 0.8, cx + s, cy); doc.rect(cx - s * 0.7, cy, s * 1.4, s * 0.8);
  }
  function loadQR() {
    if (window.qrcode) return Promise.resolve();
    return new Promise(res => { const sc = document.createElement("script"); sc.src = QR_SRC; sc.onload = res; sc.onerror = res; document.head.appendChild(sc); });
  }
  async function ensureReady() {
    if (S.ready || S.loading) return; S.loading = true;
    try { const jsPDF = await CMAReport.loadPdfLib(); measureDoc = new jsPDF({ unit: "in", format: "letter" }); await loadQR(); S.ready = true; }
    catch (e) { S.msg = "The designer needs a connection to load. Check your internet and reopen Marketing."; }
    S.loading = false; if (typeof agentPanel !== "undefined" && agentPanel === "marketing") renderAgent();
  }

  /* --------------------------------- UI --------------------------------- */
  PS.html = function () {
    if (!S.ready) { ensureReady(); return `<p class="addr">${S.msg ? esc(S.msg) : "Loading the print studio…"}</p>`; }
    const pool = marketingPool();
    if (!S.key && pool.length) S.key = (typeof mk !== "undefined" && mk.key) || pool[0].key;
    const l = listing(), d = design(), side = Math.min(S.side, d.sides.length - 1), names = d.sideNames || (d.sides.length > 1 ? ["Front", "Back"] : ["Front"]);
    const opt = (list, val) => list.map(([v, t]) => `<option value="${esc(v)}" ${val === v ? "selected" : ""}>${esc(t)}</option>`).join("");
    const photos = photoPool(), picks = S.picks || photos.map(p => p.id), slots = PHOTO_SLOTS[S.product];
    const foreign = l && usesListing() && !l.exclusive && l.office && !/miller/i.test(l.office);
    const who = agent(), bst = window.AgentBrand ? AgentBrand.status(who.id) : { state: "none" };
    let html = `${Store.isBroker && window.AgentBrand ? `<div class="tourform" style="margin-bottom:10px"><label for="psAs">Making materials for</label><select id="psAs" data-ps-as>${Object.entries(Store.team || {}).map(([id, t]) => `<option value="${esc(id)}" ${id === who.id ? "selected" : ""}>${esc(t.name || "Agent")}${AgentBrand.approvedBrand(id) ? ` · ${esc(t.brand.name)}` : ""}</option>`).join("")}</select></div>` : ""}
      <div class="ab-status ${who.brand ? "ok" : ""}"><strong>${who.brand ? `Branded as ${esc(who.display)}` : `Branded as ${esc(who.firm)}`}</strong><span>${who.brand ? esc(who.byline) + " appears on every piece." : bst.state === "pending" ? "Your own brand is waiting for broker approval." : bst.state === "changes" ? "Your broker asked for brand changes." : "Want your own business name front and center?"} <button class="remove" data-panel="agent-brand">My brand</button></span></div>
      <div class="ps-products" role="radiogroup" aria-label="What are you making?">${PRODUCTS.map(([k, t, size]) => `<button class="ps-prod ${S.product === k ? "on" : ""}" role="radio" aria-checked="${S.product === k}" data-ps-product="${k}"><strong>${esc(t)}</strong><span>${esc(size)}</span></button>`).join("")}</div>
      <div class="tourform">
        ${THEMES[S.product].length > 1 ? `<div class="row2"><div><label for="psTheme">${S.product === "bizcard" ? "Style" : "Type"}</label><select id="psTheme" data-ps="theme">${opt(THEMES[S.product], S.theme)}</select></div>` : `<div class="row2" hidden><div></div>`}
        ${S.product === "postcard" ? `<div><label for="psSize">Size</label><select id="psSize" data-ps="size">${opt([["6x4", "6 × 4 in (standard postcard)"], ["9x6", "9 × 6 in (jumbo)"]], S.size)}</select></div>` : "<div></div>"}</div>
        ${usesListing() || (S.product !== "bizcard" && photos.length) ? `<label for="psListing">Listing${usesListing() ? "" : " (for photos, optional)"}</label><select id="psListing" data-ps="key">${opt(pool.map(p => [p.key, `${p.address} · ${short(p.price)}${p.exclusive ? " · Off-market" : ""}`]), S.key)}</select>` : ""}
        ${foreign ? `<p class="note-c">This isn’t a Miller Group listing. You need the listing broker’s permission to advertise it, and their MLS photos usually can’t be used in your marketing.</p>` : ""}
        ${S.product === "mailer" || S.product === "signin" || S.theme === "open-house" ? `<div class="row2"><div><label for="psDate">Date</label><input id="psDate" type="date" data-ps-ev="date" value="${esc(S.ev.date)}"></div><div class="row2"><div><label for="psStart">Start</label><input id="psStart" type="time" data-ps-ev="start" value="${esc(S.ev.start)}"></div><div><label for="psEnd">End</label><input id="psEnd" type="time" data-ps-ev="end" value="${esc(S.ev.end)}"></div></div></div>` : ""}
        ${S.product === "mailer" ? `<label for="psEvTitle">Event name</label><input id="psEvTitle" data-ps-ev="title" placeholder="${S.theme === "open-house" && l ? esc(l.address) : "Client appreciation party"}" value="${esc(S.ev.title)}">
          <div class="row2"><div><label for="psPlace">Where</label><input id="psPlace" data-ps-ev="place" placeholder="Address or venue" value="${esc(S.ev.place)}"></div><div><label for="psRsvp">RSVP</label><input id="psRsvp" data-ps-ev="rsvp" placeholder="By Dec 1 to 303-555-0100" value="${esc(S.ev.rsvp)}"></div></div>` : ""}
        ${["onepager", "letterhead", "signin"].includes(S.product) ? `<p class="addr">${S.product === "onepager" ? "Your bio, promise, and testimonials come from your" : "Your name and contact details come from your"} <button class="remove" data-panel="pres-profile">presentation profile</button>.</p>` : `<label for="psHead">Headline</label><input id="psHead" data-ps="headline" placeholder="${esc(HEADLINES[S.theme] || "")}" value="${esc(S.headline)}">
        ${S.product !== "bizcard" ? `<label for="psBody">Message<button class="remove" type="button" data-ps-ai ${S.busy ? "disabled" : ""}>${S.busy ? "Writing…" : "Write with AI"}</button></label><textarea id="psBody" rows="4" data-ps="body" placeholder="${esc(defaultBody(S.theme, usesListing() ? l : null, agent()).slice(0, 220))}">${esc(S.body)}</textarea>` : `<p class="addr">Your name, title, phone, email, and headshot come from your profile. <button class="remove" data-panel="pres-profile">Edit profile</button></p>`}`}
      </div>`;
    if (slots) {
      html += `<h3 class="agent-h">Photos <span class="addr">${slots === 1 ? "Pick one" : `First pick is the main photo · uses ${slots}`}</span></h3>
        <div class="ps-photos">${photos.map(p => { const n = picks.indexOf(p.id); return `<button class="ps-ph ${n >= 0 ? "on" : ""}" data-ps-photo="${esc(p.id)}" aria-pressed="${n >= 0}" aria-label="${esc(p.label || "Photo")}${n >= 0 ? `, pick ${n + 1}` : ""}">${p.kind === "art" ? (l ? art({ ...l, photos: [] }) : "") : `<img src="${esc(p.src)}" alt="" loading="lazy">`}${n >= 0 ? `<b>${n + 1}</b>` : ""}${p.kind === "data" ? `<i data-ps-unload="${esc(p.id)}" role="button" aria-label="Remove photo">×</i>` : ""}</button>`; }).join("")}
          <label class="ps-ph ps-add"><input type="file" accept="image/jpeg,image/png" multiple data-ps-upload hidden><span>+ Add photos</span></label></div>
        <p class="addr">Use photos you took or have the rights to. Photos you add stay in this session only; add them again next time.${l && !(l.photos || []).length ? " Listing photos appear here once your MLS feed is connected." : ""}</p>`;
    }
    html += `<h3 class="agent-h">Preview ${names.length > 1 ? `<span class="ps-sides">${names.map((n, i) => `<button class="${i === side ? "on" : ""}" data-ps-side="${i}">${esc(n)}</button>`).join("")}</span>` : ""}</h3>
      <div class="ps-preview" style="aspect-ratio:${d.w}/${d.h}">${toSVG(d, side, { guides: true })}</div>
      <p class="addr">${d.w} × ${d.h} in${d.sides.length > 1 ? `, ${d.sides.length} sides` : ""}. Dashed lines show folds and the mailing area; they don’t print.</p>
      <label class="check"><input type="checkbox" data-ps="bleed" ${S.bleed ? "checked" : ""}> Add 1/8 in. bleed for a print shop</label>
      <div class="quick" style="margin-top:10px"><button class="btn gold" data-ps-pdf>Download PDF</button></div>
      ${S.msg ? `<p class="msg" role="status">${esc(S.msg)}</p>` : ""}
      <p class="addr">Proofread before printing. Every piece shows The Miller Group name, as Colorado advertising rules require, and the Equal Housing Opportunity line. Mailed postcards include a not-a-solicitation note for homes listed with another broker. Check postcards against the Do Not Call and mailing preferences your farm list requires.</p>`;
    return html;
  };

  if (!document.getElementById("psStyles")) {
    const st = document.createElement("style"); st.id = "psStyles";
    st.textContent = `.ps-products{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;margin:4px 0 14px}
.ps-prod{text-align:left;background:var(--surface);border:2px solid var(--line);border-radius:12px;padding:10px 12px;color:var(--ink)}.ps-prod strong{display:block;font-size:14px}.ps-prod span{font-size:12px;color:var(--ink-2)}
.ps-prod.on{border-color:var(--gold);box-shadow:0 3px 0 var(--gold-strong)}
.ps-photos{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:8px}
.ps-ph{position:relative;aspect-ratio:4/3;border-radius:10px;overflow:hidden;border:2px solid var(--line);padding:0;background:var(--surface-2);cursor:pointer}
.ps-ph img,.ps-ph svg{width:100%;height:100%;object-fit:cover;display:block}.ps-ph.on{border-color:var(--gold)}
.ps-ph b{position:absolute;top:5px;left:5px;width:22px;height:22px;border-radius:50%;background:var(--gold);color:#fff;font-size:12px;display:grid;place-items:center}
.ps-ph i{position:absolute;top:3px;right:5px;font-style:normal;color:#fff;text-shadow:0 1px 2px #000;font-size:18px}
.ps-add{display:grid;place-items:center;font-size:13px;color:var(--ink-2);border-style:dashed}
.ps-preview{background:var(--surface-2);border:1px solid var(--line);border-radius:6px;overflow:hidden;box-shadow:0 6px 18px rgba(0,0,0,.12)}.ps-preview svg{width:100%;height:100%;display:block}
.ps-sides{display:inline-flex;gap:4px}.ps-sides button{font:600 12px var(--sans);border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:999px;padding:5px 10px}.ps-sides button.on{background:var(--ink);color:var(--bg)}
.mk-tabs{display:flex;gap:6px;margin:4px 0 14px}.mk-tabs button{flex:1;padding:10px;border-radius:10px;border:1px solid var(--line);background:var(--surface);color:var(--ink);font-weight:600}.mk-tabs button.on{background:var(--ink);color:var(--bg)}`;
    document.head.appendChild(st);
  }

  async function writeCopy() {
    const sample = await window.claude?.use?.("sample");
    if (!sample) { S.msg = "AI writing isn’t available in this view."; renderAgent(); return; }
    S.busy = true; S.msg = ""; renderAgent();
    const l = usesListing() ? listing() : null, a = agent(), theme = (THEMES[S.product].find(t => t[0] === S.theme) || [])[1];
    const f = l ? { address: l.address, neighborhood: l.hood, city: l.city, price: money(l.price), beds: l.beds, baths: l.baths, sqft: l.sqft, type: typeName(l.type || ""), year_built: l.year, description: l.remarks } : null;
    const limit = { flyer: 600, brochure: 1100, postcard: 320, mailer: 380 }[S.product] || 300;
    try {
      const out = await sample.json(`You write print marketing for The Miller Group, a Denver real estate brokerage. Agent: ${a.name}, ${a.phone}.
Piece: ${PRODUCTS.find(p => p[0] === S.product)[1]} (${theme}).${S.product === "mailer" || S.theme === "open-house" ? ` Event: ${S.ev.title || ""} ${evLine()} ${S.ev.place || ""}.` : ""}
${f ? `Listing facts (use only these; never invent features, schools, or numbers): ${JSON.stringify(f)}` : "No listing; write general copy for homeowners or clients."}
Rules: follow U.S. Fair Housing advertising rules: describe the home and area, never who should live there; no protected-class references or steering words. Plain, warm, specific language. No exclamation-heavy hype, no emoji. Don't promise values or results. Don't invent dates.
Return only JSON: {"headline": under 40 characters, "body": under ${limit} characters, ending with a clear next step}`);
      if (out && out.body) { S.body = String(out.body); if (out.headline) S.headline = String(out.headline).slice(0, 60); S.msg = "Draft added. Make it sound like you before printing."; }
    } catch (e) { S.msg = e && e.code === "not_granted" ? "AI writing was turned off for this page." : "The copy didn’t come through. Try again."; }
    S.busy = false; renderAgent();
  }
  function resizeUpload(file) {
    return new Promise(res => { const r = new FileReader(); r.onload = () => { const img = new Image(); img.onload = () => { try { const s = Math.min(1, 3000 / Math.max(img.width, img.height)), c = document.createElement("canvas"); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL("image/jpeg", 0.9)); } catch (e) { res(r.result); } }; img.onerror = () => res(null); img.src = r.result; }; r.onerror = () => res(null); r.readAsDataURL(file); });
  }

  document.addEventListener("click", async e => {
    const el = e.target.closest("[data-ps-product],[data-ps-photo],[data-ps-side],[data-ps-pdf],[data-ps-ai],[data-ps-unload],[data-mk-tab]"); if (!el) return; const d = el.dataset;
    if (d.mkTab !== undefined) { PS.tab = d.mkTab; renderAgent(); return; }
    if (d.psUnload !== undefined) { e.stopPropagation(); S.uploads = S.uploads.filter(u => u.id !== d.psUnload); if (S.picks) S.picks = S.picks.filter(x => x !== d.psUnload); renderAgent(); return; }
    if (d.psProduct !== undefined) { S.product = d.psProduct; S.theme = THEMES[S.product][0][0]; S.side = 0; S.headline = ""; S.body = ""; S.msg = ""; renderAgent(); }
    else if (d.psPhoto !== undefined) { const all = photoPool().map(p => p.id), cur = S.picks || all; const i = cur.indexOf(d.psPhoto); S.picks = i >= 0 ? cur.filter(x => x !== d.psPhoto) : [...cur, d.psPhoto]; renderAgent(); }
    else if (d.psSide !== undefined) { S.side = +d.psSide; renderAgent(); }
    else if (d.psAi !== undefined) writeCopy();
    else if (d.psPdf !== undefined) {
      S.msg = "Making the PDF…"; renderAgent();
      try { const { blob, name } = await buildPDF(); await CMAReport.savePDF(blob, name); S.msg = S.bleed ? "PDF ready, with bleed for your print shop." : "PDF ready."; }
      catch (err) { S.msg = (err && err.message) || "The PDF didn’t generate. Try again."; }
      renderAgent();
    }
  });
  document.addEventListener("change", async e => {
    const d = e.target.dataset || {};
    if (d.ps) { const k = d.ps; S[k] = k === "bleed" ? e.target.checked : e.target.value; if (k === "key") { S.picks = null; } if (k === "theme") { S.headline = ""; S.body = ""; } renderAgent(); }
    else if (d.psAs !== undefined && window.AgentBrand) { AgentBrand.as = e.target.value; renderAgent(); }
    else if (d.psEv) { S.ev[d.psEv] = e.target.value; renderAgent(); }
    else if (d.psUpload !== undefined) {
      const files = [...e.target.files].slice(0, 12);
      for (const f of files) { const src = await resizeUpload(f); if (src) { const id = "u" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); S.uploads.push({ id, kind: "data", src, label: f.name }); if (S.picks) S.picks.push(id); } }
      renderAgent();
    }
  });
  PS._t = { design, toSVG, buildPDF, PRODUCTS, THEMES, photoPool, chosen, S };
})();
