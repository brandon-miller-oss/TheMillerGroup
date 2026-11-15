// Calls the Claude API from the server (newsletter intros and the weekly Colorado news search).
const KEY = process.env.ANTHROPIC_API_KEY, MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const ready = () => !!KEY;
// Returns the final text. With search: true, Claude may use web search (up to maxUses) and the turn is continued after pause_turn.
async function ask(prompt, { search = false, maxUses = 6, maxTokens = 3000 } = {}) {
  if (!KEY) throw new Error("AI isn’t set up on the server.");
  const tools = search ? [{ type: "web_search_20250305", name: "web_search", max_uses: maxUses, user_location: { type: "approximate", city: "Denver", region: "Colorado", country: "US", timezone: "America/Denver" } }] : undefined;
  let messages = [{ role: "user", content: prompt }], out = null;
  for (let i = 0; i < 4; i++) {
    const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01" }, body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, messages, ...(tools ? { tools } : {}) }) });
    if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error((j.error && j.error.message) || `AI returned ${r.status}`); }
    out = await r.json();
    if (out.stop_reason !== "pause_turn") break;
    messages = [...messages, { role: "assistant", content: out.content }];
  }
  return (out.content || []).filter(b => b.type === "text").map(b => b.text).join("");
}
// Pull the first JSON object or array out of a model reply.
function json(text) { const m = /[\[{][\s\S]*[\]}]/.exec(String(text || "")); if (!m) throw new Error("No JSON in the reply."); return JSON.parse(m[0]); }
module.exports = { ask, json, ready };
