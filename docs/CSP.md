# Content Security Policy (CSP)

Die aktive CSP wird in **`proxy.ts`** gesetzt (Next.js 16), inkl. **Nonce** und **`strict-dynamic`** für Skripte. `next.config.ts` setzt **keine** `Content-Security-Policy` mehr (vermeidet doppelte Header).

## Richtlinien (Kurz)

| Direktive   | Production (Standard) |
|------------|------------------------|
| `default-src` | `'self'` |
| `script-src`  | `'self'` + Nonce + `strict-dynamic` (kein `unsafe-inline` für Scripts) |
| `style-src`   | Standard: **`'self' 'unsafe-inline'`** ohne Nonce — sonst würden Browser `unsafe-inline` ignorieren und alle React-`style={{}}` blockieren. Optional `CSP_STRICT_STYLES=true`: nur Nonce (dann kein `unsafe-inline`). |
| `img-src`     | `'self'` `data:` `blob:` (+ optional `CSP_EXTRA_IMG_SRC`) |
| `connect-src` | `'self'` (+ optional Cloudflare / `CSP_EXTRA_CONNECT_SRC`) |
| `font-src`    | `'self'` `data:` |

Keine Schemes wie **`https:`** und keine **`*`\-Wildcards** in den Standard-Direktiven.

## Umgebungsvariablen

| Variable | Bedeutung |
|----------|-----------|
| `DISABLE_CSP=true` | CSP komplett aus (nur Debugging) |
| `CSP_STRICT_STYLES=true` | `style-src` **ohne** `unsafe-inline` (erwartbar viele Violations bis Refactor) |
| `CSP_EXTRA_IMG_SRC` | Leerzeichen-/kommaseparierte **vollständige Origins** für externe Bilder |
| `CSP_EXTRA_CONNECT_SRC` | Zusätzliche `connect-src`\-Origins (z. B. Push) |
| `CSP_EXTRA_SCRIPT_SRC` | Zusätzliche `script-src`\-Origins |
| `ALLOW_CLOUDFLARE_INSIGHTS=true` | Feste Cloudflare-Beacon-Hosts (ohne `*.`\-Wildcard) |
| `CSP_UPGRADE_INSECURE_REQUESTS=true` | `upgrade-insecure-requests` erzwingen |

## Styles ohne `unsafe-inline` (Ausblick)

Viele Komponenten nutzen inline `style={{…}}`. Strikte `style-src` nur mit Nonce erfordert Migration auf CSS-Klassen oder ein nonced globales Stylesheet. Bis dahin: Standard lässt **`unsafe-inline`** nur für **Styles** zu, nicht für **Scripts**.
