// embed.js — drop-in working version (custom element + styled card + canvas chart w/ axes + tooltip)
// Usage:
// <script async src="https://YOUR_DOMAIN/embed.js"></script>
// <probable-markets query="bitcoin" theme="light" timeframe="1W" limit="5"></probable-markets>

class ProbableMarkets extends HTMLElement {
  constructor() {
    super();
    this._theme = "light";
    this._timeframe = "ALL";
    this._selectedIndex = 0;
    this._markets = [];

    this.chartData = [];
    this.tooltipEl = null;
    this._canvas = null;
    this._ctx = null;

    // cached DOM
    this._titleEl = null;
    this._priceEl = null;
    this._deltaEl = null;
    this._endsEl = null;
    this._volEl = null;
    this._updatedEl = null;
    this._pillBtns = [];

    // hover scaling (stored so tooltip math is correct)
    this._scale = null;
  }

  async connectedCallback() {
    this._theme = this.getAttribute("theme") || "light";
    this._timeframe = this.getAttribute("timeframe") || "ALL";

    this.renderShell();
    this.cacheDom();
    this.bindEvents();

    await this.fetchMarkets();
    this.updateUI();
  }

  renderShell() {
    this.innerHTML = `
      <style>
        :host { display:block; }
        * { box-sizing: border-box; }

        .pm-card {
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
          background: var(--pm-bg);
          color: var(--pm-text);
          border: 1px solid var(--pm-border);
          border-radius: 16px;
          padding: 18px;
          box-shadow: var(--pm-shadow);
          max-width: 520px;
        }

        /* Light / Dark tokens */
        .pm-theme-light {
          --pm-bg: #ffffff;
          --pm-text: #0f172a;
          --pm-muted: #64748b;
          --pm-border: rgba(15,23,42,0.10);
          --pm-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
          --pm-grid: rgba(15,23,42,0.07);
          --pm-blue: #3b82f6;
          --pm-area-top: rgba(59, 130, 246, 0.20);
          --pm-area-mid: rgba(59, 130, 246, 0.06);
          --pm-area-bot: rgba(59, 130, 246, 0.00);
          --pm-tooltip-bg: rgba(255,255,255,0.96);
          --pm-tooltip-border: rgba(15,23,42,0.12);
          --pm-pill-bg: #f1f5f9;
          --pm-pill-active: #ffffff;
          --pm-green: #16a34a;
          --pm-red: #ef4444;
        }

        .pm-theme-dark {
          --pm-bg: #0b1220;
          --pm-text: #f8fafc;
          --pm-muted: #94a3b8;
          --pm-border: rgba(255,255,255,0.12);
          --pm-shadow: 0 18px 40px rgba(0,0,0,0.55);
          --pm-grid: rgba(148,163,184,0.18);
          --pm-blue: #60a5fa;
          --pm-area-top: rgba(96, 165, 250, 0.22);
          --pm-area-mid: rgba(96, 165, 250, 0.08);
          --pm-area-bot: rgba(96, 165, 250, 0.00);
          --pm-tooltip-bg: rgba(15,23,42,0.90);
          --pm-tooltip-border: rgba(255,255,255,0.12);
          --pm-pill-bg: rgba(255,255,255,0.06);
          --pm-pill-active: rgba(255,255,255,0.12);
          --pm-green: #22c55e;
          --pm-red: #f87171;
        }

        .pm-header { margin-bottom: 10px; }
        .pm-title {
          margin: 0;
          font-size: 18px;
          font-weight: 800;
          letter-spacing: -0.02em;
          line-height: 1.2;
        }
        .pm-sub {
          margin-top: 6px;
          color: var(--pm-muted);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.02em;
          text-transform: uppercase;
        }

        .pm-stats {
          display:flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
          margin: 12px 0 12px;
        }
        .pm-left-stats { display:flex; align-items: baseline; gap: 12px; }
        .pm-big {
          font-size: 48px;
          font-weight: 850;
          letter-spacing: -0.04em;
          line-height: 1;
        }
        .pm-delta {
          display:inline-flex;
          align-items:center;
          gap: 6px;
          font-size: 14px;
          font-weight: 800;
          padding: 6px 10px;
          border-radius: 999px;
          background: color-mix(in srgb, var(--pm-green) 14%, transparent);
          color: var(--pm-green);
          white-space: nowrap;
        }
        .pm-delta.neg {
          background: color-mix(in srgb, var(--pm-red) 14%, transparent);
          color: var(--pm-red);
        }

        .pm-right-meta {
          text-align: right;
          color: var(--pm-muted);
          font-size: 13px;
          line-height: 1.2;
          white-space: nowrap;
        }

        .pm-chart-container {
          position: relative;
          height: 230px;
          border-radius: 14px;
          overflow: hidden;
          border: 1px solid color-mix(in srgb, var(--pm-border) 70%, transparent);
          background: linear-gradient(180deg, color-mix(in srgb, var(--pm-blue) 16%, transparent) 0%, rgba(0,0,0,0) 65%);
        }
        canvas.pm-canvas { width:100%; height:100%; display:block; cursor: crosshair; }

        .pm-tooltip {
          position:absolute;
          pointer-events:none;
          background: var(--pm-tooltip-bg);
          border: 1px solid var(--pm-tooltip-border);
          border-radius: 14px;
          padding: 10px 12px;
          box-shadow: 0 16px 32px rgba(0,0,0,0.12);
          backdrop-filter: blur(8px);
          opacity: 0;
          transform: translate(-50%, -120%);
          transition: opacity 120ms ease;
          min-width: 96px;
          text-align: center;
          z-index: 10;
        }
        .pm-tooltip.visible { opacity: 1; }
        .pm-tooltip .t-date { color: var(--pm-muted); font-size: 12px; font-weight: 750; margin-bottom: 2px; }
        .pm-tooltip .t-val { color: var(--pm-text); font-size: 20px; font-weight: 900; letter-spacing: -0.02em; }

        .pm-controls {
          display:flex;
          justify-content: space-between;
          align-items:center;
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
          font-weight: 800;
          padding: 8px 12px;
          border-radius: 999px;
          cursor: pointer;
          transition: all 140ms ease;
        }
        .pm-pill:hover { color: var(--pm-text); }
        .pm-pill.active {
          background: var(--pm-pill-active);
          color: var(--pm-text);
          box-shadow: 0 10px 18px rgba(15,23,42,0.10);
        }

        .pm-footer {
          display:flex;
          justify-content: space-between;
          align-items:center;
          gap: 12px;
          color: var(--pm-muted);
          font-size: 13px;
          border-top: 1px solid color-mix(in srgb, var(--pm-border) 55%, transparent);
          margin-top: 14px;
          padding-top: 12px;
        }

        .pm-error {
          margin-top: 10px;
          padding: 10px 12px;
          border-radius: 12px;
          background: color-mix(in srgb, var(--pm-red) 12%, transparent);
          border: 1px solid color-mix(in srgb, var(--pm-red) 30%, transparent);
          color: color-mix(in srgb, var(--pm-red) 92%, white);
          font-size: 13px;
          font-weight: 650;
          display:none;
        }

        .pm-loading {
          margin-top: 8px;
          color: var(--pm-muted);
          font-size: 13px;
          font-weight: 650;
        }
      </style>

      <div class="pm-card pm-theme-${escapeHtml(this._theme)}">
        <div class="pm-header">
          <div class="pm-sub">Prediction market</div>
          <h3 class="pm-title" id="pm_title">Loading…</h3>
        </div>

        <div class="pm-stats">
          <div class="pm-left-stats">
            <div class="pm-big" id="pm_price">--%</div>
            <div class="pm-delta" id="pm_delta">↗ +0.0%</div>
          </div>
          <div class="pm-right-meta">
            <div id="pm_ends">Ends —</div>
          </div>
        </div>

        <div class="pm-chart-container">
          <div class="pm-tooltip" id="pm_tooltip">
            <div class="t-date" id="t_date"></div>
            <div class="t-val" id="t_val"></div>
          </div>
          <canvas id="pm_canvas" class="pm-canvas"></canvas>
        </div>

        <div class="pm-controls">
          <div class="pm-pills">
            ${["1D","1W","1M","ALL"].map(tf => `<button type="button" class="pm-pill ${tf===this._timeframe?'active':''}" data-tf="${tf}">${tf}</button>`).join("")}
          </div>
          <div class="pm-right-meta">
            <div id="pm_updated">Updated —</div>
          </div>
        </div>

        <div class="pm-footer">
          <span id="pm_vol">Volume: —</span>
          <span>Probable</span>
        </div>

        <div class="pm-loading" id="pm_loading">Loading markets…</div>
        <div class="pm-error" id="pm_error"></div>
      </div>
    `;
  }

