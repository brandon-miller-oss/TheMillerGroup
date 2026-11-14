/* The Miller Group — cloud adapter for the website's home search and agent tools.
   Gives the app the same storage, sign-in, download, and AI interface it uses on claude.ai,
   backed by Supabase and your /api/ai function. Load after supabase-js and before the app script. */
(function () {
  const cfg = window.MILLER_CLOUD || {};
  let sb = null, session = null, agentFlag = null;

  const ready = (async () => {
    if (!cfg.url || !cfg.anonKey || !window.supabase) return;
    sb = window.supabase.createClient(cfg.url, cfg.anonKey, { auth: { persistSession: true, detectSessionInUrl: true } });
    const { data } = await sb.auth.getSession();
    session = data.session;
    sb.auth.onAuthStateChange((evt, s) => {
      const before = session && session.user ? session.user.id : null;
      const after = s && s.user ? s.user.id : null;
      session = s;
      if (evt !== "INITIAL_SESSION" && before !== after) location.reload();
    });
  })();

  const parentOf = p => p.split("/").slice(0, -1).join("/");
  const idOf = p => p.split("/").pop();
  const snap = row => ({ id: idOf(row.path), exists: true, data: () => row.data, metadata: {} });
  const fail = (code, e) => ({ code, message: String((e && e.message) || e) });
  const deepMerge = (a, b) => {
    const out = { ...(a || {}) };
    for (const [k, v] of Object.entries(b || {})) {
      const plain = x => x && typeof x === "object" && !Array.isArray(x);
      out[k] = plain(v) && plain(out[k]) ? deepMerge(out[k], v) : v;
    }
    return out;
  };

  let n = 0;
  function watch(filter, refetch) {
    const ch = sb.channel("miller-" + (++n))
      .on("postgres_changes", { event: "*", schema: "public", table: "docs", filter }, () => refetch())
      .subscribe();
    return () => sb.removeChannel(ch);
  }

  async function fetchCol(path, opts) {
    const { data, error } = await sb.from("docs").select("path,data").eq("parent", path);
    if (error) throw error;
    let docs = data.map(snap);
    if (opts.order) {
      const { f, dir } = opts.order;
      docs.sort((a, b) => {
        const x = a.data()[f], y = b.data()[f];
        const c = x == null ? 1 : y == null ? -1 : x > y ? 1 : x < y ? -1 : 0;
        return dir === "desc" ? -c : c;
      });
    } else docs.sort((a, b) => a.id.localeCompare(b.id));
    if (opts.limit) docs = docs.slice(0, opts.limit);
    return docs;
  }
  const qsnap = docs => ({ docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: {} });

  function query(path, opts = {}) {
    return {
      path,
      orderBy(f, dir = "asc") { return query(path, { ...opts, order: { f, dir } }); },
      limit(l) { return query(path, { ...opts, limit: l }); },
      where() { return query(path, opts); },
      doc(id) { return docRef(path + "/" + id); },
      async get() { return qsnap(await fetchCol(path, opts)); },
      onSnapshot(next, err) {
        let live = true;
        const run = () => fetchCol(path, opts).then(d => { if (live) next(qsnap(d)); }).catch(e => err && err(fail("unavailable", e)));
        run();
        const un = watch(`parent=eq.${path}`, run);
        return () => { live = false; un(); };
      }
    };
  }

  function docRef(path) {
    const get = async () => {
      const { data, error } = await sb.from("docs").select("path,data").eq("path", path).maybeSingle();
      if (error) throw fail("unavailable", error);
      return data ? snap(data) : { id: idOf(path), exists: false, data: () => undefined, metadata: {} };
    };
    return {
      id: idOf(path), path, get,
      async set(obj) {
        const { error } = await sb.from("docs").upsert({ path, parent: parentOf(path), data: obj, updated_at: new Date().toISOString() });
        if (error) throw fail("permission_denied", error);
      },
      async update(obj) {
        const cur = await get();
        if (!cur.exists) throw fail("invalid_argument", "Document does not exist");
        const { error } = await sb.from("docs").update({ data: deepMerge(cur.data(), obj), updated_at: new Date().toISOString() }).eq("path", path);
        if (error) throw fail("permission_denied", error);
      },
      async delete() {
        const { error } = await sb.from("docs").delete().eq("path", path);
        if (error) throw fail("permission_denied", error);
      },
      collection(sub) { return query(path + "/" + sub); },
      onSnapshot(next, err) {
        let live = true;
        const run = () => get().then(s => { if (live) next(s); }).catch(e => err && err(e));
        run();
        const un = watch(`path=eq.${path}`, run);
        return () => { live = false; un(); };
      },
      async acquire() { return { acquired: true }; }
    };
  }

  const db = { collection: p => query(p), doc: p => docRef(p) };

  const user = {
    async id() { await ready; return session && session.user ? session.user.id : null; },
    async canEdit() {
      await ready;
      if (!session) return false;
      if (agentFlag === null) { const { data } = await sb.rpc("is_agent"); agentFlag = !!data; }
      return agentFlag;
    },
    async isOwner() { return this.canEdit(); },
    async can() { return this.canEdit(); },
    async me() { await ready; return { id: session && session.user ? session.user.id : null, name: "", email: session && session.user ? session.user.email : null }; },
    async name() { return ""; },
    async profiles(ids) { return Object.fromEntries([].concat(ids).map(i => [i, { id: i, name: "" }])); }
  };

  const downloads = {
    async save({ filename, data }) {
      const blob = data instanceof Blob ? data : new Blob([data]);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = filename;
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      return { status: "saved" };
    }
  };

  // AI for agents: runs Claude through /api/ai and executes the page's tools here.
  async function callAI(messages, tools, signal) {
    const r = await fetch(cfg.aiEndpoint, {
      method: "POST", signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session ? session.access_token : ""}` },
      body: JSON.stringify({ messages, tools })
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw { code: r.status === 403 ? "not_granted" : r.status === 429 ? "rate_limited" : "unavailable", message: e.error || "AI unavailable" };
    }
    return r.json();
  }
  async function sample(input, opts = {}) {
    let messages = typeof input === "string" ? [{ role: "user", content: input }] : input.map(m => ({ role: m.role, content: m.content }));
    const pageTools = opts.tools || [];
    const tools = pageTools.map(t => ({ name: t.name, description: t.description, input_schema: t.inputSchema || { type: "object", properties: {} } }));
    for (let round = 0; round < 8; round++) {
      if (opts.signal && opts.signal.aborted) throw { code: "cancelled" };
      const res = await callAI(messages, tools, opts.signal);
      const blocks = res.content || [];
      const text = blocks.filter(b => b.type === "text").map(b => b.text).join("");
      const uses = blocks.filter(b => b.type === "tool_use");
      if (text && opts.onText) { try { opts.onText({ text, delta: text }); } catch (e) {} }
      if (res.stop_reason !== "tool_use" || !uses.length) return { text, truncated: res.stop_reason === "max_tokens" };
      messages = [...messages, { role: "assistant", content: blocks }];
      const results = [];
      for (const u of uses) {
        const t = pageTools.find(x => x.name === u.name);
        let content, is_error = false;
        try { content = JSON.stringify(t ? await t.execute(u.input || {}, {}) : { error: "Unknown tool" }); }
        catch (e) { content = String((e && e.message) || e); is_error = true; }
        results.push({ type: "tool_result", tool_use_id: u.id, content, is_error });
      }
      messages.push({ role: "user", content: results });
    }
    throw { code: "unavailable", message: "The assistant needed too many steps." };
  }
  sample.json = async (input, opts = {}) => {
    const prompt = typeof input === "string" ? input + "\n\nRespond with only the JSON value and no other text." : input;
    const { text } = await sample(prompt, opts);
    try { return JSON.parse(text.replace(/```json|```/g, "").trim()); }
    catch (e) { throw { code: "invalid_json", text }; }
  };
  sample.limits = async () => ({ images: false });

  window.claude = {
    async use(name) {
      await ready;
      if (name === "downloads") return downloads;
      if (!sb) return null;
      if (name === "db") return db;
      if (name === "user") return user;
      if (name === "sample") return (cfg.aiEndpoint && await user.canEdit()) ? sample : null;
      return null;
    }
  };

  // Extras the multi-agent app uses
  let brokerFlag = null;
  window.MillerCloud = {
    async rpc(fn, args) { await ready; if (!sb) throw new Error("Not connected"); const { data, error } = await sb.rpc(fn, args || {}); if (error) throw error; return data; },
    async isBroker() { await ready; if (!sb || !session) return false; if (brokerFlag === null) { const { data } = await sb.rpc("is_admin"); brokerFlag = !!data; } return brokerFlag; },
    // Copies a showing request into the website's Leads inbox (public.leads), so it shows in /admin too.
    async siteLead(l) {
      await ready; if (!sb) return;
      try {
        await sb.from("leads").insert({ name: (l.name || "Home search visitor").slice(0, 200), email: (l.email || "").slice(0, 320), phone: l.phone || null,
          interest: "Showing request", message: (l.message || "").slice(0, 5000), address: (l.address || "").slice(0, 300), source: "home-search",
          extra: { listingKey: l.listingKey || "", agentId: l.agentId || "" } });
      } catch (e) {}
    }
  };

  // Sign-in control in the header
  function authUI() {
    const host = document.querySelector(".brand");
    if (!host || !sb) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn ghost small";
    btn.textContent = session ? "Sign out" : "Sign in";
    btn.addEventListener("click", async () => {
      if (session) { await sb.auth.signOut(); return; }
      let dlg = document.getElementById("dlgAuth");
      if (!dlg) {
        dlg = document.createElement("dialog"); dlg.id = "dlgAuth"; dlg.setAttribute("aria-label", "Sign in");
        dlg.innerHTML = `<div class="sheet"><div class="sheettop"><h2>Sign in</h2><button class="close" type="button" aria-label="Close">×</button></div>
          <p class="addr">Save homes, message your agent, and pick up where you left off on any device. We’ll email you a sign-in link.</p>
          <form><label for="authEmail">Email</label><input id="authEmail" type="email" required autocomplete="email">
          <div class="actions"><button class="btn gold" type="submit">Email me a link</button></div><p class="msg" role="status"></p></form></div>`;
        document.body.appendChild(dlg);
        dlg.querySelector(".close").addEventListener("click", () => dlg.close());
        dlg.querySelector("form").addEventListener("submit", async e => {
          e.preventDefault();
          const msg = dlg.querySelector(".msg");
          const { error } = await sb.auth.signInWithOtp({ email: dlg.querySelector("#authEmail").value.trim(), options: { emailRedirectTo: location.href.split("#")[0] } });
          msg.textContent = error ? `That didn’t send: ${error.message}` : "Check your email for a sign-in link.";
        });
      }
      dlg.showModal();
    });
    host.appendChild(btn);
  }
  ready.then(() => { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", authUI); else authUI(); });
})();
