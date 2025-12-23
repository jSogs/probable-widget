class ProbableMarkets extends HTMLElement {
    constructor() {
      super();
      this.tooltipEl = null;
      this.chartData = [];
    }
  
    async connectedCallback() {
      const articleUrl = this.getAttribute("article-url") || "";
      const query = this.getAttribute("query") || "";
      const theme = this.getAttribute("theme") || "light";
      const timeframe = this.getAttribute("timeframe") || "ALL";
  
      this.innerHTML = `
        <style>
          @keyframes pmFadeIn {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes pmSpin {
            to { transform: rotate(360deg); }
          }
          .pm-container { animation: pmFadeIn 0.4s ease-out; }
          .pm-spinner {
            width: 24px; height: 24px;
            border: 2px solid rgba(59,130,246,0.2);
            border-top-color: #3b82f6;
            border-radius: 50%;
            animation: pmSpin 0.8s linear infinite;
          }
          .pm-tf-btn { transition: all 0.2s ease; }
          .pm-tf-btn:hover { background: rgba(59,130,246,0.1); }
          .pm-tf-btn.active {
            background: #3b82f6 !important;
            color: #fff !important;
            border-color: #3b82f6 !important;
          }
          .pm-chart-wrap { position: relative; }
          .pm-tooltip {
            position: absolute;
            background: ${theme === "dark" ? "#1f2937" : "#fff"};
            border: 1px solid ${theme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"};
            border-radius: 8px;
            padding: 8px 12px;
            font-size: 12px;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.15s ease;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            z-index: 10;
          }
          .pm-tooltip.visible { opacity: 1; }
        </style>
        <div class="pm-container" style="${containerStyle(theme)}">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
            <div style="font-weight:800;font-size:14px;letter-spacing:-0.01em;">Prediction markets</div>
            <select id="pm_sel" style="${selectStyle(theme)}"></select>
          </div>
          <div id="pm_meta" style="margin-top:12px;"></div>
          <div id="pm_loading" style="display:flex;justify-content:center;padding:40px 0;">
            <div class="pm-spinner"></div>
          </div>
          <div class="pm-chart-wrap" style="margin-top:12px;display:none;" id="pm_chart_wrap">
            <canvas id="pm_chart" style="width:100%;height:140px;cursor:crosshair;"></canvas>
            <div class="pm-tooltip" id="pm_tooltip"></div>
          </div>
          <div style="display:flex;gap:8px;margin-top:12px;align-items:center;justify-content:space-between;">
            <div id="pm_updated" style="font-size:11px;opacity:.6;"></div>
            <div style="display:flex;gap:6px;">
              ${["1D","1W","1M","ALL"].map(t => `<button data-tf="${t}" class="pm-tf-btn${t === timeframe ? ' active' : ''}" style="${tfBtnStyle(theme)}">${t}</button>`).join("")}
            </div>
          </div>
          <div id="pm_error" style="margin-top:10px;font-size:12px;color:#dc2626;display:none;"></div>
        </div>
      `;
  
      const sel = this.querySelector("#pm_sel");
      const meta = this.querySelector("#pm_meta");
      const updated = this.querySelector("#pm_updated");
      const canvas = this.querySelector("#pm_chart");
      const chartWrap = this.querySelector("#pm_chart_wrap");
      const loading = this.querySelector("#pm_loading");
      const errorEl = this.querySelector("#pm_error");
      this.tooltipEl = this.querySelector("#pm_tooltip");
  
      let markets = [];
      let currentIndex = 0;
      let currentTf = timeframe;
  
      const showError = (msg) => {
        errorEl.style.display = "block";
        errorEl.textContent = msg;
        loading.style.display = "none";
      };
  
      const updateActiveBtn = () => {
        this.querySelectorAll(".pm-tf-btn").forEach(btn => {
          btn.classList.toggle("active", btn.getAttribute("data-tf") === currentTf);
        });
      };
  
      try {
        const apiBase = getApiBase();
        const res = await fetch(`${apiBase}/v1/widget/markets`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ articleUrl, query, limit: 5 })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
        markets = Array.isArray(data.markets) ? data.markets : [];
        
        if (!markets.length) {
          loading.style.display = "none";
          meta.innerHTML = `<div style="font-size:13px;opacity:.7;">No relevant markets found.</div>`;
          return;
        }
  
        sel.innerHTML = markets.map((m, i) => `<option value="${i}">${escapeHtml(m.title)}</option>`).join("");
        updated.textContent = `Updated ${new Date(data.updatedAt || Date.now()).toLocaleString()}`;
  
        let ctx = initCanvas(canvas);
        
        // Setup hover events
        canvas.addEventListener("mousemove", (e) => this.handleHover(e, canvas, ctx));
        canvas.addEventListener("mouseleave", () => this.hideTooltip());
  
        window.addEventListener("resize", () => {
          ctx = initCanvas(canvas);
          renderChart(markets[currentIndex], currentTf, ctx, this);
        });
  
        const renderAll = async () => {
          loading.style.display = "flex";
          chartWrap.style.display = "none";
          renderMeta(markets[currentIndex], meta, theme);
          await renderChart(markets[currentIndex], currentTf, ctx, this);
          loading.style.display = "none";
          chartWrap.style.display = "block";
        };
  
        sel.addEventListener("change", async (e) => {
          currentIndex = Number(e.target.value || 0);
          await renderAll();
        });
  
        this.querySelectorAll(".pm-tf-btn").forEach(btn => {
          btn.addEventListener("click", async () => {
            currentTf = btn.getAttribute("data-tf") || "ALL";
            updateActiveBtn();
            await renderAll();
          });
        });
  
        await renderAll();
      } catch (e) {
        showError(`Widget failed to load: ${String(e.message || e)}`);
      }
    }
  
    handleHover(e, canvas, ctx) {
      if (!this.chartData.length || !this.tooltipEl) return;
      
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const w = rect.width;
      const pts = this.chartData;
      
      const xs = pts.map(p => p.t);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      
      // Find closest point
      const ratio = x / w;
      const targetT = minX + ratio * (maxX - minX);
      let closest = pts[0];
      let closestDist = Infinity;
      
      for (const p of pts) {
        const dist = Math.abs(p.t - targetT);
        if (dist < closestDist) {
          closestDist = dist;
          closest = p;
        }
      }
      
      const date = new Date(closest.t);
      const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      const pct = Math.round(closest.p * 100);
      
      this.tooltipEl.innerHTML = `
        <div style="font-weight:600;margin-bottom:2px;">${pct}%</div>
        <div style="opacity:0.7;">${dateStr}</div>
      `;
      
      // Position tooltip
      const tooltipX = Math.min(Math.max(x - 40, 0), rect.width - 90);
      this.tooltipEl.style.left = `${tooltipX}px`;
      this.tooltipEl.style.top = `-50px`;
      this.tooltipEl.classList.add("visible");
    }
  
    hideTooltip() {
      if (this.tooltipEl) {
        this.tooltipEl.classList.remove("visible");
      }
    }
  }
  
  customElements.define("probable-markets", ProbableMarkets);
  
  function containerStyle(theme) {
    const base = "font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;border-radius:16px;padding:16px;";
    return theme === "dark"
      ? base + "background:#0f172a;color:#e2e8f0;border:1px solid rgba(255,255,255,0.08);box-shadow:0 4px 24px rgba(0,0,0,0.4);"
      : base + "background:#ffffff;color:#0f172a;border:1px solid rgba(0,0,0,0.08);box-shadow:0 4px 24px rgba(0,0,0,0.06);";
  }
  
  function selectStyle(theme) {
    const base = "padding:8px 12px;border-radius:10px;font-size:13px;max-width:420px;outline:none;cursor:pointer;";
    return theme === "dark"
      ? base + "background:#1e293b;color:#e2e8f0;border:1px solid rgba(255,255,255,0.1);"
      : base + "background:#f8fafc;color:#0f172a;border:1px solid rgba(0,0,0,0.1);";
  }
  
  function tfBtnStyle(theme) {
    const base = "padding:6px 10px;border-radius:8px;border:1px solid;background:transparent;cursor:pointer;font-size:12px;font-weight:500;";
    return theme === "dark"
      ? base + "color:#94a3b8;border-color:rgba(255,255,255,0.1);"
      : base + "color:#64748b;border-color:rgba(0,0,0,0.1);";
  }
  
  function renderMeta(m, metaEl, theme) {
    const pct = (x) => `${Math.round((Number(x) || 0) * 100)}%`;
    const trend = (t) => {
      const n = Number(t) || 0;
      if (n === 0) return "—";
      const s = n > 0 ? "+" : "";
      return `${s}${pct(n)}`;
    };
    const trendColor = (t) => {
      const n = Number(t) || 0;
      if (n > 0) return "#22c55e";
      if (n < 0) return "#ef4444";
      return theme === "dark" ? "#94a3b8" : "#64748b";
    };
  
    metaEl.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;">
        <a href="${m.url || "#"}" target="_blank" rel="noopener"
           style="text-decoration:none;color:inherit;font-weight:600;font-size:15px;line-height:1.4;flex:1;transition:opacity 0.2s;"
           onmouseover="this.style.opacity='0.7'" onmouseout="this.style.opacity='1'">
          ${escapeHtml(m.title)}
        </a>
        <div style="text-align:right;min-width:100px;">
          <div style="font-weight:800;font-size:24px;letter-spacing:-0.02em;">Yes ${pct(m.yes)}</div>
          <div style="font-size:12px;color:${trendColor(m.trend24h)};font-weight:500;">24h ${trend(m.trend24h)}</div>
          <div style="font-size:11px;opacity:.6;margin-top:2px;">${escapeHtml(m.platform || "")}</div>
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
    return ctx;
  }
  
  async function renderChart(m, tf, ctx, component) {
    let series = Array.isArray(m.series) ? m.series : null;
    if (!series) {
      const apiBase = getApiBase();
      const r = await fetch(`${apiBase}/v1/widget/series?id=${encodeURIComponent(m.id)}&tf=${encodeURIComponent(tf)}`);
      const d = await r.json().catch(() => ({}));
      series = Array.isArray(d.series) ? d.series : [];
    }
    const pts = filterSeries(series, tf);
    component.chartData = pts;
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
  
    // Draw subtle grid lines
    ctx.strokeStyle = "rgba(148,163,184,0.15)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = (h * i) / 4;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  
    if (!pts.length) return;
  
    const xs = pts.map(p => p.t);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const pad = 4;
    const xScale = (x) => (maxX === minX ? pad : ((x - minX) / (maxX - minX)) * (w - pad * 2) + pad);
    const yScale = (y) => h - (y * (h - pad * 2) + pad);
  
    // Create gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, "rgba(59,130,246,0.3)");
    gradient.addColorStop(0.5, "rgba(59,130,246,0.1)");
    gradient.addColorStop(1, "rgba(59,130,246,0)");
  
    // Draw filled area with bezier curves
    ctx.beginPath();
    ctx.moveTo(xScale(pts[0].t), h);
    ctx.lineTo(xScale(pts[0].t), yScale(pts[0].p));
  
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      const prevX = xScale(prev.t);
      const prevY = yScale(prev.p);
      const currX = xScale(curr.t);
      const currY = yScale(curr.p);
      const midX = (prevX + currX) / 2;
      ctx.bezierCurveTo(midX, prevY, midX, currY, currX, currY);
    }
  
    ctx.lineTo(xScale(pts[pts.length - 1].t), h);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
  
    // Draw the line on top
    ctx.beginPath();
    ctx.moveTo(xScale(pts[0].t), yScale(pts[0].p));
  
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      const prevX = xScale(prev.t);
      const prevY = yScale(prev.p);
      const currX = xScale(curr.t);
      const currY = yScale(curr.p);
      const midX = (prevX + currX) / 2;
      ctx.bezierCurveTo(midX, prevY, midX, currY, currX, currY);
    }
  
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
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
  
  function getApiBase() {
    const script = document.currentScript || [...document.scripts].find(s => (s.src || "").includes("embed.js"));
    if (script?.src) return new URL(script.src).origin;
    return window.location.origin;
  }
  