  cacheDom() {
    this._canvas = this.querySelector("#pm_canvas");
    this._ctx = this._canvas.getContext("2d");
    this.tooltipEl = this.querySelector("#pm_tooltip");

    this._titleEl = this.querySelector("#pm_title");
    this._priceEl = this.querySelector("#pm_price");
    this._deltaEl = this.querySelector("#pm_delta");
    this._endsEl = this.querySelector("#pm_ends");
    this._volEl = this.querySelector("#pm_vol");
    this._updatedEl = this.querySelector("#pm_updated");

    this._pillBtns = [...this.querySelectorAll(".pm-pill")];

    this._loadingEl = this.querySelector("#pm_loading");
    this._errorEl = this.querySelector("#pm_error");
  }

  bindEvents() {
    this._pillBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        this._pillBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this._timeframe = btn.getAttribute("data-tf") || "ALL";
        this.updateChart(); // just redraw
      });
    });

    this._canvas.addEventListener("mousemove", (e) => this.handleHover(e));
    this._canvas.addEventListener("mouseleave", () => this.hideTooltip());

    window.addEventListener("resize", () => {
      this.resizeCanvas();
      this.drawChart(this.getFilteredSeries());
    });
  }

  async fetchMarkets() {
    const apiBase = getApiBase();
    const query = this.getAttribute("query") || "";
    const articleUrl = this.getAttribute("article-url") || null;
    const limit = Number(this.getAttribute("limit") || 5);

    try {
      this.setError("");
      this.setLoading(true);

      const res = await fetch(`${apiBase}/v1/widget/markets`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ articleUrl, query, limit }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

      this._markets = Array.isArray(data.markets) ? data.markets : [];

      if (!this._markets.length) {
        throw new Error("No relevant markets found.");
      }

      if (this._updatedEl) {
        const when = data.updatedAt ? new Date(data.updatedAt) : new Date();
        this._updatedEl.textContent = `Updated ${when.toLocaleString()}`;
      }

      // Select first market
      this._selectedIndex = 0;
      this.setLoading(false);
    } catch (e) {
      this.setLoading(false);
      this.setError(`Widget failed: ${String(e?.message || e)}`);
      this._markets = [];
    }
  }

  updateUI() {
    if (!this._markets.length) return;

    const m = this._markets[this._selectedIndex];

    // Title
    this._titleEl.textContent = m.question || m.title || "Market";

    // Probability
    const yes = getProbabilityFraction(m);
    const pct = Math.round(yes * 100);
    this._priceEl.textContent = `${pct}%`;

    // 24h change
    const change = getChange24hFraction(m); // fraction
    const changePct = change * 100;
    this._deltaEl.classList.toggle("neg", changePct < 0);
    this._deltaEl.textContent = `${changePct >= 0 ? "↗" : "↘"} ${changePct >= 0 ? "+" : "-"}${Math.abs(changePct).toFixed(1)}%`;

    // Ends
    const endTime = m.endTime ?? m.end_time ?? null;
    const endStr = endTime
      ? new Date(endTime).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
      : "—";
    this._endsEl.textContent = `Ends ${endStr}`;

    // Volume
    const vol = m.volume ?? m.volume_num ?? null;
    this._volEl.textContent = `Volume: ${vol == null ? "—" : `$${Number(vol).toLocaleString()}`}`;

    // Series
    this.chartData = normalizeSeries(m.series);
    if (!this.chartData.length) {
      // generate a synthetic series so the chart still looks good for demos
      this.chartData = generateSeries(yes);
    }

    this.resizeCanvas();
    this.drawChart(this.getFilteredSeries());
  }

  updateChart() {
    if (!this.chartData.length) return;
    this.resizeCanvas();
    this.drawChart(this.getFilteredSeries());
  }

  getFilteredSeries() {
    const tfMs = {
      "1D": 24 * 60 * 60 * 1000,
      "1W": 7 * 24 * 60 * 60 * 1000,
      "1M": 30 * 24 * 60 * 60 * 1000,
      "ALL": Infinity,
    }[this._timeframe] ?? Infinity;

    const now = Date.now();
    const pts = this.chartData.filter((p) => now - p.t <= tfMs);
    return pts.length >= 2 ? pts : this.chartData;
  }

  resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this._canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    if (this._canvas.width !== w || this._canvas.height !== h) {
      this._canvas.width = w;
      this._canvas.height = h;
    }
    // Reset transform so we don't accumulate scaling
    this._ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  drawChart(pts) {
    const ctx = this._ctx;
    const dpr = window.devicePixelRatio || 1;

    const W = this._canvas.width / dpr;
    const H = this._canvas.height / dpr;

    ctx.clearRect(0, 0, W, H);

    const padLeft = 44;
    const padRight = 12;
    const padTop = 14;
    const padBottom = 30;

    const plotW = W - padLeft - padRight;
    const plotH = H - padTop - padBottom;

    // Grid + y labels
    ctx.lineWidth = 1;
    ctx.strokeStyle = getCssVar(this, "--pm-grid") || "rgba(148,163,184,0.18)";
    ctx.fillStyle = getCssVar(this, "--pm-muted") || "rgba(100,116,139,0.95)";
    ctx.font = "12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";

    const yTicks = [0, 25, 50, 75, 100];
    for (const yv of yTicks) {
      const y = padTop + (1 - yv / 100) * plotH;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(W - padRight, y);
      ctx.stroke();
      ctx.fillText(`${yv}%`, 8, y + 4);
    }

    if (!pts || pts.length < 2) return;

    const minT = pts[0].t;
    const maxT = pts[pts.length - 1].t;

    const xScale = (t) => padLeft + ((t - minT) / Math.max(1, maxT - minT)) * plotW;
    const yScale = (p) => padTop + (1 - p) * plotH;

    // store for hover math
    this._scale = { padLeft, padTop, padBottom, plotW, plotH, minT, maxT };

    // Area gradient
    const grad = ctx.createLinearGradient(0, padTop, 0, padTop + plotH);
    grad.addColorStop(0, getCssVar(this, "--pm-area-top") || "rgba(59,130,246,0.22)");
    grad.addColorStop(0.7, getCssVar(this, "--pm-area-mid") || "rgba(59,130,246,0.06)");
    grad.addColorStop(1, getCssVar(this, "--pm-area-bot") || "rgba(59,130,246,0.00)");

    // Area path
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

    // Line
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
    ctx.strokeStyle = getCssVar(this, "--pm-blue") || "#3b82f6";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();

    // X-axis labels (start / mid / end)
    const fmt = (t) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });

    const t0 = minT;
    const t1 = minT + (maxT - minT) / 2;
    const t2 = maxT;

    const yLabel = padTop + plotH + 20;
    ctx.fillStyle = getCssVar(this, "--pm-muted") || "rgba(100,116,139,0.95)";

    ctx.fillText(fmt(t0), padLeft, yLabel);

    const midText = fmt(t1);
    const midW = ctx.measureText(midText).width;
    ctx.fillText(midText, padLeft + plotW / 2 - midW / 2, yLabel);

    const endText = fmt(t2);
    const endW = ctx.measureText(endText).width;
    ctx.fillText(endText, padLeft + plotW - endW, yLabel);
  }

  handleHover(e) {
    if (!this._scale || !this.tooltipEl) return;
    const pts = this.getFilteredSeries();
    if (!pts || pts.length < 2) return;

    const rect = this._canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;

    const { padLeft, plotW, plotH, padTop, minT, maxT } = this._scale;

    const ratio = Math.min(Math.max((mouseX - padLeft) / Math.max(1, plotW), 0), 1);
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

    const x = padLeft + ((closest.t - minT) / Math.max(1, maxT - minT)) * plotW;
    const y = padTop + (1 - closest.p) * plotH;

    const dateStr = new Date(closest.t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const valStr = `${(closest.p * 100).toFixed(1)}%`;

    this.querySelector("#t_date").textContent = dateStr;
    this.querySelector("#t_val").textContent = valStr;

    // Keep tooltip in bounds a bit
    const pad = 18;
    const clampedX = Math.min(Math.max(x, pad), rect.width - pad);

    this.tooltipEl.style.left = `${clampedX}px`;
    this.tooltipEl.style.top = `${y}px`;
    this.tooltipEl.classList.add("visible");
  }

  hideTooltip() {
    if (!this.tooltipEl) return;
    this.tooltipEl.classList.remove("visible");
  }

  setLoading(on) {
    if (!this._loadingEl) return;
    this._loadingEl.style.display = on ? "block" : "none";
  }

  setError(msg) {
    if (!this._errorEl) return;
    if (!msg) {
      this._errorEl.style.display = "none";
      this._errorEl.textContent = "";
      return;
    }
    this._errorEl.style.display = "block";
    this._errorEl.textContent = msg;
  }
}

