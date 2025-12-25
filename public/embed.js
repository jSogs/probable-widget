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
  }

  async connectedCallback() {
    const theme = this.getAttribute("theme") || "light";
    this._theme = theme;

    this.innerHTML = `
      <style>
        :host { display:block; --blue: #3b82f6; }
        .pm-card {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          background: var(--pm-bg);
          color: var(--pm-text);
          border: 1px solid var(--pm-border);
          border-radius: 16px;
          padding: 20px;
          box-shadow: var(--pm-shadow);
          max-width: 500px;
        }

        /* Target Screenshot 2 Colors (Light) */
        .pm-theme-light {
          --pm-bg: #ffffff;
          --pm-text: #0f172a;
          --pm-muted: #64748b;
          --pm-border: #f1f5f9;
          --pm-shadow: 0 4px 20px rgba(0,0,0,0.05);
          --pm-chart-fill: rgba(59, 130, 246, 0.08);
          --pm-tooltip-bg: #ffffff;
        }
        
        .pm-theme-dark {
          --pm-bg: #0b1220;
          --pm-text: #f8fafc;
          --pm-muted: #94a3b8;
          --pm-border: rgba(255,255,255,0.1);
          --pm-shadow: 0 10px 30px rgba(0,0,0,0.3);
          --pm-chart-fill: rgba(59, 130, 246, 0.15);
          --pm-tooltip-bg: #1e293b;
        }

        .pm-header { margin-bottom: 8px; }
        .pm-title-row { display: flex; align-items: center; gap: 4px; cursor: pointer; }
        .pm-title-row h3 { margin: 0; font-size: 18px; font-weight: 700; }
        
        .pm-stats { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
        .pm-big-pct { font-size: 42px; font-weight: 800; letter-spacing: -1px; }
        .pm-delta { font-size: 16px; font-weight: 600; color: #16a34a; display: flex; align-items: center; }

        .pm-chart-container { position: relative; height: 220px; margin-bottom: 16px; }
        canvas { width: 100%; height: 100%; }

        /* Floating Tooltip Style */
        .pm-tooltip {
          position: absolute;
          background: var(--pm-tooltip-bg);
          border-radius: 10px;
          padding: 8px 12px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.12);
          border: 1px solid var(--pm-border);
          pointer-events: none;
          opacity: 0;
          transform: translate(-50%, -120%);
          transition: opacity 0.1s ease;
          z-index: 10;
          text-align: center;
        }
        .pm-tooltip .t-date { color: var(--pm-muted); font-size: 11px; margin-bottom: 2px; text-transform: uppercase; }
        .pm-tooltip .t-val { font-weight: 800; font-size: 15px; }

        .pm-controls { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .pm-pills { display: flex; background: #f1f5f9; border-radius: 8px; padding: 3px; gap: 2px; }
        .pm-theme-dark .pm-pills { background: rgba(255,255,255,0.05); }
        .pm-pill { 
          border: none; background: none; padding: 6px 12px; font-size: 12px; 
          font-weight: 600; color: var(--pm-muted); cursor: pointer; border-radius: 6px;
        }
        .pm-pill.active { background: white; color: black; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
        .pm-theme-dark .pm-pill.active { background: rgba(255,255,255,0.15); color: white; }

        .pm-meta-row { 
          display: flex; justify-content: space-between; font-size: 13px; 
          color: var(--pm-muted); border-top: 1px solid var(--pm-border); padding-top: 12px;
        }
      </style>

      <div class="pm-card pm-theme-${this._theme}">
        <div class="pm-header">
          <div class="pm-title-row" id="title_trigger">
            <h3 id="m_title">Loading market...</h3>
            <span style="font-size: 12px; opacity: 0.5;">▼</span>
          </div>
        </div>

        <div class="pm-stats">
          <div class="pm-big-pct" id="m_price">--%</div>
          <div class="pm-delta" id="m_delta"></div>
        </div>

        <div class="pm-chart-container">
          <div id="pm_tooltip" class="pm-tooltip">
            <div class="t-date" id="t_date"></div>
            <div class="t-val" id="t_val"></div>
          </div>
          <canvas id="pm_canvas"></canvas>
        </div>

        <div class="pm-controls">
          <div class="pm-pills">
            ${["1D","1W","1M","ALL"].map(tf => `<button class="pm-pill ${tf===this._timeframe?'active':''}" data-tf="${tf}">${tf}</button>`).join('')}
          </div>
          <div id="m_ends" style="font-size: 13px; color: var(--pm-muted);">Ends --</div>
        </div>

        <div class="pm-meta-row">
          <span id="m_vol">Volume: --</span>
          <span id="m_updated">Updated just now</span>
        </div>
      </div>
    `;

    this._canvas = this.querySelector("#pm_canvas");
    this.tooltipEl = this.querySelector("#pm_tooltip");
    
    this.setupListeners();
    this.fetchData();
  }

  setupListeners() {
    this.querySelectorAll('.pm-pill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.querySelectorAll('.pm-pill').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this._timeframe = e.target.dataset.tf;
        this.renderChart();
      });
    });

    this._canvas.addEventListener("mousemove", (e) => this.handleHover(e));
    this._canvas.addEventListener("mouseleave", () => this.tooltipEl.style.opacity = "0");
  }

  // Parses your database schema (outcome_prices jsonb)
  getProbability(market) {
    if (!market.outcome_prices) return 0.5;
    
    // Logic: Look for "Yes" key, or the first key if binary
    const prices = market.outcome_prices;
    if (prices["Yes"] !== undefined) return parseFloat(prices["Yes"]);
    if (prices["yes"] !== undefined) return parseFloat(prices["yes"]);
    
    // Fallback: use first numeric value found
    const firstKey = Object.keys(prices)[0];
    return parseFloat(prices[firstKey]) || 0.5;
  }

  async fetchData() {
    const query = this.getAttribute("query") || "";
    // Simulated fetch - replace with your actual API call logic
    // The data returned should match your Postgres schema
    try {
      // For demo, we assume this._markets is populated from your match_markets function
      const res = await fetch(`${apiBase}/v1/widget/markets`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ articleUrl, query, limit: 5 }),
      });;
      const data = await response.json();
      this._markets = data.markets;
      this.updateUI();
    } catch (e) {
      console.error("Fetch failed", e);
    }
  }

  updateUI() {
    const m = this._markets[this._selectedIndex];
    if (!m) return;

    const prob = this.getProbability(m);
    this.querySelector("#m_title").textContent = m.question || m.title;
    this.querySelector("#m_price").textContent = `${Math.round(prob * 100)}%`;
    this.querySelector("#m_vol").textContent = `Volume: $${(m.volume_num || 0).toLocaleString()}`;
    
    const endStr = m.end_time ? new Date(m.end_time).toLocaleDateString(undefined, {month:'short', day:'numeric', year:'numeric'}) : '--';
    this.querySelector("#m_ends").textContent = `Ends ${endStr}`;

    // Dummy series data for demo if database series isn't present
    this.chartData = this.generateSeries(prob);
    this.renderChart();
  }

  generateSeries(currentProb) {
    // Generates a smooth random walk ending at current price for demo
    const pts = [];
    const now = Date.now();
    for (let i = 0; i < 50; i++) {
      pts.push({
        t: now - (50 - i) * 3600000,
        p: currentProb + (Math.random() - 0.5) * 0.1
      });
    }
    pts[pts.length - 1].p = currentProb;
    return pts;
  }

  renderChart() {
    const ctx = this._canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const rect = this._canvas.getBoundingClientRect();
    
    this._canvas.width = rect.width * dpr;
    this._canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const pts = this.chartData;
    const w = rect.width;
    const h = rect.height;
    
    const padL = 35;
    const padB = 25;
    const chartW = w - padL;
    const chartH = h - padB;

    ctx.clearRect(0,0,w,h);

    // Draw Y-Axis Grid (0, 25, 50, 75, 100)
    ctx.strokeStyle = this._theme === 'light' ? '#f1f5f9' : 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.font = "10px sans-serif";
    ctx.fillStyle = "#94a3b8";
    
    [0, 0.25, 0.5, 0.75, 1].forEach(tick => {
      const y = chartH - (tick * chartH);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(w, y);
      ctx.stroke();
      ctx.fillText(`${tick * 100}%`, 0, y + 4);
    });

    if (!pts.length) return;

    // Scaling functions
    const minT = pts[0].t;
    const maxT = pts[pts.length-1].t;
    const getX = (t) => padL + ((t - minT) / (maxT - minT)) * chartW;
    const getY = (p) => chartH - (p * chartH);

    // Draw Area
    const grad = ctx.createLinearGradient(0, 0, 0, chartH);
    grad.addColorStop(0, this._theme === 'light' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.2)');
    grad.addColorStop(1, 'rgba(59, 130, 246, 0)');
    
    ctx.beginPath();
    ctx.moveTo(getX(pts[0].t), chartH);
    this.drawSmoothPath(ctx, pts, getX, getY);
    ctx.lineTo(getX(pts[pts.length-1].t), chartH);
    ctx.fillStyle = grad;
    ctx.fill();

    // Draw Line
    ctx.beginPath();
    this.drawSmoothPath(ctx, pts, getX, getY);
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.stroke();
  }

  drawSmoothPath(ctx, pts, getX, getY) {
    ctx.moveTo(getX(pts[0].t), getY(pts[0].p));
    for (let i = 0; i < pts.length - 1; i++) {
      const x1 = getX(pts[i].t);
      const y1 = getY(pts[i].p);
      const x2 = getX(pts[i+1].t);
      const y2 = getY(pts[i+1].p);
      const xc = (x1 + x2) / 2;
      ctx.bezierCurveTo(xc, y1, xc, y2, x2, y2);
    }
  }

  handleHover(e) {
    const rect = this._canvas.getBoundingClientRect();
    const x = e.clientX - rect.left - 35; // adjusting for padL
    const chartW = rect.width - 35;
    
    if (x < 0) return;

    const ratio = Math.min(Math.max(x / chartW, 0), 1);
    const index = Math.floor(ratio * (this.chartData.length - 1));
    const point = this.chartData[index];

    if (point) {
      this.tooltipEl.style.opacity = "1";
      this.tooltipEl.style.left = `${getX(point.t, rect.width)}px`;
      this.tooltipEl.style.top = `${getY(point.p, rect.height)}px`;
      
      this.querySelector("#t_date").textContent = new Date(point.t).toLocaleDateString(undefined, {month:'short', day:'numeric'});
      this.querySelector("#t_val").textContent = `${Math.round(point.p * 100)}%`;
    }
  }
}

// Helper for hover positioning outside the render loop
function getX(t, w) {
  // Simple re-calc for tooltip positioning
  return 35 + ((t - minT_global) / (maxT_global - minT_global)) * (w - 35);
}
// Note: In production, store scaling factors as class properties to avoid re-calc

function getApiBase() {
  const script =
    document.currentScript ||
    [...document.scripts].find((s) => (s.src || "").includes("embed.js"));
  if (script?.src) return new URL(script.src).origin;
  return window.location.origin;
}

customElements.define("probable-markets", ProbableMarkets);