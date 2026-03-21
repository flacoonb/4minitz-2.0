# API-Antworten & Datenminimierung

Überblick, welche Routen **öffentlich** oder **besonders sensibel** sind und wie Antworten bewusst begrenzt sind. Ziel: nur nötige Felder liefern, Geheimnisse und interne Mongo-Felder vermeiden.

## Öffentlich / ohne Login (oder schwacher Schutz)

| Route | Zweck | Hinweis |
|--------|--------|--------|
| `GET /api/health` | Liveness | Nur `{ status: 'ok' \| 'error' }` |
| `GET /api/settings/public` | Branding & Anzeige-Defaults | Keine Registrierungs-/Admin-Policy-Felder |
| `GET /api/setup` | Setup nötig? | Nur `needsSetup` (verrät, ob Nutzer existieren – üblich für Setup-Flow) |
| `GET /uploads/logos/…`, `GET /uploads/avatars/…` | Statische Assets | Filename-Schutz durch Unvorhersehbarkeit |
| `GET /api/meeting-events/rsvp` | RSVP-Redirect/HTML | Token-basiert |
| `GET /api/calendar/ical/[token]` | iCal-Feed | Nur mit gültigem Kalender-Token |
| `POST /api/auth/login` | Login | User über `User.toJSON()` (Passwort/Hashes/Token-Felder werden im Model entfernt) |
| `POST /api/auth/register` | Registrierung | **Nur** `success`, `message`, `requiresApproval` (kein User-Objekt) |

## Authentifiziert – bereits geschützt oder bewusst voll

| Bereich | Kommentar |
|---------|-----------|
| `User.toJSON()` | Entfernt u. a. `password`, Reset-/Verifizierungs-Token, `usernameHistory`, `tokenVersion`, Kalender-Feed-Token |
| `GET /api/admin/settings` | Admin-only; SMTP-Passwort wird maskiert (`********`) |
| `GET /api/users` | Felder abhängig von Rolle: Nicht-Admins ohne `email` (außer Meeting-Rechte); Limit für Listen |
| `GET /api/users/[id]` | Eigenes Profil oder Admin |
| PDF-Vorlagen (`/api/pdf-templates/*`) | Antworten über **`serializePdfTemplateForApi`**: nur Allowlist (`_id`, `name`, `description`, `isActive`, sanitisierte `contentSettings`/`layoutSettings`, Zeitstempel) – kein `…spread` des Mongoose-Dokuments |

## Empfehlungen für Erweiterungen

- Neue öffentliche Endpoints: **explizite Allowlist** statt `…doc` oder `lean()`-Gesamtobjekt.
- Listen-APIs: Pagination, Felder-Select, keine internen Debug-Felder.
- Fehlermeldungen: In Production generisch halten (keine Stacktraces in JSON).

## Durchgeführte Anpassungen (Changelog)

- `GET /api/settings/public`: Entfernung u. a. von `allowRegistration`, `requireAdminApproval`, `dateFormat` (nicht vom Client genutzt).
- `POST /api/auth/register`: keine `data`-User-Payload mehr.
- PDF-Template-Routen: gemeinsame Serialisierung `lib/pdf-template-serialize.ts`.
- `GET /api/minutes/[id]`: Auth **vor** DB-Zugriff + **400** bei ungültiger Id (weniger Enumeration ohne Login).
- `GET /api/dashboard`: keine redundanten Task-Arrays mehr; `recentMinutes` nur kompakte Felder (`lib/dashboard-response.ts`).

HTTP-Statuscodes & Timing: [API_HTTP_SEMANTICS.md](./API_HTTP_SEMANTICS.md).
