export function clamp01(x) {
    const n = Number(x);
    if (!Number.isFinite(n)) return 0.5;
    return Math.max(0, Math.min(1, n));
  }
  
  export function sanitizeTs(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9_]/g, "");
  }
  
  export function buildMarketUrl(r) {
    // You can refine these per-platform once you know the exact URL patterns.
    const platform = String(r.platform || "").toLowerCase();
    const slug = r.slug;
    const externalId = r.external_id;
  
    if (platform.includes("polymarket")) {
      if (slug) return `https://polymarket.com/market/${slug}`;
      return "https://polymarket.com";
    }
    if (platform.includes("kalshi")) {
      // Kalshi URL patterns vary; this is a safe default for MVP.
      return "https://kalshi.com/markets";
    }
  
    // If you store canonical URL in `source` or elsewhere, adjust here.
    return "https://probable-api.netlify.app";
  }
  
  /**
   * Try to extract a Yes probability from outcomes/outcome_prices jsonb.
   * Supports:
   *  - outcomes=["Yes","No"], outcome_prices=[0.6,0.4]
   *  - outcome_prices={"Yes":0.6,"No":0.4}
   *  - outcomes=[{name:"Yes"},{name:"No"}], outcome_prices=[...]
   */
  export function extractYesProbability(outcomes, outcome_prices) {
    // A) aligned arrays
    if (Array.isArray(outcomes) && Array.isArray(outcome_prices)) {
      const idx1 = outcomes.findIndex(o => String(o).toLowerCase() === "yes");
      if (idx1 >= 0 && typeof outcome_prices[idx1] === "number") return clamp01(outcome_prices[idx1]);
  
      if (outcomes[0] && typeof outcomes[0] === "object") {
        const idx2 = outcomes.findIndex(o => String(o.name || o.label || "").toLowerCase() === "yes");
        if (idx2 >= 0 && typeof outcome_prices[idx2] === "number") return clamp01(outcome_prices[idx2]);
      }
    }
  
    // B) map/object
    if (outcome_prices && typeof outcome_prices === "object" && !Array.isArray(outcome_prices)) {
      const y = outcome_prices.Yes ?? outcome_prices.yes;
      if (typeof y === "number") return clamp01(y);
    }
  
    return 0.5;
  }
  