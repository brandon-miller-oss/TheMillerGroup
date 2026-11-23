/* Connect your website: for agents who already have their own site.
   Gives each agent their own links, ready-made buttons, embed code for the home search,
   and a lead form that sends inquiries from their site into their contacts here.
   Everything is filled in with the agent's own link name and account. */
(function () {
  const WC = window.WebConnect = {};
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const cfg = () => window.MILLER_CLOUD || {};
  const appUrl = () => (typeof IDX !== "undefined" && IDX.APP_URL) || "";
  const slug = () => (Store.site && Store.site.slug) || "";
  const agentId = () => Store.crmOwner || Store.uid || "";

  WC.links = function () {
    const s = slug(), base = appUrl() + (s ? `?agent=${encodeURIComponent(s)}` : "");
    return { search: base, portal: base + "#portal", embed: appUrl() + `?agent=${encodeURIComponent(s)}&frame=1#search` };
  };
  const btn = (url, label) => `<a href="${url}" target="_blank" rel="noopener" style="display:inline-block;padding:12px 22px;border-radius:999px;background:#141A26;color:#ffffff;font:600 15px/1.2 system-ui,sans-serif;text-decoration:none">${label}</a>`;
  WC.snippets = function () {
    const L = WC.links(), c = cfg(), firm = (typeof IDX !== "undefined" && IDX.BROKER && IDX.BROKER.firm) || "The Miller Group";
    const lead = `<form id="mgLead" style="display:grid;gap:10px;max-width:460px;font:15px/1.4 system-ui,sans-serif">
  <input name="n" placeholder="Name" required style="padding:10px;border:1px solid #bbb;border-radius:8px">
  <input name="e" type="email" placeholder="Email" required style="padding:10px;border:1px solid #bbb;border-radius:8px">
  <input name="p" type="tel" placeholder="Phone (optional)" style="padding:10px;border:1px solid #bbb;border-radius:8px">
  <textarea name="m" rows="4" placeholder="How can I help?" style="padding:10px;border:1px solid #bbb;border-radius:8px"></textarea>
  <button type="submit" style="padding:12px;border:0;border-radius:999px;background:#141A26;color:#fff;font-weight:600">Send</button>
  <small style="color:#555">By sending this, you agree to be contacted about your real estate questions. ${esc(firm)}. Equal Housing Opportunity.</small>
  <p id="mgLeadMsg" role="status" style="margin:0"></p>
</form>
<script>
document.getElementById("mgLead").addEventListener("submit", function (ev) {
  ev.preventDefault(); var f = ev.target, msg = document.getElementById("mgLeadMsg"); msg.textContent = "Sending...";
  fetch("${c.url}/rest/v1/rpc/submit_website_lead", { method: "POST",
    headers: { "Content-Type": "application/json", "apikey": "${c.anonKey}" },
    body: JSON.stringify({ p_agent: "${agentId()}", p_name: f.n.value, p_email: f.e.value, p_phone: f.p.value, p_message: f.m.value, p_page_url: location.href })
  }).then(function (r) { msg.textContent = r.ok ? "Thanks! I'll be in touch soon." : "That didn't send. Please call or email me instead."; if (r.ok) f.reset(); })
    .catch(function () { msg.textContent = "That didn't send. Please call or email me instead."; });
});
<\/script>`;
    return {
      portalBtn: btn(L.portal, "Client login"),
      searchBtn: btn(L.search, "Search homes"),
      embed: `<iframe src="${L.embed}" title="Home search" style="width:100%;height:900px;border:0" loading="lazy"></iframe>`,
      lead
    };
  };

  const block = (id, title, help, code) => `<div class="tourform"><h3 class="agent-h" style="margin-top:0">${title}</h3><p class="addr">${help}</p>
    <textarea id="wc_${id}" readonly rows="${Math.min(12, code.split("\n").length + 1)}" style="width:100%;font:12px/1.4 ui-monospace,monospace">${esc(code)}</textarea>
    <div class="actions"><button class="btn ghost" type="button" data-wccopy="${id}">Copy</button></div></div>`;

  WC.html = function () {
    if (!slug()) return `<div class="empty"><strong>Pick your link name first</strong>Your links and code use your personal link name. Set it in your profile, then come back here.<div class="actions" style="margin-top:12px"><button class="btn gold" data-panel="settings">Open my profile</button></div></div>`;
    const L = WC.links(), S = WC.snippets();
    return `<p class="addr" style="margin-top:0">Use these on a website you already have. Your clients stay tied to you, and inquiries land in your contacts here. You don’t need to use our website builder.</p>
      ${block("portal", "Client login link", "Put this anywhere: your site’s menu, email signature, texts, closing packets. Clients sign in with an emailed link, no password.", L.portal)}
      ${block("search", "Home search link", "Opens your branded home search. Anyone who saves homes or requests a showing from it is assigned to you.", L.search)}
      ${block("buttons", "Buttons for your website", "Paste into an HTML or code block on Wix, Squarespace, WordPress, or any site builder.", S.portalBtn + "\n" + S.searchBtn)}
      ${block("embed", "Home search inside your page", "Shows the search on a page of your site. Signing in and the client portal open in a new tab, because many browsers block sign-ins inside another site’s frame.", S.embed)}
      ${block("lead", "Contact form", "Inquiries go into your contacts here (folder: Website leads) and to the brokerage lead list. Paste into an HTML or code block.", S.lead)}
      <p class="addr">Your site must show the brokerage name (${esc((typeof IDX !== "undefined" && IDX.BROKER.firm) || "The Miller Group")}) in your advertising. The buttons, search, and form already include it where clients see it.</p>`;
  };

  document.addEventListener("click", async e => {
    const b = e.target.closest("[data-wccopy]"); if (!b) return;
    const ta = document.getElementById("wc_" + b.dataset.wccopy); if (!ta) return;
    try { await navigator.clipboard.writeText(ta.value); b.textContent = "Copied"; }
    catch (err) { ta.select(); b.textContent = "Press copy on your keyboard"; }
    setTimeout(() => { b.textContent = "Copy"; }, 2000);
  });
})();
