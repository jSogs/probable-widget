class ProbableMarkets extends HTMLElement {
    constructor() {
      super();
      this.tooltipEl = null;
      this.chartData = [];
      this._ctx = null;
      this._theme = "light";
      this._timeframe = "ALL";
      this._selectedIndex = 0;
      this._markets = [];
      this._meta = null;
      this._updated = null;
      this._loading = null;
      this._error = null;
      this._sel = null;
      this._chartWrap = null;
      this._canvas = null;
      this._endsEl = null;
      this._volumeEl = null;
      this._tfButtons = [];
    }
  
    async connectedCallback() {
      const articleUrl = this.getAttribute("article-url") || "";
      const query = this.getAttribute("query") || "";
      const theme = this.getAttribute("theme") || "light";
      const timeframe = this.getAttribute("timeframe") || "ALL";
  
      this._theme = theme;
      this._timeframe = timeframe;
  
      // Build UI
      this.innerHTML = `
        <style>
          :host { display:block; }
  
          @keyframes pmFadeIn { from {opacity:0; transform:translateY(6px)} to {opacity:1; transform:translateY(0)} }
          @keyframes pmSpin { to { transform: rotate(360deg); } }
  
          .pm-card {
            animation: pmFadeIn 220ms ease-out;
            font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
            background: var(--pm-bg);
            color: var(--pm-text);
            border: 1px solid var(--pm-border);
            border-radius: 18px;
            box-shadow: var(--pm-shadow);
            padding: 18px;
          }
  
          /* Theme tokens */
          .pm-theme-light {
            --pm-bg: #ffffff;
            --pm-text: #0f172a;
            --pm-muted: #64748b;
            --pm-border: rgba(15,23,42,0.10);
            --pm-shadow: 0 16px 36px rgba(15,23,42,0.10);
            --pm-pill-bg: #f1f5f9;
            --pm-pill-active-bg: #ffffff;
            --pm-pill-border: rgba(15,23,42,0.08);
            --pm-grid: rgba(15,23,42,0.07);
            --pm-blue: #3b82f6;
            --pm-blue-soft: rgba(59,130,246,0.18);
            --pm-green: #16a34a;
            --pm-red: #ef4444;
          }
          .pm-theme-dark {
            --pm-bg: #0b1220;
            --pm-text: #e5e7eb;
            --pm-muted: #94a3b8;
            --pm-border: rgba(255,255,255,0.10);
            --pm-shadow: 0 18px 40px rgba(0,0,0,0.55);
            --pm-pill-bg: rgba(255,255,255,0.07);
            --pm-pill-active-bg: rgba(255,255,255,0.12);
            --pm-pill-border: rgba(255,255,255,0.12);
            --pm-grid: rgba(148,163,184,0.18);
            --pm-blue: #60a5fa;
            --pm-blue-soft: rgba(96,165,250,0.18);
            --pm-green: #22c55e;
            --pm-red: #f87171;
          }
  
          /* Header */
          .pm-header {
            display:flex;
            align-items:flex-start;
            justify-content:space-between;
            gap: 12px;
            margin-bottom: 10px;
          }
          .pm-header-left {
            min-width: 0;
            flex: 1;
          }
          .pm-label {
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.02em;
            color: var(--pm-muted);
            margin-bottom: 6px;
          }
  
          .pm-select-wrap { position:relative; width: 100%; }
          .pm-select {
            width: 100%;
            appearance:none;
            border: 1px solid var(--pm-border);
            background: color-mix(in srgb, var(--pm-bg) 85%, #f1f5f9 15%);
            color: var(--pm-text);
            border-radius: 12px;
            padding: 10px 36px 10px 12px;
            font-size: 14px;
            font-weight: 650;
            line-height: 1.2;
            box-shadow: 0 1px 0 rgba(15,23,42,0.04);
            outline: none;
            cursor: pointer;
          }
          .pm-select:focus {
            box-shadow: 0 0 0 3px color-mix(in srgb, var(--pm-blue) 30%, transparent);
            border-color: color-mix(in srgb, var(--pm-blue) 60%, var(--pm-border));
          }
          .pm-select-wrap::after {
            content: "▾";
            position:absolute;
            right: 12px;
            top: 50%;
            transform: translateY(-50%);
            color: var(--pm-muted);
            pointer-events:none;
            font-size: 14px;
          }
  
          /* Stats row */
          .pm-stats {
            display:flex;
            align-items: baseline;
            justify-content: space-between;
            gap: 16px;
            margin: 12px 0 12px;
          }
          .pm-odds {
            display:flex;
            align-items: baseline;
            gap: 12px;
          }
          .pm-odds .pm-big {
            font-size: 52px;
            font-weight: 800;
            letter-spacing: -0.04em;
            line-height: 1;
          }
          .pm-odds .pm-big small {
            font-size: 26px;
            font-weight: 750;
            margin-left: 2px;
          }
          .pm-delta {
            display:inline-flex;
            align-items:center;
            gap: 6px;
            font-size: 16px;
            font-weight: 750;
            padding: 6px 10px;
            border-radius: 999px;
            background: color-mix(in srgb, var(--pm-green) 14%, transparent);
            color: var(--pm-green);
          }
          .pm-delta.neg {
            background: color-mix(in srgb, var(--pm-red) 14%, transparent);
            color: var(--pm-red);
          }
          .pm-right-meta {
            text-align:right;
            color: var(--pm-muted);
            font-size: 13px;
            line-height: 1.2;
            white-space: nowrap;
          }
  
          /* Chart */
          .pm-chart-wrap {
            position: relative;
            border-radius: 14px;
            overflow: hidden;
            background: linear-gradient(180deg, var(--pm-blue-soft) 0%, rgba(0,0,0,0) 65%);
            border: 1px solid color-mix(in srgb, var(--pm-border) 70%, transparent);
          }
          canvas.pm-chart {
            width: 100%;
            height: 220px;
            display:block;
            cursor: crosshair;
          }
  
          /* Tooltip bubble */
          .pm-tooltip {
            position:absolute;
            pointer-events:none;
            background: color-mix(in srgb, var(--pm-bg) 92%, #ffffff 8%);
            border: 1px solid color-mix(in srgb, var(--pm-border) 85%, transparent);
            border-radius: 16px;
            padding: 10px 12px;
            min-width: 92px;
            box-shadow: 0 14px 28px rgba(15,23,42,0.12);
            backdrop-filter: blur(8px);
            opacity: 0;
            transform: translate(-50%, -110%);
            transition: opacity 120ms ease;
            z-index: 10;
          }
          .pm-tooltip.visible { opacity: 1; }
          .pm-tooltip .date {
            font-size: 12px;
            font-weight: 700;
            color: var(--pm-muted);
            margin-bottom: 2px;
          }
          .pm-tooltip .price {
            font-size: 22px;
            font-weight: 850;
            letter-spacing: -0.02em;
            color: var(--pm-text);
          }
  
          /* Controls */
          .pm-controls {
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap: 12px;
            margin-top: 12px;
          }
          .pm-pills {
            display:inline-flex;
            align-items:center;
            gap: 4px;
            background: var(--pm-pill-bg);
            border: 1px solid color-mix(in srgb, var(--pm-border) 55%, transparent);
            border-radius: 999px;
            padding: 4px;
          }
          .pm-pill {
            border: 1px solid transparent;
            background: transparent;
            color: var(--pm-muted);
            font-size: 12px;
            font-weight: 750;
            padding: 8px 12px;
            border-radius: 999px;
            cursor:pointer;
            transition: all 160ms ease;
          }
          .pm-pill:hover { color: var(--pm-text); }
          .pm-pill.active {
            background: var(--pm-pill-active-bg);
            border-color: var(--pm-pill-border);
            color: var(--pm-text);
            box-shadow: 0 10px 18px rgba(15,23,42,0.10);
          }
  
          /* Footer */
          .pm-footer {
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap: 12px;
            border-top: 1px solid color-mix(in srgb, var(--pm-border) 55%, transparent);
            margin-top: 14px;
            padding-top: 12px;
            color: var(--pm-muted);
            font-size: 13px;
          }
  
          /* Loading & error */
          .pm-loading {
            display:flex;
            align-items:center;
            justify-content:center;
            padding: 30px 0;
          }
          .pm-spinner {
            width: 28px; height: 28px;
            border-radius: 999px;
            border: 2px solid color-mix(in srgb, var(--pm-blue) 20%, transparent);
            border-top-color: var(--pm-blue);
            animation: pmSpin 0.8s linear infinite;
          }
          .pm-error {
            margin-top: 10px;
            font-size: 13px;
            color: var(--pm-red);
            display:none;
          }
        </style>
  
        <div class="pm-card ${theme === "dark" ? "pm-theme-dark" : "pm-theme-light"}">
          <div class="pm-header">
            <div class="pm-header-left">
              <div class="pm-label">Prediction markets</div>
              <div class="pm-select-wrap">
                <select id="pm_sel" class="pm-select"></select>
              </div>
            </div>
          </div>
  
          <div class="pm-stats" id="pm_stats" style="display:none;">
            <div class="pm-odds">
              <div class="pm-big" id="pm_big">--<small>%</small></div>
              <div class="pm-delta" id="pm_delta">↗ +0.0%</div>
            </div>
            <div class="pm-right-meta">
              <div id="pm_ends">Ends —</div>
            </div>
          </div>
  
          <div id="pm_loading" class="pm-loading">
            <div class="pm-spinner"></div>
          </div>
  
          <div id="pm_chart_wrap" class="pm-chart-wrap" style="display:none;">
            <canvas id="pm_chart" class="pm-chart"></canvas>
            <div id="pm_tooltip" class="pm-tooltip"></div>
          </div>
  
          <div class="pm-controls" id="pm_controls" style="display:none;">
            <div class="pm-pills" id="pm_pills">
              ${["1D","1W","1M","ALL"].map(t => `<button type="button" data-tf="${t}" class="pm-pill${t === timeframe ? " active" : ""}">${t}</button>`).join("")}
            </div>
            <div class="pm-right-meta">
              <div id="pm_updated">Updated —</div>
            </div>
          </div>
  
          <div class="pm-footer" id="pm_footer" style="display:none;">
            <span id="pm_volume">Volume: —</span>
            <span>Updated just now</span>
          </div>
  
          <div id="pm_error" class="pm-error"></div>
        </div>
      `;
  
      // Cache elements
      this._sel = this.querySelector("#pm_sel");
      this._canvas = this.querySelector("#pm_chart");
      this._chartWrap = this.querySelector("#pm_chart_wrap");
      this._loading = this.querySelector("#pm_loading");
      this._error = this.querySelector("#pm_error");
      this.tooltipEl = this.querySelector("#pm_tooltip");
      this._updated = this.querySelector("#pm_updated");
      this._endsEl = this.querySelector("#pm_ends");
      this._volumeEl = this.querySelector("#pm_volume");
      this._tfButtons = [...this.querySelectorAll(".pm-pill")];
  
      const statsRow = this.querySelector("#pm_stats");
      const controlsRow = this.querySelector("#pm_controls");
      const footerRow = this.querySelector("#pm_footer");
      const bigEl = this.querySelector("#pm_big");
      const deltaEl = this.querySelector("#pm_delta");
  
      const showError = (msg) => {
        this._error.style.display = "block";
        this._error.textContent = msg;
        this._loading.style.display = "none";
      };
  
      const setLoading = (isLoading) => {
        this._loading.style.display = isLoading ? "flex" : "none";
        if (isLoading) this._chartWrap.style.display = "none";
      };
  
      const setVisible = () => {
        statsRow.style.display = "flex";
        this._chartWrap.style.display = "block";
        controlsRow.style.display = "flex";
        footerRow.style.display = "flex";
      };
  
      try {
        const apiBase = getApiBase();
        const res = await fetch(`${apiBase}/v1/widget/markets`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ articleUrl, query, limit: 5 }),
        });
  
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  
        this._markets = Array.isArray(data.markets) ? data.markets : [];
  
        if (!this._markets.length) {
          setLoading(false);
          showError("No relevant markets found.");
          return;
        }
  
        // Populate dropdown
        this._sel.innerHTML = this._markets
          .map((m, i) => `<option value="${i}">${escapeHtml(m.title || m.question || "Market")}</option>`)
          .join("");
  
        this._updated.textContent = `Updated ${new Date(data.updatedAt || Date.now()).toLocaleString()}`;
  
        // Init canvas + events
        this._ctx = initCanvas(this._canvas);
  
        this._canvas.addEventListener("mousemove", (e) => this.handleHover(e));
        this._canvas.addEventListener("mouseleave", () => this.hideTooltip());
  
        window.addEventListener("resize", () => {
          this._ctx = initCanvas(this._canvas);
          this.renderAll();
        });
  
        // Dropdown change
        this._sel.addEventListener("change", () => {
          this._selectedIndex = Number(this._sel.value || 0);
          this.renderAll();
        });
  
        // Timeframe pills
        this._tfButtons.forEach((btn) => {
          btn.addEventListener("click", () => {
            this._timeframe = btn.getAttribute("data-tf") || "ALL";
            this._tfButtons.forEach((b) =>
              b.classList.toggle("active", b.getAttribute("data-tf") === this._timeframe)
            );
            this.renderAll();
          });
        });
  
        // Initial render
        setVisible();
        await this.renderAll({ bigEl, deltaEl });
      } catch (e) {
        showError(`Widget failed to load: ${String(e?.message || e)}`);
      }
    }
  
    async renderAll(extra = {}) {
      const { bigEl, deltaEl } = extra;
      const m = this._markets[this._selectedIndex];
      if (!m) return;
  
      // Stats
      const yes = clamp01(m.yes);
      const pct = (yes * 100).toFixed(0);
  
      const trend = Number(m.trend24h || 0) * 100; // already a fraction
      const trendAbs = Math.abs(trend).toFixed(1);
      const trendSign = trend >= 0 ? "+" : "-";
  
      if (bigEl) bigEl.innerHTML = `${pct}<small>%</small>`;
      if (deltaEl) {
        deltaEl.classList.toggle("neg", trend < 0);
        deltaEl.textContent = `${trend >= 0 ? "↗" : "↘"} ${trendSign}${trendAbs}%`;
      }
  
      // Ends + Volume
      this._endsEl.textContent = m.endTime
        ? `Ends ${new Date(m.endTime).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
        : `Ends ${escapeHtml(m.endDate || "—")}`;
      this._volumeEl.textContent = `Volume: ${escapeHtml(m.volume != null ? String(m.volume) : "—")}`;
  
      // Chart data + draw
      this._chartWrap.style.display = "none";
      this._loading.style.display = "flex";
  
      await renderChart(m, this._timeframe, this._ctx, this);
  
      this._loading.style.display = "none";
      this._chartWrap.style.display = "block";
    }
  
    handleHover(e) {
      if (!this.chartData.length || !this.tooltipEl || !this._canvas) return;
  
      const rect = this._canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const w = rect.width;
  
      const pts = this.chartData;
      const minT = pts[0].t;
      const maxT = pts[pts.length - 1].t;
  
      const ratio = x / Math.max(1, w);
      const targetT = minT + ratio * (maxT - minT);
  
      let closest = pts[0];
      let best = Infinity;
      for (const p of pts) {
        const d = Math.abs(p.t - targetT);
        if (d < best) {
          best = d;
          closest = p;
        }
      }
  
      const date = new Date(closest.t);
      const dateStr = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      const pct = (closest.p * 100).toFixed(1);
  
      this.tooltipEl.innerHTML = `
        <div class="date">${escapeHtml(dateStr)}</div>
        <div class="price">${escapeHtml(pct)}%</div>
      `;
  
      const pad = 16; // keep tooltip inside bounds
      const clampedX = Math.min(Math.max(x, pad), rect.width - pad);
      this.tooltipEl.style.left = `${clampedX}px`;
      this.tooltipEl.style.top = `0px`;
      this.tooltipEl.classList.add("visible");
    }
  
    hideTooltip() {
      if (this.tooltipEl) this.tooltipEl.classList.remove("visible");
    }
  }
  
  customElements.define("probable-markets", ProbableMarkets);
  
  /* ---------- Chart drawing ---------- */
  
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
      const r = await fetch(
        `${apiBase}/v1/widget/series?id=${encodeURIComponent(m.id)}&tf=${encodeURIComponent(tf)}`
      );
      const d = await r.json().catch(() => ({}));
      series = Array.isArray(d.series) ? d.series : [];
    }
  
    const pts = filterSeries(series, tf);
    component.chartData = pts;
    drawOddsChart(ctx, pts, tf);
  }
  
  function filterSeries(series, tf) {
    const now = Date.now();
    const ms =
      { "1D": 864e5, "1W": 7 * 864e5, "1M": 30 * 864e5, ALL: Infinity }[tf] ?? Infinity;
  
    const filtered = (series || [])
      .filter((p) => typeof p?.t === "number" && typeof p?.p === "number")
      .filter((p) => now - p.t <= ms)
      .map((p) => ({ t: p.t, p: clamp01(p.p) }));
  
    // Ensure sorted by time
    filtered.sort((a, b) => a.t - b.t);
    return filtered;
  }
  
  function drawOddsChart(ctx, pts, tf) {
    const w = ctx.canvas.getBoundingClientRect().width;
    const h = ctx.canvas.getBoundingClientRect().height;
    ctx.clearRect(0, 0, w, h);
  
    // Layout paddings for axes labels
    const padLeft = 42;
    const padRight = 10;
    const padTop = 12;
    const padBottom = 26;
  
    const plotW = w - padLeft - padRight;
    const plotH = h - padTop - padBottom;
  
    // Grid + y-axis ticks
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(148,163,184,0.18)";
  
    const yTicks = [0, 25, 50, 75, 100];
  
    // Y axis labels
    ctx.fillStyle = "rgba(100,116,139,0.95)";
    ctx.font = "12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
  
    for (const yv of yTicks) {
      const y = padTop + (1 - yv / 100) * plotH;
      // grid line
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(w - padRight, y);
      ctx.stroke();
  
      // label
      ctx.fillText(`${yv}%`, 6, y + 4);
    }
  
    if (!pts.length) return;
  
    const minT = pts[0].t;
    const maxT = pts[pts.length - 1].t;
  
    const xScale = (t) => padLeft + ((t - minT) / Math.max(1, maxT - minT)) * plotW;
    const yScale = (p) => padTop + (1 - p) * plotH;
  
    // Area gradient
    const grad = ctx.createLinearGradient(0, padTop, 0, padTop + plotH);
    grad.addColorStop(0, "rgba(59,130,246,0.28)");
    grad.addColorStop(0.7, "rgba(59,130,246,0.06)");
    grad.addColorStop(1, "rgba(59,130,246,0.00)");
  
    // Area path (smooth)
    ctx.beginPath();
    ctx.moveTo(xScale(pts[0].t), padTop + plotH);
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
  
    ctx.lineTo(xScale(pts[pts.length - 1].t), padTop + plotH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
  
    // Line stroke
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
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  
    // X-axis labels (start / mid / end)
    const fmt = (t) =>
      new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  
    const t0 = minT;
    const t1 = minT + (maxT - minT) / 2;
    const t2 = maxT;
  
    ctx.fillStyle = "rgba(100,116,139,0.95)";
    ctx.font = "12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
  
    const yLabel = padTop + plotH + 18;
    ctx.fillText(fmt(t0), padLeft, yLabel);
  
    const midText = fmt(t1);
    const midW = ctx.measureText(midText).width;
    ctx.fillText(midText, padLeft + plotW / 2 - midW / 2, yLabel);
  
    const endText = fmt(t2);
    const endW = ctx.measureText(endText).width;
    ctx.fillText(endText, padLeft + plotW - endW, yLabel);
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
    const script =
      document.currentScript ||
      [...document.scripts].find((s) => (s.src || "").includes("embed.js"));
    if (script?.src) return new URL(script.src).origin;
    return window.location.origin;
  }
  