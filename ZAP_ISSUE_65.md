# ZAP Baseline — [Issue #65](https://github.com/flacoonb/NXTminutes/issues/65)

## Umsetzung im Repo

- **`app/robots.ts`** / **`app/sitemap.xml`** — Inhalt über Next (Metadata Routes), nicht nur statischer Default.
- **`next.config.ts`** — Globale Header (u. a. `X-Content-Type-Options`, `Permissions-Policy`, `Cross-Origin-Resource-Policy`, `Strict-Transport-Security` in Production) plus für **`/robots.txt`** und **`/sitemap.xml`** zusätzlich **`Content-Security-Policy`** (`STATIC_TEXT_CSP`) und **`Cache-Control`**.
- **Header-Reihenfolge:** Catch-all `/(.*)` zuerst, **`/robots.txt`** und **`/sitemap.xml`** zuletzt, damit laut [Next.js-Dokumentation](https://nextjs.org/docs/app/api-reference/config/next-config-js/headers) die spezifischen Header pro Schlüssel gewinnen (sonst fehlte u. a. CSP auf SEO-URLs).
- **`proxy.ts`:** `robots.txt` und `sitemap.xml` vom CSP-Matcher **ausgenommen**, damit nicht die HTML-Nonce-CSP die statische **`STATIC_TEXT_CSP`** aus `next.config` verdrängt.
- **HSTS:** Production + (`APP_URL`/`NEXT_PUBLIC_APP_URL` leer oder `https://…`) siehe `SECURITY.md`; `DISABLE_HSTS=true` für Ausnahmen.
- **`.zap/rules.tsv`** — Regeln auf **INFO** für erwartbares Rauschen (Cloudflare **`/cdn-cgi/…`**, Timestamp-Heuristiken, „Modern Web App“, Cache-Hinweise), die die App nicht steuern kann.

## Nach dem Deploy

1. Neues Image / `next build` mit gesetzter **`APP_URL=https://proto.tvsg.ch`** (oder `NEXT_PUBLIC_APP_URL`) ausrollen — damit sind `headers()` und Sitemap-URLs konsistent.
2. ZAP Baseline erneut laufen lassen (Workflow oder manuell).
3. **Issue #65** schließen, wenn die verbleibenden Meldungen nur noch **INFO** / Cloudflare-only sind.

## Hinweis Cloudflare

Befunde auf **`…/cdn-cgi/…/rocket-loader.min.js`** verschwinden nicht durch App-Code; Rocket Loader im Dashboard deaktivieren oder Regeln in `.zap/rules.tsv` beibehalten.
