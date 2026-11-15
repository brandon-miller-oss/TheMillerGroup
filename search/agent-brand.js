/* =========================================================================
   The Miller Group: agent brands ("<Agent business name>, brokered by The
   Miller Group") and the new-agent starter marketing kit.

   - Agents set up a business name, tagline, colors, and logos in My brand.
   - The broker approves each brand (stored at company/brandok/items/<uid>,
     which only the broker can write). Until it's approved, or after it
     changes, materials fall back to The Miller Group brand.
   - Approved brands lead every piece: print studio, presentations, CMA
     reports. "Brokered by The Miller Group" always appears clearly with it.
     (Colorado Rule 6.10: advertising must be clearly and conspicuously in
     the brokerage firm's name; team names can't use Realty, Real estate,
     Realtors, Company, Corp., Inc., LLC, LP, LLP, or imply a separate entity.)
   ========================================================================= */
(function () {
  const AB = window.AgentBrand = { as: null };
  const C = window.MG_CONFIG || {};
  const FIRM = () => (window.IDX && IDX.BROKER && IDX.BROKER.firm) || "The Miller Group";
  const BASE = { midnight: [20, 26, 38], gold: [184, 147, 90], linen: [244, 239, 231], ink: [33, 37, 46], gray: [104, 110, 122], line: [221, 212, 197] };
  const PRESETS = [["Miller midnight and gold", "#141A26", "#B8935A"], ["Forest and brass", "#18302E", "#C99B52"], ["Navy and sky", "#14294B", "#7FB3E0"], ["Charcoal and coral", "#25272C", "#E07A5F"], ["Plum and rose", "#3A1F3D", "#D9A1B4"], ["Slate and sage", "#263238", "#9CB59A"]];
  const BANNED = /\b(realty|real\s*estate|realtors?|company|co\.|corp\.?|corporation|inc\.?|incorporated|llc|l\.l\.c\.?|lp|l\.p\.|llp|ltd\.?|limited|brokerage|brokers?)\b|®/i;

  /* ------------------------------ Colors ------------------------------ */
  const toRGB = h => { const m = /^#?([0-9a-f]{6})$/i.exec(String(h || "").trim()); if (!m) return null; const n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const toHex = c => "#" + c.map(v => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  AB.contrast = contrast;

  /* ------------------------------ Brand state ------------------------------ */
  const team = id => (Store.team || {})[id] || (id === Store.crmOwner ? Store.site || {} : {});
  const hash = s => { let h = 5381; s = String(s || ""); for (let i = 0; i < s.length; i++) h = (h * 33 ^ s.charCodeAt(i)) >>> 0; return h.toString(36); };
  const sig = b => b ? hash([b.name, b.tagline, b.primary, b.accent, hash(b.logo), hash(b.logoDark)].join("|")) : "";
  AB.sig = sig;
  AB.status = function (id) {
    const b = team(id).brand; if (!b || !b.name) return { state: "none", label: "No brand yet" };
    const ok = ((window.Office && Office.brandok) || {})[id];
    if (ok && ok.sig === sig(b) && ok.approved) return { state: "approved", label: "Approved", at: ok.at };
    if (ok && ok.sig === sig(b) && ok.changes) return { state: "changes", label: "Changes requested", note: ok.changes };
    if (b.submittedAt) return { state: "pending", label: "Waiting for broker approval" };
    return { state: "draft", label: "Not submitted yet" };
  };
  AB.validate = function (b) {
    const issues = [], name = String(b.name || "").trim();
    if (!name) issues.push("Add a business name.");
    if (name.length > 40) issues.push("Keep the business name to 40 characters or fewer.");
    if (BANNED.test(name)) issues.push("Colorado doesn’t allow team or business names with words like Realty, Real estate, Realtors, Brokerage, Company, Corp., Inc., LLC, LP, LLP, or anything that suggests a separate company.");
    if (/miller\s*(group|property)/i.test(name)) issues.push("Use your own business name. The Miller Group appears automatically as the brokerage.");
    const p = toRGB(b.primary), a = toRGB(b.accent);
    if (!p || !a) issues.push("Pick two colors.");
    else { if (contrast(p, [255, 255, 255]) < 4.5) issues.push("The main color needs to be darker so white text on it is readable."); if (contrast(a, p) < 3) issues.push("The accent color needs more contrast against the main color."); }
    return issues;
  };
  AB.approvedBrand = id => { const b = team(id).brand; return b && AB.status(id).state === "approved" ? b : null; };
  AB.palette = function (id) {
    const b = AB.approvedBrand(id || AB.who()); if (!b) return { ...BASE };
    const p = toRGB(b.primary), a = toRGB(b.accent);
    return { midnight: p, gold: a, linen: mix([255, 255, 255], a, 0.12).map(Math.round), ink: BASE.ink, gray: BASE.gray, line: mix([255, 255, 255], a, 0.3).map(Math.round) };
  };
  AB.who = () => AB.as && (Store.team || {})[AB.as] ? AB.as : Store.crmOwner;
  // Everything a piece of marketing needs about the agent and brand.
  AB.current = function (id) {
    id = id || AB.who();
    const t = team(id), b = AB.approvedBrand(id), prof = t;
    const link = (window.IDX ? IDX.APP_URL : "") + (t.slug ? `?agent=${encodeURIComponent(t.slug)}` : "");
    return { id, name: t.name || (window.IDX ? IDX.BROKER.name : ""), title: prof.title || "Broker", phone: t.phone || (id === "demo-broker" && window.IDX ? IDX.BROKER.phone : ""), email: t.email || "", slug: t.slug || "", photo: prof.photoUrl || "",
      firm: FIRM(), brand: b, display: b ? b.name : FIRM(), byline: b ? `Brokered by ${FIRM()}` : "", tagline: b ? b.tagline || "" : "", link, web: (C.SITE_URL || "").replace(/^https?:\/\//, "").replace(/\/$/, ""),
      license: C.LICENSE_TEXT && !/\[add/i.test(C.LICENSE_TEXT) ? C.LICENSE_TEXT : "", colors: AB.palette(id) };
  };
  // One line for PDF headers and footers, e.g. "Rivera Homes | Brokered by The Miller Group".
  AB.line = id => { const c = AB.current(id); return c.brand ? `${c.display}  |  ${c.byline}` : c.firm; };

  /* ------------------------------ Logo upload ------------------------------ */
  function readLogo(file, maxPx = 800) {
    return new Promise(res => {
      if (!file || !/^image\/(png|jpeg|svg\+xml|webp)$/.test(file.type) || file.size > 5e6) return res({ error: "Use a PNG, JPG, or SVG under 5 MB." });
      const r = new FileReader(); r.onerror = () => res({ error: "That file couldn’t be read." });
      r.onload = () => { const img = new Image(); img.onerror = () => res({ error: "That image couldn’t be opened." });
        img.onload = () => { try { const w0 = img.naturalWidth || img.width || 600, h0 = img.naturalHeight || img.height || 200, s = Math.min(1, maxPx / Math.max(w0, h0)), c = document.createElement("canvas"); c.width = Math.round(w0 * s); c.height = Math.round(h0 * s); const g = c.getContext("2d"); g.drawImage(img, 0, 0, c.width, c.height);
            // Trim transparent margins so the logo fills its space.
            const px = g.getImageData(0, 0, c.width, c.height).data; let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
            for (let yy = 0; yy < c.height; yy++) for (let xx = 0; xx < c.width; xx++) if (px[(yy * c.width + xx) * 4 + 3] > 8) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; }
            if (x1 >= x0 && y1 >= y0 && (x1 - x0 + 1 < c.width || y1 - y0 + 1 < c.height)) { const t = document.createElement("canvas"); t.width = x1 - x0 + 1; t.height = y1 - y0 + 1; t.getContext("2d").drawImage(c, x0, y0, t.width, t.height, 0, 0, t.width, t.height); return res({ src: t.toDataURL("image/png"), w: t.width, h: t.height }); }
            res({ src: c.toDataURL("image/png"), w: c.width, h: c.height }); } catch (e) { res({ error: "That image couldn’t be processed." }); } };
        img.src = r.result; };
      r.readAsDataURL(file);
    });
  }

  /* ------------------------------ UI ------------------------------ */
  const draft = () => (AB.draft = AB.draft || { ...(team(Store.crmOwner).brand || { name: "", tagline: "", primary: PRESETS[0][1], accent: PRESETS[0][2] }) });
  AB.html = function () {
    const d = draft(), st = AB.status(Store.crmOwner), issues = AB.validate(d), me = AB.current(Store.crmOwner);
    const p = toRGB(d.primary) || BASE.midnight, a = toRGB(d.accent) || BASE.gold;
    const pill = { approved: "ok", pending: "warn", changes: "bad", draft: "", none: "" }[st.state];
    let html = `<p class="addr">Market yourself under your own business name, brokered by ${esc(FIRM())}. Once your broker approves your brand, it leads every flyer, postcard, card, presentation, and CMA you make, and ${esc(FIRM())} appears clearly with it, as Colorado requires.</p>
      <div class="ab-status ${pill}" role="status"><strong>${esc(st.label)}</strong>${st.state === "changes" ? `<span>${esc(st.note)}</span>` : st.state === "approved" ? `<span>Your materials now lead with ${esc(d.name)}.</span>` : st.state === "pending" ? `<span>Materials use the ${esc(FIRM())} brand until it’s approved.</span>` : ""}</div>
      <div class="ab-preview" style="--p:${toHex(p)};--a:${toHex(a)}">
        <div class="ab-card">${d.logoDark ? `<img src="${esc(d.logoDark)}" alt="${esc(d.name)} logo">` : `<b>${esc(d.name || "Your business name")}</b>`}<i>${esc(d.tagline || "Your tagline")}</i><span>Brokered by ${esc(FIRM())}</span></div>
        <div class="ab-card light">${d.logo ? `<img src="${esc(d.logo)}" alt="">` : `<b>${esc(d.name || "Your business name")}</b>`}<span>${esc(me.name)} · ${esc(me.phone)}</span><span class="by">Brokered by ${esc(FIRM())}</span></div></div>
      <div class="tourform">
        <label for="abName">Business name</label><input id="abName" maxlength="40" data-ab="name" value="${esc(d.name || "")}" placeholder="Alex Rivera Homes">
        <label for="abTag">Tagline (optional)</label><input id="abTag" maxlength="60" data-ab="tagline" value="${esc(d.tagline || "")}" placeholder="Highlands to Golden">
        <label>Colors</label><div class="ab-presets">${PRESETS.map(([n, pp, aa]) => `<button type="button" class="ab-sw ${d.primary === pp && d.accent === aa ? "on" : ""}" data-ab-preset="${pp}|${aa}" title="${esc(n)}" aria-label="${esc(n)}"><i style="background:${pp}"></i><i style="background:${aa}"></i></button>`).join("")}</div>
        <div class="row2"><div><label for="abP">Main color</label><input id="abP" type="color" data-ab="primary" value="${esc(toHex(p))}"></div><div><label for="abA">Accent color</label><input id="abA" type="color" data-ab="accent" value="${esc(toHex(a))}"></div></div>
        <div class="row2"><div><label>Logo for light backgrounds</label><label class="btn ghost ab-up">${d.logo ? "Replace" : "Upload"}<input type="file" accept="image/png,image/jpeg,image/svg+xml" data-ab-logo="logo" hidden></label>${d.logo ? ` <button class="remove" data-ab-clear="logo">Remove</button>` : ""}</div>
          <div><label>Logo for dark backgrounds</label><label class="btn ghost ab-up">${d.logoDark ? "Replace" : "Upload"}<input type="file" accept="image/png,image/jpeg,image/svg+xml" data-ab-logo="logoDark" hidden></label>${d.logoDark ? ` <button class="remove" data-ab-clear="logoDark">Remove</button>` : ""}</div></div>
        <p class="addr">No logo? Your business name is set in type. A white or light version of your logo works best on dark backgrounds. Headshot and bio come from your <button class="remove" data-panel="pres-profile">presentation profile</button>.</p>
        ${issues.length ? `<ul class="ab-issues">${issues.map(i => `<li>${esc(i)}</li>`).join("")}</ul>` : ""}
        <div class="quick"><button class="btn gold" data-ab-submit ${issues.length ? "disabled" : ""}>${Store.isBroker ? "Save and approve" : st.state === "approved" ? "Submit changes for approval" : "Submit for approval"}</button></div>
        <p class="msg" id="abMsg" role="status">${esc(AB.msg || "")}</p></div>
      <h3 class="agent-h">Starter marketing kit</h3>
      <p class="addr">Everything a new agent needs, in your ${me.brand ? "brand" : `${esc(FIRM())} brand (your own brand appears once approved)`}: brand sheet, business cards, letterhead, a “meet your agent” one-pager, a farming postcard, and an open house sign-in sheet in one print-ready PDF, plus your email signature and social images.</p>
      <div class="quick"><button class="btn gold" data-ab-kit>Download kit (PDF)</button><button class="btn ghost" data-ab-sig>Copy email signature</button><button class="btn ghost" data-ab-social="square">Profile image</button><button class="btn ghost" data-ab-social="cover">Cover image</button></div>
      <p class="msg" id="abKitMsg" role="status"></p>`;
    if (Store.isBroker) {
      const rows = Object.entries(Store.team || {}).filter(([id, t]) => t && t.brand && t.brand.name);
      html += `<h3 class="agent-h">Agent brands</h3>` + (rows.length ? rows.map(([id, t]) => { const s = AB.status(id), b = t.brand;
        return `<div class="pcard"><div class="pcard-top"><div><strong>${esc(b.name)}</strong><p>${esc(t.name || "Agent")} · ${esc(s.label)}${b.tagline ? ` · ${esc(b.tagline)}` : ""}</p></div><span class="ab-mini" style="--p:${esc(b.primary)};--a:${esc(b.accent)}"><i></i><i></i></span></div>
          ${AB.validate(b).length ? `<p class="note-c">${esc(AB.validate(b).join(" "))}</p>` : ""}
          <div class="links">${s.state !== "approved" ? `<button data-ab-approve="${esc(id)}" ${AB.validate(b).length ? "disabled" : ""}>Approve</button>` : ""}<button data-ab-changes="${esc(id)}">Request changes</button><button data-ab-preview="${esc(id)}">Make materials as ${esc((t.name || "agent").split(" ")[0])}</button></div></div>`; }).join("")
        : `<div class="empty"><strong>No agent brands yet</strong>Agents submit theirs from My brand.</div>`);
      html += `<p class="addr">Before approving, check that the name is on file with the Commission as needed, doesn’t suggest a separate company, and that each agent on a team is with ${esc(FIRM())}.</p>`;
    }
    return html;
  };
  if (!document.getElementById("abStyles")) {
    const st = document.createElement("style"); st.id = "abStyles";
    st.textContent = `.ab-status{border:1px solid var(--line);border-left:4px solid var(--line);border-radius:10px;padding:10px 14px;margin:6px 0 14px;background:var(--surface)}.ab-status span{display:block;font-size:13px;color:var(--ink-2);margin-top:2px}
.ab-status.ok{border-left-color:var(--love)}.ab-status.warn{border-left-color:var(--gold)}.ab-status.bad{border-left-color:var(--pass)}
.ab-preview{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0 0 14px}.ab-card{aspect-ratio:3.5/2;border-radius:8px;background:var(--p);color:var(--a);display:flex;flex-direction:column;justify-content:center;align-items:center;gap:4px;padding:10px;text-align:center;box-shadow:0 4px 14px rgba(0,0,0,.15)}
.ab-card b{font:600 clamp(15px,4.4vw,22px)/1.1 var(--serif)}.ab-card i{font-size:11px;color:#fff;opacity:.85}.ab-card span{font-size:11px;color:#fff}.ab-card img{max-width:80%;max-height:46%;object-fit:contain}
.ab-card.light{background:#fff;color:var(--p);align-items:flex-start;text-align:left}.ab-card.light span{color:#333}.ab-card.light span.by{color:var(--p);font-weight:600}
.ab-presets{display:flex;flex-wrap:wrap;gap:8px;margin:2px 0 10px}.ab-sw{display:flex;border:2px solid var(--line);border-radius:8px;padding:2px;background:var(--surface)}.ab-sw.on{border-color:var(--ink)}.ab-sw i{width:20px;height:20px;border-radius:4px}
.ab-up{display:inline-block;margin-top:4px}.ab-issues{color:var(--pass);font-size:13px;margin:4px 0 10px;padding-left:18px}.ab-mini{display:flex;gap:3px}.ab-mini i{width:16px;height:16px;border-radius:4px;background:var(--p)}.ab-mini i+i{background:var(--a)}`;
    document.head.appendChild(st);
  }

  /* ------------------------------ Kit extras ------------------------------ */
  AB.signatureHTML = function (id) {
    const c = AB.current(id), col = toHex(c.colors.midnight), acc = toHex(c.colors.gold), e = s => String(s || "").replace(/[&<>"]/g, x => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[x]);
    return `<table cellpadding="0" cellspacing="0" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#21252E;line-height:1.45"><tr><td style="border-left:3px solid ${acc};padding-left:12px">
<div style="font-family:Georgia,serif;font-size:17px;font-weight:bold;color:${col}">${e(c.name)}</div><div style="color:#686E7A">${e(c.title)}</div>
${c.brand ? `<div style="font-weight:bold;color:${col};margin-top:4px">${e(c.display)}</div><div style="color:${col}">${e(c.byline)}</div>` : `<div style="font-weight:bold;color:${col};margin-top:4px">${e(c.firm)}</div>`}
<div style="margin-top:4px">${[c.phone, c.email].filter(Boolean).map(e).join(" &nbsp;|&nbsp; ")}</div>${c.link ? `<div><a href="${e(c.link)}" style="color:${col}">Search homes with me</a></div>` : ""}
<div style="font-size:10px;color:#686E7A;margin-top:4px">${e([c.license, "Equal Housing Opportunity"].filter(Boolean).join(" · "))}</div></td></tr></table>`;
  };
  AB.socialSVG = function (kind, id) {
    const c = AB.current(id), P = toHex(c.colors.midnight), A = toHex(c.colors.gold), e = s => String(s || "").replace(/[&<>"]/g, x => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[x]);
    const logo = c.brand && c.brand.logoDark;
    if (kind === "cover") return `<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="500" viewBox="0 0 1500 500"><rect width="1500" height="500" fill="${P}"/><path d="M0 400 L180 300 L300 360 L470 220 L620 340 L760 270 L930 380 L1100 240 L1260 330 L1500 260" fill="none" stroke="${A}" stroke-width="6" stroke-linejoin="round" opacity=".7"/>
${logo ? `<image href="${logo}" x="80" y="80" width="760" height="170" preserveAspectRatio="xMinYMid meet"/>` : `<text x="80" y="200" font-family="Georgia,serif" font-size="96" font-weight="bold" fill="${A}">${e(c.display)}</text>`}
${c.tagline ? `<text x="84" y="268" font-family="Arial,sans-serif" font-size="34" fill="#fff">${e(c.tagline)}</text>` : ""}${c.brand ? `<text x="84" y="${c.tagline ? 318 : 270}" font-family="Arial,sans-serif" font-size="30" font-weight="bold" fill="#fff">${e(c.byline)}</text>` : ""}
<text x="1420" y="450" font-family="Arial,sans-serif" font-size="28" fill="#fff" text-anchor="end">${e([c.name, c.phone].filter(Boolean).join("  ·  "))}</text></svg>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080"><rect width="1080" height="1080" fill="${P}"/><circle cx="540" cy="540" r="470" fill="none" stroke="${A}" stroke-width="10"/>
${logo ? `<image href="${logo}" x="190" y="330" width="700" height="300" preserveAspectRatio="xMidYMid meet"/>` : `<text x="540" y="${c.brand ? 520 : 560}" font-family="Georgia,serif" font-size="${c.display.length > 18 ? 84 : 112}" font-weight="bold" fill="${A}" text-anchor="middle">${e(c.display.length > 24 ? c.display.split(" ").map(w => w[0]).join("") : c.display)}</text>`}
${c.brand ? `<text x="540" y="${logo ? 720 : 620}" font-family="Arial,sans-serif" font-size="40" font-weight="bold" fill="#fff" text-anchor="middle">${e(c.byline)}</text>` : ""}</svg>`;
  };
  async function svgToPng(svg, w, h) {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg); });
    const c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d").drawImage(img, 0, 0, w, h);
    return new Promise(res => c.toBlob(res, "image/png"));
  }
  const saveBlob = (blob, name) => { const u = URL.createObjectURL(blob), a = document.createElement("a"); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); };
  const slug = s => String(s || "Agent").replace(/[^\w]+/g, "_").replace(/^_|_$/g, "");

  /* ------------------------------ Events ------------------------------ */
  const setMsg = (id, t) => { const m = document.getElementById(id); if (m) m.textContent = t; };
  document.addEventListener("input", e => { const k = e.target.dataset && e.target.dataset.ab; if (!k || e.target.type === "color") return; draft()[k] = e.target.value; });
  document.addEventListener("change", async e => {
    const ds = e.target.dataset || {};
    if (ds.ab) { draft()[ds.ab] = e.target.type === "color" ? e.target.value.toUpperCase() : e.target.value.trim(); AB.msg = ""; renderAgent(); }
    else if (ds.abLogo) { const f = e.target.files[0]; const r = await readLogo(f); if (r.error) { AB.msg = r.error; } else { draft()[ds.abLogo] = r.src; draft()[ds.abLogo + "W"] = r.w; draft()[ds.abLogo + "H"] = r.h; AB.msg = ""; } renderAgent(); }
  });
  document.addEventListener("click", async e => {
    const el = e.target.closest("[data-ab-preset],[data-ab-clear],[data-ab-submit],[data-ab-approve],[data-ab-changes],[data-ab-preview],[data-ab-kit],[data-ab-sig],[data-ab-social]"); if (!el) return; const d = el.dataset;
    if (d.abPreset !== undefined) { const [p, a] = d.abPreset.split("|"); Object.assign(draft(), { primary: p, accent: a }); renderAgent(); }
    else if (d.abClear !== undefined) { delete draft()[d.abClear]; renderAgent(); }
    else if (d.abSubmit !== undefined) {
      const b = { ...draft(), name: String(draft().name || "").trim(), tagline: String(draft().tagline || "").trim(), submittedAt: new Date().toISOString() };
      if (AB.validate(b).length) return;
      await Store.saveProfile({ brand: b }); AB.draft = null;
      if (Store.isBroker) approve(Store.crmOwner);
      AB.msg = Store.isBroker ? "Saved and approved." : "Submitted. Your broker will review it."; renderAgent();
    }
    else if (d.abApprove !== undefined) { approve(d.abApprove); renderAgent(); }
    else if (d.abChanges !== undefined) { const note = prompt("What should they change?", ""); if (note) { const b = team(d.abChanges).brand; Office._t.saveCompany("brandok", d.abChanges, { sig: sig(b), changes: note.trim(), at: new Date().toISOString(), by: Store.crmOwner }); renderAgent(); } }
    else if (d.abPreview !== undefined) { AB.as = d.abPreview; if (window.PrintStudio) PrintStudio.state.msg = ""; agentPanel = "marketing"; renderAgent(); window.scrollTo(0, 0); }
    else if (d.abSig !== undefined) {
      const html = AB.signatureHTML(Store.crmOwner);
      try { if (window.ClipboardItem && navigator.clipboard.write) await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([html], { type: "text/plain" }) })]); else await navigator.clipboard.writeText(html); setMsg("abKitMsg", "Signature copied. Paste it into your email signature settings."); }
      catch (err) { prompt("Copy this signature HTML", html); }
    }
    else if (d.abSocial !== undefined) {
      try { const sq = d.abSocial === "square", blob = await svgToPng(AB.socialSVG(d.abSocial, Store.crmOwner), sq ? 1080 : 1500, sq ? 1080 : 500); saveBlob(blob, `${slug(AB.current(Store.crmOwner).display)}_${sq ? "profile" : "cover"}.png`); setMsg("abKitMsg", "Image downloaded."); }
      catch (err) { setMsg("abKitMsg", "The image didn’t generate. Try again."); }
    }
    else if (d.abKit !== undefined) {
      setMsg("abKitMsg", "Building your kit…");
      try { const { blob, name } = await PrintStudio.buildKit(Store.crmOwner); await CMAReport.savePDF(blob, name); setMsg("abKitMsg", "Kit ready. Use the bleed version for print shops; each piece is on its own page size."); }
      catch (err) { setMsg("abKitMsg", (err && err.message) || "The kit didn’t generate. Try again."); }
    }
  });
  function approve(id) { const b = team(id).brand; if (!b) return; Office._t.saveCompany("brandok", id, { sig: sig(b), approved: true, name: b.name, at: new Date().toISOString(), by: Store.crmOwner }); }

  AB.seedDemo = function () {
    if (!Store.team || !Store.team["demo-agent"]) return;
    Store.team["demo-agent"].brand = { name: "Alex Rivera Homes", tagline: "Highlands to Golden", primary: "#18302E", accent: "#C99B52", submittedAt: new Date().toISOString() };
    if (window.Office) { Office.brandok = Office.brandok || {}; Office.brandok["demo-agent"] = { sig: sig(Store.team["demo-agent"].brand), approved: true, name: "Alex Rivera Homes", at: new Date().toISOString(), by: "demo-broker" }; }
  };
  AB._t = { BANNED, PRESETS, toRGB, readLogo };
  if (typeof Store !== "undefined" && Store.demo) AB.seedDemo();
})();
