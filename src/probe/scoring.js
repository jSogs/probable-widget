export function scoreMarket(row) {
    const sim = typeof row.similarity === "number" ? clamp01(row.similarity) : 0.2;
    const q = clamp01(Number(row.quality_score || 0));
  
    const vol = logNorm(row.volume_num);
    const liq = logNorm(row.liquidity_num);
  
    // Blend: relevance dominates; quality/volume ensures usefulness.
    return sim * 0.65 + q * 0.2 + vol * 0.1 + liq * 0.05;
  }
  
  function logNorm(x) {
    const n = Number(x || 0);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return clamp01(Math.log10(n + 1) / 6);
  }
  
  function clamp01(x) {
    const n = Number(x);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n));
  }
  