import { parse } from "node-html-parser";

export async function fetchAndExtractArticle(url) {
  const maxChars = Number(process.env.MAX_ARTICLE_CHARS || 20000);

  const res = await fetch(url, { headers: { "user-agent": "ProbableBot/1.0" } });
  if (!res.ok) throw new Error(`Failed to fetch article: ${res.status}`);

  const html = await res.text();
  const root = parse(html);

  root.querySelectorAll("script,style,noscript,svg,header,footer,nav,aside").forEach(n => n.remove());

  const candidates = [
    root.querySelector("article"),
    root.querySelector('[role="main"]'),
    root.querySelector("main"),
    root.querySelector("[itemprop='articleBody']"),
    root.querySelector(".article-body"),
    root.querySelector(".content")
  ].filter(Boolean);

  const node = candidates[0] || root;

  const title =
    root.querySelector("meta[property='og:title']")?.getAttribute("content") ||
    root.querySelector("title")?.textContent?.trim() ||
    "";

  const text = node.textContent.replace(/\s+/g, " ").trim().slice(0, maxChars);
  return { title, text };
}
