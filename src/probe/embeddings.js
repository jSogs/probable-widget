export async function embedText(text) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY not set");
  
    const input = String(text || "").slice(0, 8000);
  
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${key}`
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input
      })
    });
  
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Embeddings error: ${res.status} ${t}`);
    }
  
    const data = await res.json();
    const emb = data?.data?.[0]?.embedding;
    if (!Array.isArray(emb) || !emb.length) throw new Error("No embedding returned");
    return emb;
  }
  