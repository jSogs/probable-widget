import express from "express";
import { getOrSet } from "../probe/cache.js";
import { fetchAndExtractArticle } from "../probe/article.js";
import { embedText } from "../probe/embeddings.js";
import { topKeywords } from "../probe/keywords.js";
import { findRelevantMarkets } from "../probe/marketSearch.js";
import { getSeriesForMarket, computeTrend24h } from "../probe/prices.js";
import { extractYesProbability } from "../probe/util.js";

const router = express.Router();

/**
 * POST /v1/widget/markets
 * Body: { articleUrl?: string, query?: string, limit?: number }
 */
router.post("/markets", async (req, res, next) => {
  try {
    const { articleUrl = "", query = "", limit = 5 } = req.body || {};
    const k = Math.min(Math.max(Number(limit) || 5, 1), 5);

    const cacheKey = `markets:${articleUrl}:${query}:${k}`;

    const result = await getOrSet(cacheKey, async () => {
        let title = "";
        let text = "";

        if (articleUrl?.trim()) {
        const out = await fetchAndExtractArticle(articleUrl.trim());
        title = out.title || "";
        text = out.text || "";
        } else if (query?.trim()) {
        title = query.trim();
        text = query.trim();
        } else {
        return { status: 400, body: { error: "Provide articleUrl or query" } };
        }

        const keywords = topKeywords(`${title} ${text}`, 12);
        const fingerprint = `${title}\n\n${text.slice(0, 6000)}`;
        const embedding = await embedText(fingerprint);

        const marketsRaw = await findRelevantMarkets({
        queryEmbedding: embedding,
        keywords,
        limit: k
        });

        const markets = await Promise.all(
        marketsRaw.map(async (m) => {
            const yes = extractYesProbability(m.outcomes, m.outcome_prices);
            const series = await getSeriesForMarket(m.id, yes, "ALL");
            const trend24h = computeTrend24h(series);

            return {
            id: m.id,
            externalId: m.external_id,
            platform: m.platform,
            title: m.title,
            url: m.url,
            yes,
            trend24h,
            endTime: m.end_time ?? null,
            volume: m.volume_num ?? null,
            liquidity: m.liquidity_num ?? null,
            qualityScore: m.quality_score ?? null,
            series
            };
        })
        );

        return {
        status: 200,
        body: {
            updatedAt: new Date().toISOString(),
            article: { title, url: articleUrl || null, keywords },
            markets
        }
        };
    });

    res.status(result.status).json(result.body);
    } catch (e) {
        next(e);
    }
});

/**
 * GET /v1/widget/series?id=...&tf=...
 */
router.get("/series", async (req, res) => {
    try {
        const id = Number(req.query?.id);
        const tf = String(req.query?.tf || "ALL");

        if (!Number.isFinite(id)) return res.status(400).json({ error: "Missing/invalid id" });

        const cacheKey = `series:${id}:${tf}`;

        const result = await getOrSet(cacheKey, async () => {
            // We don’t know yes here; series endpoint is a fallback.
            // We'll return series points if price_points exists; else empty.
            const series = await getSeriesForMarket(id, null, tf);
            return { status: 200, body: { id, tf, series, updatedAt: new Date().toISOString() } };
        }, 60);

        res.status(result.status).json(result.body);
    } catch (e) {
        next(e);
    }
  
});

export default router;
