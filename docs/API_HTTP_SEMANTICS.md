# HTTP-Statuscodes, Enumeration & Timing

Kurz, was **unterschiedliche Antworten** (400 / 401 / 403 / 404 / 429) für Angreifer **bedeuten können** und wie das Projekt damit umgeht.

## 401 vs 403

| Code | Bedeutung (üblich) | Hinweis |
|------|-------------------|--------|
| **401** | Nicht authentifiziert (kein/ungültiger Login) | Sagt nicht, ob eine **Ressource existiert** – nur „du bist nicht eingeloggt“. |
| **403** | Authentifiziert, aber **keine Berechtigung** | Kann gegenüber **404** verraten: „Die Ressource gibt es, aber nicht für dich.“ |

**Praxis:** Viele APIs nutzen für „kein Zugriff“ trotzdem **404**, um **Existenz** zu verschleiern (Trade-off: schlechteres Debugging). Dieses Projekt nutzt an vielen Stellen **403**, wenn der Nutzer eingeloggt ist, aber nicht darf – das ist für die UX klarer.

## 400 vs 401

- **400** = syntaktisch ungültige Anfrage (z. B. keine gültige ObjectId).
- Wenn **zuerst** die Validierung kommt und **danach** die Authentifizierung, kann ein Angreifer **ohne** Cookie manchmal nur **400** sehen – das verrät wenig über Inhalte.
- **Empfehlung:** Bei sensiblen **GET**-Einzelressourcen **zuerst** prüfen, ob die ID formal gültig ist, dann **401**, wenn nicht eingeloggt – **bevor** die Datenbank nach der Existenz fragt (verhindert **404 vs 401**-Enumeration).

## Beispiel (behoben): `GET /api/minutes/[id]`

**Vorher:** Datenbankzugriff auch ohne Login → bei gültiger ID **401**, bei ungültiger/fehlender Minute oft **404** → **Unterschied verrät, ob eine Minute-Id existiert**.

**Nachher:** Ungültige Id → **400**; nicht eingeloggt → **401** **ohne** Minute zu laden; eingeloggt → **404** / **403** / **200** je nach Existenz und Rechten.

## 429 (Rate limiting)

- **429** zeigt: Anfragen wurden **verarbeitet** und ein Limit greift.
- **Kein** direkter Beweis für „richtiges Passwort“, aber Hinweis auf **aktives Throttling** (gut).
- **Timing:** Sehr schnelle 429-Antworten vs. langsame 401 nach DB können minimal unterscheidbar sein – in der Praxis selten ausnutzbar; wichtiger sind **generische Login-Fehler** (hier: einheitliche Meldung bei falschem Login).

## Timing-Angriffe allgemein

- Unterschiedliche Codepfade (z. B. User gefunden vs. nicht gefunden) können **leicht** unterschiedliche Laufzeiten haben.
- Vollständige **konstante Antwortzeit** ist aufwendig; sinnvoll sind: **Rate Limits**, **generische Fehlertexte** beim Login, und **keine DB vor Auth** bei sensiblen Lookups (siehe oben).

## `GET /api/minutes` (Liste) ohne Login

- Liefert absichtlich **200** mit **leerer Liste** (kein 401), damit öffentliche Clients nicht anhand des Statuscodes erkennen, „ob Login Daten brächte“.
- Das ist ein bewusster **Komfort-/Privacy-Kompromiss**; Einzelabrufe erzwingen dagegen Login (siehe oben).

## `GET /api/dashboard`

- Antwort enthält nur noch **Statistikzahlen** und eine **kompakte** `recentMinutes`-Vorschau; volle **Task-Objekte** kommen über **`GET /api/tasks`** (eine Quelle, weniger redundante Daten in der Antwort).
