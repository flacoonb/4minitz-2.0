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

## CSP

- Production: standardmäßig **`script-src 'self'`** (ohne `unsafe-inline`).
- Falls die App Inline-Skripte braucht: `ALLOW_INLINE_SCRIPTS=true` (siehe `next.config.ts`).

## Öffentliche Uploads

- **`/uploads/logos/[filename]`** ist bewusst **ohne Login** erreichbar (z. B. Login-Branding). Dateinamen sind schwer erratbar; Antwort enthält **`X-Content-Type-Options: nosniff`**.

## Checks

- `npm run security:check` – projektinterne Guardrails  
- `npm audit` – Abhängigkeiten  
