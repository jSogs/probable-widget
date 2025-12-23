// public/widget.js
const params = new URLSearchParams(location.search);
const article = params.get("article") || "";
const query = params.get("query") || "";
const theme = params.get("theme") || "light";
const timeframe = params.get("timeframe") || "ALL";

const root = document.getElementById("root");
root.innerHTML = `
  <div class="loading">
    <div class="loading-spinner"></div>
    <span>Loading widget…</span>
  </div>
`;

loadEmbedScript()
  .then(() => {
    root.innerHTML = "";
    const el = document.createElement("probable-markets");
    if (article) el.setAttribute("article-url", article);
    if (query) el.setAttribute("query", query);
    el.setAttribute("theme", theme);
    el.setAttribute("timeframe", timeframe);
    root.appendChild(el);
  })
  .catch((err) => {
    root.innerHTML = `
      <div class="error">
        Failed to load widget: ${escapeHtml(err?.message || String(err))}
      </div>
    `;
    console.error(err);
  });

function loadEmbedScript() {
  if (customElements.get("probable-markets")) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "/embed.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load /embed.js"));
    document.head.appendChild(s);
  });
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
