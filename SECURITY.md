# Sicherheitshinweise (NXTMinutes / 4minitz-next)

## Proxy (Next.js 16) & CSRF

- `proxy.ts` wird von Next.js **automatisch** ausgeführt (kein separates `middleware.ts`; beides gleichzeitig ist ungültig). Bei **POST, PUT, PATCH, DELETE** unter `/api/*` wird – falls gesetzt – der **Origin**-Header mit **Host** abgeglichen. So werden klassische **CSRF**-Angriffe gegen die Cookie-Session (`auth-token`) erschwert.
- Aufrufe **ohne** `Origin` (z. B. serverseitiges `fetch`, manche Tools) bleiben erlaubt.
- Hinter einem Reverse Proxy: **`TRUST_PROXY_HEADERS=true`** nur setzen, wenn der Proxy vertrauenswürdig ist und falsche `X-Forwarded-*` Header nicht durchreicht.

## URLs in E-Mails (Verifizierung, RSVP)

- `getSafeRequestOriginBase()` (`lib/request-base-url.ts`) verwendet `X-Forwarded-*` **nur** bei `TRUST_PROXY_HEADERS=true`.
- Für Verifizierungslinks wird zusätzlich **`resolvePublicAppUrl()`** genutzt (DB `systemSettings.baseUrl` / `APP_URL` / `NEXT_PUBLIC_APP_URL`), damit Links nicht von manipulierten Host-Headern abhängen.

## Authentifizierung

- Standard im Browser: **HTTP-only Cookie** `auth-token` mit `SameSite: strict` (Login).
- In **Production** ist **`Authorization: Bearer`** standardmäßig **deaktiviert**. Für Skripte/API-Clients: `ALLOW_BEARER_AUTH=true` setzen.

## Transport & Header

- **HSTS** (`Strict-Transport-Security`) wird gesetzt, wenn:
  - `ENABLE_HSTS=true`, **oder**
  - `NODE_ENV=production` **und** `APP_URL` mit `https://` beginnt.  
  Abschaltbar mit `DISABLE_HSTS=true` (z. B. gemischte Testumgebungen).

## CSP (Content-Security-Policy)

- Die **CSP wird in `proxy.ts`** pro Request gesetzt (Next.js 16), **nicht** in `next.config.ts` (keine doppelten Header).
- **Skripte:** `script-src 'self' 'nonce-…' 'strict-dynamic'` — **kein `unsafe-inline`** für Scripts. In **Development** zusätzlich `'unsafe-eval'` (React/Next DevTools).
- **Styles:** Standard in Production: **`style-src 'self' 'unsafe-inline'` ohne Nonce** — enthält die Policy **gleichzeitig** Nonce und `unsafe-inline`, ignorieren Browser `unsafe-inline` (CSP3). Strikter Test: `CSP_STRICT_STYLES=true` → nur Nonce im `style-src`; das Root-Layout setzt dann das Nonce auf das Brand-`<style>`.
- **Keine Schemes wie `https:` / `*` in den Standard-Direktiven:** nur `'self'`, `data:`, `blob:` sowie optional explizite Origins über Umgebungsvariablen.
- **Externe Bilder** (Logos/Avatars mit `https://…`): `CSP_EXTRA_IMG_SRC` (Leerzeichen-/kommaseparierte volle Origins).
- **Web Push / andere APIs:** bei Bedarf `CSP_EXTRA_CONNECT_SRC` setzen.
- **Cloudflare Web Analytics / Insights:** `ALLOW_CLOUDFLARE_INSIGHTS=true` erlaubt feste Hosts (`static.cloudflareinsights.com`, `cloudflareinsights.com`) — **ohne** `*.…`-Wildcard.
- **CSP komplett aus:** nur für Debugging `DISABLE_CSP=true`.
- **HTTPS-Umleitung für Subressourcen:** `upgrade-insecure-requests` wenn `APP_URL` mit `https://` beginnt (Production) oder `CSP_UPGRADE_INSECURE_REQUESTS=true`.

Details: [docs/CSP.md](./docs/CSP.md).

API-Antworten & Datenminimierung: [docs/API_RESPONSES.md](./docs/API_RESPONSES.md).  
HTTP-Statuscodes / Enumeration / Timing: [docs/API_HTTP_SEMANTICS.md](./docs/API_HTTP_SEMANTICS.md).

## Öffentliche API (`GET /api/settings/public`)

- Liefert nur **Branding und Anzeige-Defaults** (Organisationsname, Logo-URL, Markenfarben, `timeFormat`, `agendaItemLabelMode`, Standardsprache).
- **Keine** Mitgliedschafts-/Registrierungsflags in der Antwort (Selbstregistrierung und Admin-Freigabe werden nur **serverseitig** in `/api/auth/register` geprüft).

## Öffentliche Uploads

- **`/uploads/logos/[filename]`** ist bewusst **ohne Login** erreichbar (z. B. Login-Branding). Dateinamen sind schwer erratbar; Antwort enthält **`X-Content-Type-Options: nosniff`**.

## Checks

- `npm run security:check` – projektinterne Guardrails  
- `npm audit` – Abhängigkeiten  
