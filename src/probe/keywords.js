export function topKeywords(text, n = 10) {
    const stop = new Set([
      "the","a","an","and","or","to","of","in","on","for","with","at","by","from",
      "is","are","was","were","be","been","it","that","this","as","but","if","not"
    ]);
  
    const words = (text || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(w => w.length >= 4 && !stop.has(w));
  
    const freq = new Map();
    for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);
  
    return [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([w]) => w);
  }
  