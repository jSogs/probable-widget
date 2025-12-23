import "dotenv/config";

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import widgetRoutes from "./routes/widget.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set("trust proxy", true);
app.use(express.json({ limit: "1mb" }));

// CORS for embeds on publisher domains
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type, authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// Serve static embed assets
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/v1/widget", widgetRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: String(err?.message || err) });
});

const port = Number(process.env.PORT || 8080);
app.listen(port, () => console.log(`probable-widget listening on :${port}`));