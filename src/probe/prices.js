import { supabaseAdmin } from "./supabase.js";
import { clamp01 } from "./util.js";

/**
 * Returns [{t: epochMs, p: 0..1}]
 * If USE_PRICE_POINTS=true and table exists: reads public.market_price_points
 * else: returns a synthetic series from current yes probability so UI ships today.
 */
export async function getSeriesForMarket(marketId, yesProb, tf = "ALL") {
  const usePoints = String(process.env.USE_PRICE_POINTS || "false").toLowerCase() === "true";

  if (usePoints) {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("market_price_points")
      .select("t,p")
      .eq("market_id", marketId)
      .order("t", { ascending: true })
      .limit(800);

    if (!error && Array.isArray(data) && data.length) {
      const series = data
        .map(row => ({
          t: typeof row.t === "number" ? row.t : Date.parse(row.t),
          p: clamp01(row.p)
        }))
        .filter(p => Number.isFinite(p.t) && Number.isFinite(p.p));

      return filterTf(series, tf);
    }
    // fall through to synthetic if table empty
  }

  // Synthetic series (MVP): gentle wiggle around current yesProb
  if (typeof yesProb !== "number") return [];
  const now = Date.now();
  const base = clamp01(yesProb);
  const series = Array.from({ length: 120 }).map((_, k) => ({
    t: now - (120 - k) * 6 * 3600 * 1000,
    p: clamp01(base + Math.sin(k / 10) * 0.03)
  }));
  return filterTf(series, tf);
}

export function computeTrend24h(series) {
  if (!series?.length) return 0;
  const last = series[series.length - 1];
  const cutoff = last.t - 24 * 3600 * 1000;

  let before = series[0];
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i].t <= cutoff) { before = series[i]; break; }
  }
  return clamp01(last.p) - clamp01(before.p);
}

function filterTf(series, tf) {
  if (tf === "ALL") return series;
  const now = Date.now();
  const ms = ({ "1D": 864e5, "1W": 7 * 864e5, "1M": 30 * 864e5 }[tf] ?? Infinity);
  return series.filter(p => (now - p.t) <= ms);
}