customElements.define("probable-markets", ProbableMarkets);

/* ---------------- helpers ---------------- */

function getApiBase() {
  const script =
    document.currentScript ||
    [...document.scripts].find((s) => (s.src || "").includes("embed.js"));
  if (script?.src) return new URL(script.src).origin;
  return window.location.origin;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeSeries(series) {
  if (!Array.isArray(series)) return [];
  const out = series
    .filter((p) => typeof p?.t === "number" && typeof p?.p === "number")
    .map((p) => ({ t: p.t, p: clamp01(p.p) }))
    .sort((a, b) => a.t - b.t);
  return out;
}

function generateSeries(currentYes) {
  const pts = [];
  const now = Date.now();
  const hours = 7 * 24;
  const start = now - hours * 60 * 60 * 1000;
  let p = clamp01(currentYes);

  for (let i = 0; i <= hours; i++) {
    const t = start + i * 60 * 60 * 1000;
    const drift = (clamp01(currentYes) - p) * 0.03;
    const noise = (Math.random() - 0.5) * 0.012;
    p = clamp01(p + drift + noise);
    pts.push({ t, p });
  }
  return pts;
}

function clamp01(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

function getProbabilityFraction(m) {
  if (Number.isFinite(m?.yes)) return clamp01(m.yes);
  if (Number.isFinite(m?.probability)) return clamp01(m.probability / 100);

  const op = m?.outcome_prices || m?.outcomePrices || m?.outcome_prices_json;
  if (op && typeof op === "object") {
    const v = op.Yes ?? op.yes ?? op.YES;
    if (Number.isFinite(v)) return clamp01(Number(v));
    if (Array.isArray(op) && Number.isFinite(op[0])) return clamp01(Number(op[0]));
  }

  return 0.5;
}

function getChange24hFraction(m) {
  if (Number.isFinite(m?.trend24h)) return Number(m.trend24h);
  if (Number.isFinite(m?.change24h)) return Number(m.change24h) / 100;
  if (Number.isFinite(m?.delta24h)) return Number(m.delta24h);
  return 0;
}

function getCssVar(el, name) {
  try {
    return getComputedStyle(el).getPropertyValue(name).trim();
  } catch {
    return "";
  }
}
