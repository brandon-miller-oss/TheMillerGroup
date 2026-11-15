/* =========================================================================
   The Miller Group: agent website and landing page renderer.
   One pure function turns a page (sections + theme + SEO) into a complete
   HTML document. The builder preview, the public page (/p/), the server
   render for search engines (server/api/page.js), and "Download HTML" all
   use it, so what agents see is what visitors and Google get.

   Every page shows the agent's brand with "Brokered by The Miller Group",
   the brokerage in the footer, Equal Housing Opportunity, and (on MLS
   listing cards) the listing brokerage, per Colorado Rule 6.10 and IDX rules.
   ========================================================================= */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SiteRender = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const FONTS = {
    classic: ["Cormorant Garamond", "Inter", "family=Cormorant+Garamond:wght@500;600;700&family=Inter:wght@400;500;600;700"],
    editorial: ["Fraunces", "Figtree", "family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Figtree:wght@400;500;600;700"],
    modern: ["Montserrat", "Inter", "family=Montserrat:wght@600;700;800&family=Inter:wght@400;500;600"],
    friendly: ["DM Serif Display", "DM Sans", "family=DM+Serif+Display&family=DM+Sans:wght@400;500;700"]
  };
  const SECTION_TYPES = [
    ["hero", "Hero banner"], ["featured", "Featured listing"], ["listings", "Listings"], ["about", "About me"], ["services", "Services"], ["stats", "Numbers"],
    ["testimonials", "Testimonials"], ["neighborhoods", "Neighborhoods"], ["gallery", "Photo gallery"], ["video", "Video"], ["text", "Text"], ["faq", "Questions and answers"], ["cta", "Call to action"], ["form", "Lead form"]
  ];

  const e = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const url = u => /^(https:\/\/|data:image\/(png|jpe?g|webp|gif);base64,)/i.test(String(u || "")) ? String(u) : "";
  const money = n => n ? "$" + Math.round(Number(n)).toLocaleString("en-US") : "";
  // Light formatting for body text: paragraphs, **bold**, and "- " bullet lines.
  function md(s) {
    const blocks = String(s || "").trim().split(/\n{2,}/); let out = "";
    for (const b of blocks) {
      const lines = b.split("\n");
      if (lines.every(l => /^\s*[-•]\s+/.test(l))) out += "<ul>" + lines.map(l => `<li>${inline(l.replace(/^\s*[-•]\s+/, ""))}</li>`).join("") + "</ul>";
      else out += `<p>${lines.map(inline).join("<br>")}</p>`;
    }
    return out;
  }
  const inline = s => e(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  const hex = h => /^#[0-9a-f]{6}$/i.test(h || "") ? h : null;
  const ytEmbed = u => { const m = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/.exec(u || ""); if (m) return "https://www.youtube-nocookie.com/embed/" + m[1]; const v = /vimeo\.com\/(\d+)/.exec(u || ""); return v ? "https://player.vimeo.com/video/" + v[1] : ""; };

  function css(t) {
    const [hf, bf] = FONTS[t.font] || FONTS.editorial, r = t.radius === "sharp" ? "4px" : "18px", dark = t.mode === "dark";
    return `:root{--p:${hex(t.primary) || "#141A26"};--a:${hex(t.accent) || "#B8935A"};--bg:${dark ? "#0F1319" : "#FBF8F3"};--surface:${dark ? "#171C24" : "#FFFFFF"};--ink:${dark ? "#F2EEE7" : "#1E222A"};--muted:${dark ? "#A9ADB5" : "#5E6470"};--line:${dark ? "#2A303A" : "#E7E0D4"};--r:${r};--hf:'${hf}',Georgia,serif;--bf:'${bf}',system-ui,-apple-system,Segoe UI,Arial,sans-serif}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--ink);font:400 17px/1.6 var(--bf);-webkit-font-smoothing:antialiased}
img{max-width:100%;display:block}a{color:inherit}h1,h2,h3{font-family:var(--hf);line-height:1.1;margin:0 0 .4em;letter-spacing:-.01em}h1{font-size:clamp(2.3rem,6vw,4.2rem)}h2{font-size:clamp(1.8rem,4vw,2.7rem)}h3{font-size:1.3rem}
.wrap{width:min(1120px,100% - 32px);margin-inline:auto}section{padding:clamp(48px,8vw,96px) 0}section+section{border-top:1px solid var(--line)}
.top{position:sticky;top:0;z-index:5;background:color-mix(in srgb,var(--p) 96%,transparent);color:#fff;backdrop-filter:blur(6px)}
.top .wrap{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 0}.mark{display:flex;flex-direction:column;text-decoration:none;min-width:0}
.mark b{font:700 1.35rem/1.1 var(--hf);color:var(--a);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mark img{max-height:40px;width:auto}.mark small{font-size:.72rem;font-weight:600;letter-spacing:.02em;opacity:.92}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:0 24px;border-radius:999px;background:var(--a);color:#fff;font:600 1rem var(--bf);text-decoration:none;border:0;cursor:pointer}.btn.ghost{background:transparent;border:2px solid currentColor;color:inherit}
.top .btn{min-height:40px;padding:0 18px;font-size:.92rem}.nav{display:flex;gap:18px;font-weight:600;font-size:.95rem}.nav a{text-decoration:none;opacity:.85}.nav a[aria-current],.nav a:hover{opacity:1;text-decoration:underline;text-underline-offset:6px}
.hero{position:relative;color:#fff;background:var(--p);padding:0;border:0}.hero .bgimg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.hero .shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.15),rgba(0,0,0,.6))}
.hero .wrap{position:relative;padding:clamp(90px,16vw,190px) 0 clamp(56px,9vw,110px)}.hero p{font-size:clamp(1.05rem,2vw,1.3rem);max-width:38rem;opacity:.95}.hero .btns{display:flex;flex-wrap:wrap;gap:12px;margin-top:26px}
.hero.split .wrap{display:grid;grid-template-columns:1.1fr .9fr;gap:40px;align-items:center;padding:clamp(56px,9vw,110px) 0}.hero.split img{border-radius:var(--r);aspect-ratio:4/5;object-fit:cover;width:100%}
.eyebrow{font:600 .8rem var(--bf);letter-spacing:.14em;text-transform:uppercase;color:var(--a);margin:0 0 10px}.lede{color:var(--muted);max-width:42rem}
.grid{display:grid;gap:22px;grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr))}.card{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);overflow:hidden}
.card .in{padding:20px 22px}.home img{aspect-ratio:4/3;object-fit:cover;width:100%}.home .price{font:700 1.5rem var(--hf)}.home .meta{color:var(--muted);font-size:.95rem}.home .court{font-size:.75rem;color:var(--muted);margin-top:6px}
.tag{display:inline-block;background:var(--a);color:#fff;border-radius:999px;font-size:.75rem;font-weight:600;padding:3px 10px;margin-bottom:8px}
.about{display:grid;grid-template-columns:.8fr 1.2fr;gap:clamp(28px,6vw,64px);align-items:center}.about img{border-radius:var(--r);aspect-ratio:4/5;object-fit:cover;width:100%}
.initials{aspect-ratio:4/5;border-radius:var(--r);background:var(--p);color:var(--a);display:grid;place-items:center;font:700 5rem var(--hf)}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:18px;text-align:center}.stats b{display:block;font:700 clamp(2rem,5vw,3rem)/1 var(--hf);color:var(--a)}.stats span{color:var(--muted)}
blockquote{margin:0;font:500 1.15rem/1.5 var(--hf)}blockquote+p{color:var(--muted);margin:.8em 0 0;font-size:.95rem}
.feat{display:grid;grid-template-columns:1.25fr .75fr;gap:32px;align-items:start}.feat .pics{display:grid;grid-template-columns:1fr 1fr;gap:10px}.feat .pics img{border-radius:calc(var(--r) / 1.5);aspect-ratio:4/3;object-fit:cover;width:100%}.feat .pics img:first-child{grid-column:1/-1;aspect-ratio:16/10}
.facts{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:18px 0}.facts div{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px;text-align:center}.facts b{display:block;font:700 1.3rem var(--hf)}.facts span{font-size:.8rem;color:var(--muted)}
.gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,260px),1fr));gap:10px}.gallery img{border-radius:calc(var(--r) / 1.5);aspect-ratio:4/3;object-fit:cover;width:100%}
.video{position:relative;aspect-ratio:16/9;border-radius:var(--r);overflow:hidden;background:#000}.video iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
details{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:16px 20px;margin-bottom:10px}summary{font-weight:600;cursor:pointer}
.band{background:var(--p);color:#fff;text-align:center;border:0}.band p{opacity:.92;max-width:40rem;margin:0 auto 22px}
.formwrap{display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:start}form.lead{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:26px;display:grid;gap:14px}
form.lead label{display:grid;gap:6px;font-weight:600;font-size:.92rem}form.lead input,form.lead textarea,form.lead select{font:inherit;padding:12px 14px;border:1px solid var(--line);border-radius:10px;background:var(--bg);color:var(--ink);min-height:48px}
form.lead .fine{font-size:.75rem;color:var(--muted);font-weight:400;line-height:1.45}.hp{position:absolute;left:-9999px}.done{padding:18px;border-radius:12px;background:color-mix(in srgb,var(--a) 15%,var(--surface))}
footer{background:var(--p);color:#fff;padding:44px 0 30px;font-size:.92rem}footer .wrap{display:grid;gap:18px}footer .fm{display:flex;flex-wrap:wrap;justify-content:space-between;gap:20px}footer a{color:#fff}footer .legal{font-size:.78rem;opacity:.85;border-top:1px solid rgba(255,255,255,.18);padding-top:16px}
footer .firm{font:700 1.05rem var(--bf)}.eho{display:inline-flex;align-items:center;gap:6px}
.preview-note{position:fixed;left:12px;bottom:12px;z-index:9;background:#111;color:#fff;font:600 12px var(--bf);padding:6px 10px;border-radius:8px;opacity:.85}
@media (max-width:760px){.nav{display:none}.hero.split .wrap,.about,.feat,.formwrap{grid-template-columns:1fr}.top .btn{display:none}.facts{grid-template-columns:repeat(3,1fr)}}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}`;
  }

  function header(c) {
    const b = c.agent, logo = b.brand && url(b.brand.logoDark), nav = (c.nav || []).filter(n => n && n.href);
    return `<header class="top"><div class="wrap"><a class="mark" href="${nav.length > 1 ? e(nav[0].href) : "#top"}">${logo ? `<img src="${e(logo)}" alt="${e(b.display)}">` : `<b>${e(b.display)}</b>`}${b.byline ? `<small>${e(b.byline)}</small>` : ""}</a>${nav.length > 1 ? `<nav class="nav">${nav.map(n => `<a href="${e(n.href)}"${n.current ? ' aria-current="page"' : ""}>${e(n.title)}</a>`).join("")}</nav>` : ""}
<a class="btn" href="${c.hasForm ? "#contact" : `tel:${e(String(b.phone || "").replace(/[^\d+]/g, ""))}`}">${c.hasForm ? "Get in touch" : e(b.phone || "Call")}</a></div></header>`;
  }
  function footer(c) {
    const b = c.agent, firm = c.firm;
    return `<footer><div class="wrap"><div class="fm"><div><div style="font:700 1.3rem var(--hf);color:var(--a)">${e(b.display)}</div>${b.byline ? `<div class="firm">${e(b.byline)}</div>` : ""}
<div style="margin-top:8px">${e(b.name)}${b.title ? `, ${e(b.title)}` : ""}</div><div>${[b.phone ? `<a href="tel:${e(String(b.phone).replace(/[^\d+]/g, ""))}">${e(b.phone)}</a>` : "", b.email ? `<a href="mailto:${e(b.email)}">${e(b.email)}</a>` : ""].filter(Boolean).join(" · ")}</div></div>
<div>${b.link ? `<a class="btn ghost" href="${e(b.link)}">Search all homes</a>` : ""}</div></div>
<div class="legal">${e(firm)}${c.license ? ` · ${e(c.license)}` : ""} · <span class="eho"><svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2 10h3v10h14V10h3z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 13h8M8 16h8" stroke="currentColor" stroke-width="2"/></svg>Equal Housing Opportunity</span>
${c.siteUrl ? ` · <a href="${e(c.siteUrl)}/privacy-policy.html">Privacy</a> · <a href="${e(c.siteUrl)}/fair-housing-notice.html">Fair Housing notice</a>` : ""}<br>Information deemed reliable but not guaranteed. Listing information is provided for consumers’ personal, non-commercial use.</div></div></footer>`;
  }

  const SEC = {
    hero(s, c) {
      const img = url(s.image), btns = `<div class="btns">${s.cta ? `<a class="btn" href="${s.ctaUrl && url(s.ctaUrl) ? e(s.ctaUrl) : "#contact"}">${e(s.cta)}</a>` : ""}${s.cta2 ? `<a class="btn ghost" href="${c.agent.link ? e(c.agent.link) : "#listings"}">${e(s.cta2)}</a>` : ""}</div>`;
      if (s.style === "split") return `<section class="hero split" id="top"><div class="wrap"><div>${s.eyebrow ? `<p class="eyebrow">${e(s.eyebrow)}</p>` : ""}<h1>${e(s.headline)}</h1><p>${e(s.sub)}</p>${btns}</div>${img ? `<img src="${e(img)}" alt="${e(s.imageAlt || s.headline)}">` : ""}</div></section>`;
      return `<section class="hero" id="top">${img ? `<img class="bgimg" src="${e(img)}" alt="${e(s.imageAlt || "")}"><div class="shade"></div>` : ""}<div class="wrap">${s.eyebrow ? `<p class="eyebrow" style="color:#fff;opacity:.9">${e(s.eyebrow)}</p>` : ""}<h1>${e(s.headline)}</h1><p>${e(s.sub)}</p>${btns}</div></section>`;
    },
    about(s, c) {
      const ph = url(s.photo || c.agent.photo), init = String(c.agent.name || "").split(/\s+/).map(x => x[0] || "").join("").slice(0, 2);
      return `<section id="about"><div class="wrap about">${ph ? `<img src="${e(ph)}" alt="${e(c.agent.name)}">` : `<div class="initials" aria-hidden="true">${e(init)}</div>`}<div><p class="eyebrow">${e(s.eyebrow || "About")}</p><h2>${e(s.heading || `Meet ${c.agent.name}`)}</h2>${md(s.body)}</div></div></section>`;
    },
    listings(s, c) {
      const items = (s.items || []).slice(0, Math.max(1, Math.min(12, s.max || 6)));
      return `<section id="listings"><div class="wrap"><p class="eyebrow">${e(s.eyebrow || "Homes")}</p><h2>${e(s.heading || "Featured homes")}</h2>${s.body ? `<p class="lede">${e(s.body)}</p>` : ""}
<div class="grid" style="margin-top:26px">${items.map(h => `<article class="card home">${url(h.photo) ? `<img src="${e(h.photo)}" alt="${e(h.address)}" loading="lazy">` : `<div style="aspect-ratio:4/3;background:var(--line)"></div>`}<div class="in">${h.status && h.status !== "Active" ? `<span class="tag">${e(h.status)}</span>` : ""}<div class="price">${money(h.price)}</div><div>${e(h.address)}</div><div class="meta">${e([h.beds != null ? h.beds + " bd" : "", h.baths != null ? h.baths + " ba" : "", h.sqft ? Number(h.sqft).toLocaleString() + " sq ft" : "", h.hood].filter(Boolean).join(" · "))}</div>${h.office && !h.exclusive ? `<div class="court">Listing courtesy of ${e(h.office)}</div>` : ""}</div></article>`).join("") || `<p class="lede">New homes coming soon.</p>`}</div>
${c.agent.link ? `<p style="margin-top:26px"><a class="btn" href="${e(c.agent.link)}">See all homes for sale</a></p>` : ""}</div></section>`;
    },
    featured(s, c) {
      const h = s.home || {}, pics = (h.photos || []).map(url).filter(Boolean).slice(0, 5);
      return `<section id="home"><div class="wrap"><p class="eyebrow">${e(s.eyebrow || h.status || "Featured home")}</p><h2>${e(s.heading || h.address)}</h2><p class="lede">${e([h.hood, h.city].filter(Boolean).join(", "))}</p>
<div class="feat" style="margin-top:22px"><div class="pics">${pics.map((p, i) => `<img src="${e(p)}" alt="${e(h.address)} photo ${i + 1}" loading="${i ? "lazy" : "eager"}">`).join("") || `<div style="grid-column:1/-1;aspect-ratio:16/10;border-radius:var(--r);background:var(--line)"></div>`}</div>
<div><div style="font:700 2.2rem var(--hf)">${money(h.price)}</div><div class="facts"><div><b>${e(h.beds ?? "–")}</b><span>Beds</span></div><div><b>${e(h.baths ?? "–")}</b><span>Baths</span></div><div><b>${h.sqft ? Number(h.sqft).toLocaleString() : "–"}</b><span>Sq ft</span></div></div>
${s.event ? `<p class="done"><strong>${e(s.event)}</strong></p>` : ""}${md(s.body || h.remarks)}${h.office && !h.exclusive ? `<p class="court" style="font-size:.8rem;color:var(--muted)">Listing courtesy of ${e(h.office)}</p>` : ""}<p><a class="btn" href="#contact">${e(s.cta || "Schedule a showing")}</a></p></div></div></div></section>`;
    },
    services(s) { return `<section id="services"><div class="wrap"><p class="eyebrow">${e(s.eyebrow || "How I help")}</p><h2>${e(s.heading)}</h2><div class="grid" style="margin-top:26px">${(s.items || []).map(i => `<div class="card"><div class="in"><h3>${e(i.title)}</h3>${md(i.body)}</div></div>`).join("")}</div></div></section>`; },
    stats(s) { return `<section><div class="wrap">${s.heading ? `<h2 style="text-align:center;margin-bottom:30px">${e(s.heading)}</h2>` : ""}<div class="stats">${(s.items || []).map(i => `<div><b>${e(i.value)}</b><span>${e(i.label)}</span></div>`).join("")}</div></div></section>`; },
    testimonials(s) { return `<section id="reviews"><div class="wrap"><p class="eyebrow">${e(s.eyebrow || "Client stories")}</p><h2>${e(s.heading || "What clients say")}</h2><div class="grid" style="margin-top:26px">${(s.items || []).filter(i => i && i.quote).map(i => `<figure class="card" style="margin:0"><div class="in"><blockquote>“${e(i.quote)}”</blockquote><p>${e(i.name)}</p></div></figure>`).join("")}</div></div></section>`; },
    neighborhoods(s) { return `<section id="areas"><div class="wrap"><p class="eyebrow">${e(s.eyebrow || "Where I work")}</p><h2>${e(s.heading)}</h2>${s.body ? `<p class="lede">${e(s.body)}</p>` : ""}<div class="grid" style="margin-top:26px">${(s.items || []).map(i => `<div class="card">${url(i.image) ? `<img src="${e(i.image)}" alt="${e(i.name)}" style="aspect-ratio:3/2;object-fit:cover;width:100%" loading="lazy">` : ""}<div class="in"><h3>${e(i.name)}</h3>${md(i.body)}</div></div>`).join("")}</div></div></section>`; },
    gallery(s) { return `<section><div class="wrap">${s.heading ? `<h2>${e(s.heading)}</h2>` : ""}<div class="gallery" style="margin-top:20px">${(s.images || []).map(url).filter(Boolean).map((p, i) => `<img src="${e(p)}" alt="${e((s.alts || [])[i] || s.heading || "Photo")}" loading="lazy">`).join("")}</div></div></section>`; },
    video(s) { const v = ytEmbed(s.url); return v ? `<section><div class="wrap">${s.heading ? `<h2>${e(s.heading)}</h2>` : ""}<div class="video" style="margin-top:20px"><iframe src="${e(v)}" title="${e(s.heading || "Video")}" allow="encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe></div></div></section>` : ""; },
    text(s) { return `<section><div class="wrap" style="max-width:780px">${s.eyebrow ? `<p class="eyebrow">${e(s.eyebrow)}</p>` : ""}${s.heading ? `<h2>${e(s.heading)}</h2>` : ""}${md(s.body)}</div></section>`; },
    faq(s) { return `<section id="faq"><div class="wrap" style="max-width:820px"><h2>${e(s.heading || "Questions and answers")}</h2><div style="margin-top:20px">${(s.items || []).map(i => `<details><summary>${e(i.q)}</summary>${md(i.a)}</details>`).join("")}</div></div></section>`; },
    cta(s) { return `<section class="band"><div class="wrap"><h2>${e(s.heading)}</h2>${s.body ? `<p>${e(s.body)}</p>` : ""}<a class="btn" href="#contact">${e(s.cta || "Get in touch")}</a></div></section>`; },
    form(s, c) {
      const f = s.fields || {}, purpose = s.purpose || "contact";
      const consent = `By sending this, you agree that ${c.agent.name} of ${c.firm} may contact you by phone, text, or email about your request. Consent isn’t a condition of any purchase. Message and data rates may apply. Reply STOP to opt out of texts.`;
      return `<section id="contact"><div class="wrap formwrap"><div><p class="eyebrow">${e(s.eyebrow || "Let’s talk")}</p><h2>${e(s.heading || "Get in touch")}</h2>${md(s.body)}<p style="margin-top:18px"><strong>${e(c.agent.name)}</strong><br>${e(c.agent.phone || "")}${c.agent.email ? `<br>${e(c.agent.email)}` : ""}</p></div>
<form class="lead" data-purpose="${e(purpose)}" novalidate><label>Name<input name="name" autocomplete="name" required maxlength="200"></label><label>Email<input name="email" type="email" autocomplete="email" required maxlength="320"></label>
${f.phone !== false ? `<label>Phone<input name="phone" type="tel" autocomplete="tel" maxlength="40"></label>` : ""}${f.address || purpose === "valuation" ? `<label>Home address<input name="address" autocomplete="street-address" maxlength="300"></label>` : ""}
${f.guests || purpose === "rsvp" ? `<label>How many guests?<select name="guests"><option>1</option><option>2</option><option>3</option><option>4+</option></select></label>` : ""}${f.message !== false ? `<label>Message<textarea name="message" rows="3" maxlength="2000"></textarea></label>` : ""}
<input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true"><button class="btn" type="submit">${e(s.button || "Send")}</button><p class="fine">${e(consent)}</p><p class="msg" role="status" aria-live="polite"></p></form></div></section>`;
    }
  };

  // JSON-LD for search engines: the agent, the brokerage, and (on listing pages) the home.
  function schema(page, c) {
    const a = c.agent, out = [{ "@context": "https://schema.org", "@type": "RealEstateAgent", name: a.brand ? a.display : a.name, employee: a.brand ? { "@type": "Person", name: a.name } : undefined, telephone: a.phone || undefined, email: a.email || undefined,
      url: c.pageUrl || undefined, parentOrganization: { "@type": "RealEstateAgent", name: c.firm }, areaServed: (page.seo && page.seo.areas) || undefined }];
    const feat = (page.sections || []).find(s => s.type === "featured" && s.home);
    if (feat) { const h = feat.home; out.push({ "@context": "https://schema.org", "@type": "SingleFamilyResidence", name: h.address, address: { "@type": "PostalAddress", streetAddress: h.address, addressLocality: h.city || undefined, addressRegion: "CO" }, numberOfRooms: h.beds || undefined, floorSize: h.sqft ? { "@type": "QuantitativeValue", value: h.sqft, unitCode: "FTK" } : undefined }); }
    const faq = (page.sections || []).find(s => s.type === "faq" && (s.items || []).length);
    if (faq) out.push({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.items.map(i => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: i.a } })) });
    return out.map(o => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}<\/script>`).join("");
  }

  function leadScript(page, c) {
    if (c.preview) return `<script>document.querySelectorAll("form.lead").forEach(f=>f.addEventListener("submit",e=>{e.preventDefault();f.querySelector(".msg").textContent="Preview: forms work once the page is published.";}));<\/script>`;
    const cfg = JSON.stringify({ u: c.supabaseUrl || "", k: c.anonKey || "", agent: c.agent.id, page: page.id, slug: page.slug, thanks: (page.sections || []).find(s => s.type === "form")?.thankYou || "Thank you! I’ll be in touch shortly." }).replace(/</g, "\\u003c");
    return `<script>(function(){var C=${cfg};var q=new URLSearchParams(location.search),utm={};["utm_source","utm_medium","utm_campaign","utm_content","utm_term"].forEach(function(k){if(q.get(k))utm[k]=q.get(k).slice(0,120)});
document.querySelectorAll("form.lead").forEach(function(f){f.addEventListener("submit",function(ev){ev.preventDefault();var m=f.querySelector(".msg"),d=new FormData(f);if(d.get("website"))return;
var name=(d.get("name")||"").trim(),email=(d.get("email")||"").trim();if(!name||!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(email)){m.textContent="Please add your name and a valid email.";return;}
if(!C.u||!C.k){m.textContent="This form isn’t connected yet. Please call or email instead.";return;}var b=f.querySelector("button");b.disabled=true;m.textContent="Sending…";
var msg=[(d.get("message")||"").trim(),d.get("guests")?"Guests: "+d.get("guests"):""].filter(Boolean).join("\\n");
fetch(C.u+"/rest/v1/rpc/submit_agent_lead",{method:"POST",headers:{"Content-Type":"application/json",apikey:C.k,Authorization:"Bearer "+C.k},body:JSON.stringify({p_agent:C.agent,p_page:C.page,p_name:name,p_email:email,p_phone:(d.get("phone")||"").trim()||null,p_address:(d.get("address")||"").trim()||null,p_message:msg||null,p_purpose:f.dataset.purpose,p_utm:utm,p_referrer:document.referrer.slice(0,300)})})
.then(function(r){if(!r.ok)throw 0;f.innerHTML='<div class="done" role="status"><strong>'+C.thanks.replace(/[<>&]/g,"")+'</strong></div>';if(window.gtag)gtag("event","generate_lead",{method:C.slug});if(window.fbq)fbq("track","Lead");})
.catch(function(){b.disabled=false;m.textContent="That didn’t go through. Please try again or call.";});});});})();<\/script>`;
  }

  function render(page, c) {
    page = page || {}; const t = page.theme || {}, f = FONTS[t.font] || FONTS.editorial, seo = page.seo || {};
    const sections = (page.sections || []).filter(s => s && SEC[s.type] && !s.hidden);
    c = { ...c, hasForm: sections.some(s => s.type === "form") };
    const title = seo.title || page.title || c.agent.display, desc = seo.description || "", og = url(seo.image) || url((sections.find(s => s.type === "hero") || {}).image) || "";
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${e(title)}</title><meta name="description" content="${e(desc)}">${seo.noindex || c.preview ? `<meta name="robots" content="noindex">` : ""}${c.pageUrl ? `<link rel="canonical" href="${e(c.pageUrl)}">` : ""}
<meta property="og:type" content="website"><meta property="og:title" content="${e(title)}"><meta property="og:description" content="${e(desc)}">${og ? `<meta property="og:image" content="${e(og)}">` : ""}${c.pageUrl ? `<meta property="og:url" content="${e(c.pageUrl)}">` : ""}<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?${f[2]}&display=swap" rel="stylesheet">
<style>${css(t)}</style>${schema(page, c)}</head><body>${header(c)}<main>${sections.map(s => SEC[s.type](s, c)).join("")}</main>${footer(c)}${c.preview ? `<div class="preview-note">Preview</div>` : ""}${leadScript(page, c)}</body></html>`;
  }

  // SEO checklist with a 0-100 score.
  function seoCheck(page, c) {
    const seo = page.seo || {}, secs = (page.sections || []).filter(s => !s.hidden), text = JSON.stringify(secs).replace(/"(type|id|style|purpose|image|photo|url|ctaUrl)":"[^"]*"/g, " ");
    const words = (text.match(/[A-Za-z]{2,}/g) || []).length, kw = String(seo.keyword || "").trim().toLowerCase();
    const h1 = secs.find(s => s.type === "hero" || s.type === "featured"), imgs = secs.filter(s => (s.type === "hero" && s.image) || s.type === "gallery");
    const checks = [
      ["Title is 30–60 characters", (seo.title || "").length >= 30 && (seo.title || "").length <= 60, 15],
      ["Meta description is 120–160 characters", (seo.description || "").length >= 120 && (seo.description || "").length <= 160, 15],
      ["Focus keyword chosen", !!kw, 10],
      ["Keyword in the title", !!kw && (seo.title || "").toLowerCase().includes(kw), 10],
      ["Keyword in the description", !!kw && (seo.description || "").toLowerCase().includes(kw), 5],
      ["Keyword in the main headline", !!kw && !!h1 && String(h1.headline || h1.heading || (h1.home && h1.home.address) || "").toLowerCase().includes(kw), 10],
      ["At least 300 words of content", words >= 300, 10],
      ["Has a lead form or call to action", secs.some(s => s.type === "form" || s.type === "cta"), 10],
      ["Images have descriptions (alt text)", imgs.every(s => s.type === "hero" ? !!s.imageAlt : (s.alts || []).filter(Boolean).length >= (s.images || []).length), 5],
      ["Has a share image", !!(seo.image || (secs.find(s => s.type === "hero") || {}).image), 5],
      ["Page is set to show in search results", !seo.noindex, 5]
    ];
    const score = checks.reduce((n, x) => n + (x[1] ? x[2] : 0), 0);
    return { score, checks, words };
  }

  // Brand approval signature (must match AgentBrand.sig in agent-brand.js).
  const hash = s => { let h = 5381; s = String(s || ""); for (let i = 0; i < s.length; i++) h = (h * 33 ^ s.charCodeAt(i)) >>> 0; return h.toString(36); };
  const brandSig = b => b ? hash([b.name, b.tagline, b.primary, b.accent, hash(b.logo), hash(b.logoDark)].join("|")) : "";
  // Build the agent block for a public page from the public team doc and the broker's approval record.
  function agentContext(id, team, ok, o = {}) {
    team = team || {}; const b = team.brand, approved = !!(b && b.name && ok && ok.approved && ok.sig === brandSig(b)), firm = o.firm || "The Miller Group";
    return { id, name: team.name || "", title: team.title || "", phone: team.phone || "", email: team.email || "", photo: team.photoUrl || "", slug: team.slug || "",
      brand: approved ? b : null, display: approved ? b.name : firm, byline: approved ? `Brokered by ${firm}` : "", firm,
      link: o.siteUrl && team.slug ? `${o.siteUrl}/search/?agent=${encodeURIComponent(team.slug)}` : "" };
  }
  // Theme defaults from an approved brand.
  const themeFrom = (agent, t = {}) => ({ font: "editorial", radius: "soft", mode: "light", ...t, primary: t.primary || (agent.brand && agent.brand.primary) || "#141A26", accent: t.accent || (agent.brand && agent.brand.accent) || "#B8935A" });

  return { render, seoCheck, agentContext, brandSig, themeFrom, SECTION_TYPES, FONTS, md, escape: e };
});
