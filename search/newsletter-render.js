/* =========================================================================
   The Miller Group: agent newsletter email (shared by the app preview and
   the server; server/lib/newsletter-render.js is a copy).
   render(issue) -> { subject, preheader, html, text }
   Email-safe HTML: 600px table layout, inline styles, web-safe fonts.
   Personalization tokens filled per recipient by the server:
   {{first_name}}, {{unsubscribe_url}}.
   Every issue includes the agent's brand with "Brokered by The Miller Group",
   the brokerage line, Equal Housing Opportunity, a physical mailing address,
   and an unsubscribe link (CAN-SPAM; Colorado Rule 6.10).
   ========================================================================= */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.NewsletterRender = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const e = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const okUrl = u => /^https:\/\//i.test(String(u || "")) ? String(u) : "";
  const money = n => n ? "$" + Math.round(Number(n)).toLocaleString("en-US") : "";
  const hex = h => /^#[0-9a-f]{6}$/i.test(h || "") ? h : null;
  const day = d => d ? new Date(String(d).slice(0, 10) + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }) : "";
  const time = t => { if (!/^\d{2}:\d{2}/.test(t || "")) return ""; let [h, m] = t.split(":").map(Number); const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12; return `${h}:${String(m).padStart(2, "0")} ${ap}`; };
  const paras = s => String(s || "").trim().split(/\n{2,}/).filter(Boolean);

  // Rank approved news for an agent: newest first, boosted when it mentions the agent's areas.
  function pickNews(items, areas, n) {
    const ar = (areas || []).map(a => String(a).toLowerCase()).filter(Boolean), nowT = Date.now();
    return (items || []).filter(x => x && x.title && okUrl(x.url)).map(x => {
      const txt = `${x.title} ${x.summary} ${(x.tags || []).join(" ")}`.toLowerCase(), age = (nowT - new Date(x.date || x.addedAt || 0).getTime()) / 864e5;
      return { x, s: (ar.some(a => txt.includes(a)) ? 10 : 0) + (/colorado|denver|front range/.test(txt) ? 3 : 0) - Math.min(30, Math.max(0, age)) / 3 };
    }).sort((a, b) => b.s - a.s).slice(0, n || 4).map(o => o.x);
  }

  function render(I) {
    const a = I.agent || {}, P = hex(a.primary) || "#141A26", A = hex(a.accent) || "#B8935A", firm = a.firm || "The Miller Group";
    const display = a.display || firm, byline = a.byline || "";
    const subject = String(I.subject || `${display}: ${I.monthLabel || "Your real estate update"}`).slice(0, 150);
    const pre = String(I.preheader || "").slice(0, 140);
    const m = I.market, news = (I.news || []).filter(n => n && okUrl(n.url)), homes = I.listings || [], oh = I.openHouses || [], ev = I.events || [];
    const W = "font-family:Helvetica,Arial,sans-serif;", H = "font-family:Georgia,'Times New Roman',serif;";
    const sec = (title, inner) => `<tr><td style="padding:28px 32px 4px"><h2 style="${H}font-size:22px;line-height:1.2;color:${P};margin:0 0 4px">${e(title)}</h2><div style="width:40px;height:2px;background:${A};margin:0 0 14px"></div>${inner}</td></tr>`;
    const btn = (label, url) => okUrl(url) ? `<a href="${e(url)}" style="${W}display:inline-block;background:${A};color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 22px;border-radius:24px">${e(label)}</a>` : "";
    let body = "";
    body += `<tr><td style="padding:28px 32px 0;${W}font-size:16px;line-height:1.6;color:#21252E">${paras(I.intro || "Hi {{first_name}},").map(p => `<p style="margin:0 0 14px">${e(p).replace(/\n/g, "<br>")}</p>`).join("")}</td></tr>`;
    if (m && m.median) body += sec(`The market${m.area ? " in " + m.area : ""}`, `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${[[money(m.median), "Median price"], [`${m.dom} days`, "Median days on market"], [String(m.monthsSupply), "Months of supply"], [`${m.rate}%`, "30-year rate"]].filter(x => x[0] && !/undefined/.test(x[0])).map(x => `<td align="center" style="padding:8px 4px;background:#F6F2EB;border:4px solid #ffffff"><div style="${H}font-size:20px;font-weight:bold;color:${P}">${e(x[0])}</div><div style="${W}font-size:11px;color:#686E7A">${e(x[1])}</div></td>`).join("")}</tr></table>
      ${m.note ? `<p style="${W}font-size:15px;line-height:1.55;color:#21252E;margin:12px 0 0">${e(m.note)}</p>` : ""}<p style="${W}font-size:11px;color:#8A8F99;margin:8px 0 0">${e(m.asOf || "")}${m.source ? " · Source: " + e(m.source) : ""}</p>`);
    if (news.length) body += sec("Colorado real estate news", news.map(n => `<div style="margin:0 0 16px"><a href="${e(n.url)}" style="${H}font-size:17px;font-weight:bold;color:${P};text-decoration:none">${e(n.title)}</a><div style="${W}font-size:12px;color:#8A8F99;margin:2px 0 4px">${e([n.source, day(n.date)].filter(Boolean).join(" · "))}</div><div style="${W}font-size:15px;line-height:1.55;color:#21252E">${e(n.summary)}</div></div>`).join(""));
    if (homes.length) body += sec(homes.length === 1 ? "My featured listing" : "My current listings", homes.slice(0, 6).map(h => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;border:1px solid #E7E0D4;border-radius:10px;overflow:hidden">${okUrl(h.photo) ? `<tr><td><a href="${e(okUrl(h.url) || "#")}"><img src="${e(h.photo)}" width="536" alt="${e(h.address)}" style="display:block;width:100%;max-width:536px;height:auto;border:0"></a></td></tr>` : ""}
      <tr><td style="padding:12px 16px"><div style="${H}font-size:20px;font-weight:bold;color:${P}">${money(h.price)}${h.status && h.status !== "Active" ? ` <span style="${W}font-size:11px;font-weight:bold;color:#ffffff;background:${A};border-radius:10px;padding:2px 8px;vertical-align:middle">${e(h.status)}</span>` : ""}</div><div style="${W}font-size:15px;color:#21252E">${e(h.address)}</div><div style="${W}font-size:13px;color:#686E7A">${e([h.beds != null ? h.beds + " bd" : "", h.baths != null ? h.baths + " ba" : "", h.sqft ? Number(h.sqft).toLocaleString() + " sq ft" : "", h.hood].filter(Boolean).join(" · "))}</div>${okUrl(h.url) ? `<div style="margin-top:8px"><a href="${e(h.url)}" style="${W}font-size:14px;color:${P};font-weight:bold">See photos and details →</a></div>` : ""}</td></tr></table>`).join(""));
    if (oh.length) body += sec("Open houses", oh.map(o => `<div style="${W}font-size:15px;line-height:1.5;color:#21252E;margin:0 0 10px"><strong style="color:${P}">${e(day(o.date))}${o.start ? ", " + e(time(o.start)) + (o.end ? "–" + e(time(o.end)) : "") : ""}</strong><br>${e(o.address)}${o.price ? " · " + money(o.price) : ""}${okUrl(o.url) ? ` · <a href="${e(o.url)}" style="color:${P}">Details</a>` : ""}</div>`).join(""));
    if (ev.length) body += sec("Events", ev.map(x => `<div style="${W}font-size:15px;line-height:1.5;color:#21252E;margin:0 0 12px"><strong style="color:${P}">${e(x.title)}</strong><br>${e([day(x.date), x.time ? time(x.time) : "", x.place].filter(Boolean).join(" · "))}${x.details ? `<br>${e(x.details)}` : ""}${okUrl(x.url) ? `<br><a href="${e(x.url)}" style="color:${P};font-weight:bold">RSVP →</a>` : ""}</div>`).join(""));
    if (I.cta && okUrl(I.cta.url)) body += `<tr><td align="center" style="padding:20px 32px 4px">${btn(I.cta.label || "Search homes", I.cta.url)}</td></tr>`;
    body += `<tr><td style="padding:26px 32px"><table role="presentation" cellpadding="0" cellspacing="0"><tr>${okUrl(a.photo) ? `<td valign="top" style="padding-right:14px"><img src="${e(a.photo)}" width="64" height="64" alt="${e(a.name)}" style="display:block;border-radius:32px;border:0"></td>` : ""}
      <td style="${W}font-size:14px;line-height:1.5;color:#21252E"><strong style="${H}font-size:17px;color:${P}">${e(a.name)}</strong><br>${e(a.title || "")}${a.title ? "<br>" : ""}${a.phone ? `<a href="tel:${e(String(a.phone).replace(/[^\d+]/g, ""))}" style="color:${P}">${e(a.phone)}</a>` : ""}${a.phone && a.email ? " · " : ""}${a.email ? `<a href="mailto:${e(a.email)}" style="color:${P}">${e(a.email)}</a>` : ""}</td></tr></table></td></tr>`;
    const head = okUrl(a.logoDark) ? `<img src="${e(a.logoDark)}" alt="${e(display)}" height="44" style="display:block;height:44px;width:auto;border:0">` : `<div style="${H}font-size:26px;font-weight:bold;color:${A}">${e(display)}</div>`;
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${e(subject)}</title></head>
<body style="margin:0;padding:0;background:#EFEAE2">${pre ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${e(pre)}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EFEAE2"><tr><td align="center" style="padding:20px 10px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="background:${P};padding:22px 32px">${head}${byline ? `<div style="${W}font-size:12px;font-weight:bold;color:#ffffff;margin-top:4px">${e(byline)}</div>` : ""}${I.monthLabel ? `<div style="${W}font-size:12px;color:#E8E2D8;margin-top:8px;letter-spacing:.08em;text-transform:uppercase">${e(I.monthLabel)}</div>` : ""}</td></tr>
${body}
<tr><td style="background:#F6F2EB;padding:20px 32px;${W}font-size:11px;line-height:1.6;color:#686E7A">
${e(display)}${byline ? " · " + e(byline) : ""}${I.license ? " · " + e(I.license) : ""} · Equal Housing Opportunity<br>${e(I.address || "[Add the brokerage mailing address before sending]")}<br>
You’re getting this because you’re a client or contact of ${e(a.name || display)}. If your home is listed with another broker, this isn’t a solicitation.<br>
<a href="{{unsubscribe_url}}" style="color:#686E7A">Unsubscribe</a> · News summaries link to their original sources. Information deemed reliable but not guaranteed.</td></tr>
</table></td></tr></table></body></html>`;
    // Plain-text version
    const L = [];
    L.push(`${display}${byline ? " | " + byline : ""}${I.monthLabel ? " | " + I.monthLabel : ""}`, "", String(I.intro || "Hi {{first_name}},"));
    if (m && m.median) L.push("", `THE MARKET${m.area ? " IN " + m.area.toUpperCase() : ""}`, `Median price ${money(m.median)} · ${m.dom} days on market · ${m.monthsSupply} months of supply · ${m.rate}% rate`, m.note || "", `${m.asOf || ""}${m.source ? " · Source: " + m.source : ""}`);
    if (news.length) { L.push("", "COLORADO REAL ESTATE NEWS"); news.forEach(n => L.push(`- ${n.title} (${[n.source, day(n.date)].filter(Boolean).join(", ")})`, `  ${n.summary}`, `  ${n.url}`)); }
    if (homes.length) { L.push("", "MY LISTINGS"); homes.slice(0, 6).forEach(h => L.push(`- ${money(h.price)} · ${h.address}${h.url ? " · " + h.url : ""}`)); }
    if (oh.length) { L.push("", "OPEN HOUSES"); oh.forEach(o => L.push(`- ${day(o.date)}${o.start ? " " + time(o.start) : ""}: ${o.address}`)); }
    if (ev.length) { L.push("", "EVENTS"); ev.forEach(x => L.push(`- ${x.title}: ${[day(x.date), x.time ? time(x.time) : "", x.place].filter(Boolean).join(", ")}${x.url ? " · " + x.url : ""}`)); }
    if (I.cta && okUrl(I.cta.url)) L.push("", `${I.cta.label || "Search homes"}: ${I.cta.url}`);
    L.push("", `${a.name}${a.title ? ", " + a.title : ""}`, [a.phone, a.email].filter(Boolean).join(" · "), "", `${display}${byline ? " | " + byline : ""}${I.license ? " | " + I.license : ""} | Equal Housing Opportunity`, I.address || "", "Unsubscribe: {{unsubscribe_url}}");
    return { subject, preheader: pre, html, text: L.filter(x => x != null).join("\n").replace(/\n{3,}/g, "\n\n") };
  }
  // Fill per-recipient tokens.
  const personalize = (s, v, html) => String(s).replace(/\{\{first_name\}\}/g, html ? e(v.first_name || "there") : (v.first_name || "there")).replace(/\{\{unsubscribe_url\}\}/g, html ? e(v.unsubscribe_url || "#") : (v.unsubscribe_url || "#"));
  return { render, personalize, pickNews };
});
