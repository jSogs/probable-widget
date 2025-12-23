import { supabaseAdmin } from "./supabase.js";
import { scoreMarket } from "./scoring.js";
import { buildMarketUrl, sanitizeTs } from "./util.js";

export async function findRelevantMarkets({ queryEmbedding, keywords, limit = 5 }) {
  const supabase = supabaseAdmin();

  // 1) Vector shortlist via RPC
  if (Array.isArray(queryEmbedding) && queryEmbedding.length) {
    const { data, error } = await supabase.rpc("match_markets", {
      query_embedding: queryEmbedding,
      match_count: limit * 14
    });

    if (!error && Array.isArray(data) && data.length) {
      const ranked = data
        .map(r => ({ ...r, url: buildMarketUrl(r) }))
        .map(r => ({ ...r, _score: scoreMarket(r) }))
        .sort((a, b) => b._score - a._score);

      return dedupeAndPick(ranked, limit).map(stripInternal);
    }
  }

  // 2) Full-text fallback
  const terms = (keywords || []).slice(0, 6).filter(Boolean);
  if (!terms.length) return [];

  const tsQuery = terms.map(t => `${sanitizeTs(t)}:*`).join(" | ");

  const { data, error } = await supabase
    .from("markets")
    .select("id,external_id,platform,slug,title,question,description,end_time,closed,volume_num,liquidity_num,quality_score,outcomes,outcome_prices")
    .eq("closed", false)
    .textSearch("search_tsvector", tsQuery, { type: "raw" })
    .order("quality_score", { ascending: false })
    .order("volume_num", { ascending: false })
    .limit(limit * 16);

  if (error) throw error;

  const ranked = (data || [])
    .map(r => ({ ...r, similarity: null, url: buildMarketUrl(r) }))
    .map(r => ({ ...r, _score: scoreMarket(r) }))
    .sort((a, b) => b._score - a._score);

  return dedupeAndPick(ranked, limit).map(stripInternal);
}

function dedupeAndPick(items, limit) {
  const out = [];
  const seen = new Set();
  for (const m of items) {
    const key = String(m.title || "").toLowerCase().replace(/\s+/g, " ").slice(0, 160);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(m);
    if (out.length >= limit) break;
  }
  return out;
}

function stripInternal(m) {
  const { _score, ...rest } = m;
  return rest;
}
