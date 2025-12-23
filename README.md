# probable-widget
UI widget bringing prediction market data direct to writers.

# Probable Publisher Widget (MVP)

Serves:
- Static embed assets:
  - GET /embed.js
  - GET /widget.html + /widget.js (iframe fallback)
- Widget API:
  - POST /v1/widget/markets
  - GET  /v1/widget/series?id=...&tf=...

## Local
npm i
cp .env.example .env   # fill it
npm run dev

Open:
- http://localhost:8080/widget.html?query=bitcoin
- http://localhost:8080/widget.html?article=https%3A%2F%2Fexample.com

## Publisher embed
```html
<script src="https://YOUR_DOMAIN/embed.js" defer></script>
<probable-markets article-url="https://publisher.com/story"></probable-markets>
```Iframe fallback
<iframe
  src="https://YOUR_DOMAIN/widget.html?article=https%3A%2F%2Fpublisher.com%2Fstory"
  width="100%"
  height="420"
  style="border:0;border-radius:12px;overflow:hidden"
  loading="lazy"
></iframe>