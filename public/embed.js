class ProbableMarkets extends HTMLElement {
    async connectedCallback() {
      const articleUrl = this.getAttribute("article-url") || "";
      const query = this.getAttribute("query") || "";
      const theme = this.getAttribute("theme") || "light";
      const timeframe = this.getAttribute("timeframe") || "ALL";
  
      this.innerHTML = `
        <div style="${containerStyle(theme)}">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
            <div style="font-weight:800;font-size:14px;">Prediction markets</div>
            <select id="pm_sel" style="${selectStyle(theme)}"></select>
          </div>
  
          <div id="pm_meta" style="margin-top:10px;"></div>
  
          <div style="margin-top:12px;">
            <canvas id="pm_chart" style="width:100%;height:140px;"></canvas>
          </div>
  
          <div style="display:flex;gap:8px;margin-top:10px;align-items:center;justify-content:space-between;">
            <div id="pm_updated" style="font-size:12px;opacity:.7;"></div>
            <div style="display:flex;gap:6px;">
              ${["1D","1W","1M","ALL"].map(t => `<button data-tf="${t}" style="${tfBtnStyle(theme)}">${t}</button>`).join("")}
            </div>
          </div>
  
          <div id="pm_error" style="margin-top:10px;font-size:12px;color:#b91c1c;display:none;"></div>
        </div>
      `;
  
      const sel = this.querySelector("#pm_sel");
      const meta = this.querySelector("#pm_meta");
      const updated = this.querySelector("#pm_updated");
      const canvas = this.querySelector("#pm_chart");
      const errorEl = this.querySelector("#pm_error");
  
      let markets = [];
      let currentIndex = 0;
      let currentTf = timeframe;
  
      const showError = (msg) => {
        errorEl.style.display = "block";
        errorEl.textContent = msg;
      };
  
      try {
        const res = await fetch("/v1/widget/markets", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ articleUrl, query, limit: 5 })
        });
  
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  
        markets = Array.isArray(data.markets) ? data.markets : [];
        if (!markets.length) {
          meta.innerHTML = `<div style="font-size:13px;opacity:.8;">No relevant markets found.</div>`;
          return;
        }
  
        sel.innerHTML = markets.map((m, i) => `<option value="${i}">${escapeHtml(m.title)}</option>`).join("");
        updated.textContent = `Updated ${new Date(data.updatedAt || Date.now()).toLocaleString()}`;
  
        let ctx = initCanvas(canvas);
  
        window.addEventListener("resize", () => {
          ctx = initCanvas(canvas);
          renderChart(markets[currentIndex], currentTf, ctx);
        });
  
        const renderAll = async () => {
          renderMeta(markets[currentIndex], meta);
          await renderChart(markets[currentIndex], currentTf, ctx);
        };
  
        sel.addEventListener("change", async (e) => {
          currentIndex = Number(e.target.value || 0);
          await renderAll();
        });
  
        this.querySelectorAll("button[data-tf]").forEach(btn => {
          btn.addEventListener("click", async () => {
            currentTf = btn.getAttribute("data-tf") || "ALL";
            await renderAll();
          });
        });
  
        await renderAll();
      } catch (e) {
        showError(`Widget failed to load: ${String(e.message || e)}`);
      }
    }
  }
  
  customElements.define("probable-markets", ProbableMarkets);
  
  function containerStyle(theme) {
    const base = "font-family:ui-sans-serif;border-radius:14px;padding:12px;border:1px solid rgba(0,0,0,.12);";
    return theme === "dark"
      ? base + "background:#0b0f19;color:#e5e7eb;border-color:rgba(255,255,255,.12);"
      : base + "background:#fff;color:#111827;";
  }
  function selectStyle(theme) {
    const base = "padding:6px 10px;border-radius:10px;border:1px solid rgba(0,0,0,.15);font-size:13px;max-width:420px;";
    return theme === "dark"
      ? base + "background:#111827;color:#e5e7eb;border-color:rgba(255,255,255,.12);"
      : base + "background:#fff;color:#111827;";
  }
  function tfBtnStyle(theme) {
    const base = "padding:4px 8px;border-radius:8px;border:1px solid rgba(0,0,0,.12);background:transparent;cursor:pointer;font-size:12px;";
    return theme === "dark"
      ? base + "color:#e5e7eb;border-color:rgba(255,255,255,.12);"
      : base + "color:#111827;";
  }
  
  function renderMeta(m, metaEl) {
    const pct = (x) => `${Math.round((Number(x) || 0) * 100)}%`;
    const trend = (t) => {
      const n = Number(t) || 0;
      if (n === 0) return "—";
      const s = n > 0 ? "+" : "";
      return `${s}${pct(n)}`;
    };
  
    metaEl.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
        <a href="${m.url || "#"}" target="_blank" rel="noopener"
           style="text-decoration:none;color:inherit;font-weight:700;line-height:1.25;flex:1;">
          ${escapeHtml(m.title)}
        </a>
        <div style="text-align:right;min-width:160px;">
          <div style="font-weight:800;">Yes ${pct(m.yes)}</div>
          <div style="font-size:12px;opacity:.75;">24h ${trend(m.trend24h)}</div>
          <div style="font-size:12px;opacity:.75;">${escapeHtml(m.platform || "")}</div>
        </div>
      </div>
    `;
  }
  
  function initCanvas(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 2;
    return ctx;
  }
  
  async function renderChart(m, tf, ctx) {
    let series = Array.isArray(m.series) ? m.series : null;
    if (!series) {
      const r = await fetch(`/v1/widget/series?id=${encodeURIComponent(m.id)}&tf=${encodeURIComponent(tf)}`);
      const d = await r.json().catch(() => ({}));
      series = Array.isArray(d.series) ? d.series : [];
    }
    const pts = filterSeries(series, tf);
    drawLine(ctx, pts);
  }
  
  function filterSeries(series, tf) {
    const now = Date.now();
    const ms = ({ "1D": 864e5, "1W": 7 * 864e5, "1M": 30 * 864e5, "ALL": Infinity }[tf] ?? Infinity);
    return (series || [])
      .filter(p => typeof p?.t === "number" && typeof p?.p === "number")
      .filter(p => (now - p.t) <= ms)
      .map(p => ({ t: p.t, p: clamp01(p.p) }));
  }
  
  function drawLine(ctx, pts) {
    const w = ctx.canvas.getBoundingClientRect().width;
    const h = ctx.canvas.getBoundingClientRect().height;
    ctx.clearRect(0, 0, w, h);
  
    ctx.globalAlpha = 0.15;
    for (let i = 0; i <= 4; i++) {
      const y = (h * i) / 4;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  
    if (!pts.length) return;
  
    const xs = pts.map(p => p.t);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
  
    const xScale = (x) => (maxX === minX ? 4 : ((x - minX) / (maxX - minX)) * (w - 8) + 4);
    const yScale = (y) => h - (y * (h - 8) + 4);
  
    ctx.beginPath();
    pts.forEach((p, i) => {
      const x = xScale(p.t);
      const y = yScale(p.p);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
  
  function clamp01(x) {
    const n = Number(x);
    if (!Number.isFinite(n)) return 0.5;
    return Math.max(0, Math.min(1, n));
  }
  
  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
  