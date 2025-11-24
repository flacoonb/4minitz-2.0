# Email-Benachrichtigungen

## Übersicht

Die Anwendung unterstützt automatische Email-Benachrichtigungen für:
- Neue Protokolle (an alle Teilnehmer)
- Aktionspunkt-Zuweisungen (an Verantwortliche)
- Überfällige Erinnerungen

## SMTP-Konfiguration

### Entwicklung mit MailHog

Für die lokale Entwicklung empfehlen wir [MailHog](https://github.com/mailhog/MailHog) - einen lokalen SMTP-Server zum Testen von E-Mails.

**Vorteile:**
- Kein echter Email-Account erforderlich
- Web-UI zum Anzeigen aller versendeten E-Mails
- Keine versehentlichen Spam-Emails an echte Empfänger

**Installation mit Docker:**

```bash
docker run -d \
  --name mailhog \
  -p 1025:1025 \
  -p 8025:8025 \
  mailhog/mailhog
```

**Ports:**
- `1025`: SMTP-Server (für die Anwendung)
- `8025`: Web-UI (http://localhost:8025)

### Umgebungsvariablen (.env.local)

```bash
# MailHog Konfiguration
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
# SMTP_USER= (nicht erforderlich für MailHog)
# SMTP_PASS= (nicht erforderlich für MailHog)
FROM_EMAIL=noreply@4minitz.local

# App URL für Links in Emails
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Gmail (Produktion)

Für Produktions-Umgebungen mit Gmail:

1. **App-Passwort erstellen:**
   - Google Account → Sicherheit → 2-Faktor-Authentifizierung aktivieren
   - App-Passwörter → "Mail" → Passwort generieren

2. **Konfiguration:**

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=ihre-email@gmail.com
SMTP_PASS=ihr-app-passwort
FROM_EMAIL=ihre-email@gmail.com
```

### Andere SMTP-Dienste

**Microsoft 365 / Outlook:**
```bash
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
```

**AWS SES:**
```bash
SMTP_HOST=email-smtp.eu-central-1.amazonaws.com
SMTP_PORT=587
SMTP_SECURE=false
```

## Email-Templates

Die Anwendung unterstützt mehrsprachige Email-Templates (Deutsch/Englisch):

- **Neue Protokolle:** Mit Teilnehmerliste, Themenanzahl, Action Items
- **Action Item Zuweisung:** Mit Priorität, Fälligkeitsdatum, Verantwortlichen
- **Überfällige Erinnerungen:** Liste aller überfälligen Action Items

## Testen

### Web-UI (empfohlen)

1. Starte MailHog (siehe oben)
2. Öffne die Anwendung: http://localhost:3000
3. Navigation → **Einstellungen**
4. Klicke **"SMTP-Verbindung testen"**
5. Gib eine existierende Minute ID ein
6. Klicke **"Test-Email senden"**
7. Öffne MailHog UI: http://localhost:8025
8. Du solltest die Test-Email sehen

### API-Tests

**SMTP-Verbindung testen:**
```bash
curl http://localhost:3000/api/email/test
```

**Test-Email senden:**
```bash
curl -X POST http://localhost:3000/api/email/test \
  -H "Content-Type: application/json" \
  -d '{"minuteId": "IHRE_MINUTE_ID", "locale": "de"}'
```

## Automatische Benachrichtigungen

### Beim Erstellen von Protokollen

Wenn ein neues Protokoll erstellt wird, werden automatisch Benachrichtigungen an folgende Personen gesendet:
- Alle Teilnehmer
- Alle mit "Sichtbar für" konfigurierten Benutzer

### Bei Action Item Zuweisung

_(In Entwicklung)_ Wenn einem Benutzer ein Action Item zugewiesen wird.

### Überfällige Erinnerungen

_(In Entwicklung)_ Tägliche Cron-Job Erinnerungen können mit folgendem API-Endpoint konfiguriert werden:

```bash
# Beispiel Cron-Job (täglich um 9:00)
0 9 * * * curl http://localhost:3000/api/email/overdue-reminders
```

## Troubleshooting

### "Email configuration test failed"

**Mögliche Ursachen:**
1. MailHog läuft nicht → `docker ps` prüfen
2. Falscher Port → `.env.local` überprüfen
3. Firewall blockiert Port 1025

**Lösung:**
```bash
# MailHog neustarten
docker stop mailhog
docker rm mailhog
docker run -d --name mailhog -p 1025:1025 -p 8025:8025 mailhog/mailhog
```

### Email wird nicht versendet

1. Überprüfe MailHog UI (http://localhost:8025)
2. Überprüfe Server-Logs:
   ```bash
   tail -f /tmp/nextjs.log | grep -i email
   ```
3. Teste SMTP-Verbindung in der Einstellungs-UI

### Gmail "Less secure app access"

**Problem:** Gmail blockiert den Zugriff

**Lösung:** 
- Aktiviere 2-Faktor-Authentifizierung
- Erstelle ein App-Passwort (siehe oben)
- Verwende NIEMALS dein echtes Gmail-Passwort

## Code-Integration

### Email nach Minute-Erstellung senden

Die Integration ist bereits in `/app/api/minutes/route.ts` implementiert:

```typescript
import { sendNewMinutesNotification } from '@/lib/email-service';

// Nach dem Erstellen der Minute
await sendNewMinutesNotification(minute, locale).catch(err => 
  console.error('Failed to send email notification:', err)
);
```

### Eigene Email-Templates erstellen

Siehe `/lib/email-service.ts`:

```typescript
export async function sendCustomNotification(
  recipients: string[],
  subject: string,
  htmlContent: string
) {
  // Implementierung
}
```

## Sicherheit

**Wichtig für Produktion:**

1. ✅ Verwende SMTP mit TLS (`SMTP_SECURE=true` für Port 465)
2. ✅ Speichere Passwörter NIEMALS im Code
3. ✅ Verwende Umgebungsvariablen
4. ✅ Limitiere Email-Versand (Rate Limiting)
5. ✅ Validiere Email-Adressen
6. ✅ Verwende SPF/DKIM/DMARC für Domain-Authentifizierung

## Weitere Ressourcen

- [Nodemailer Dokumentation](https://nodemailer.com/)
- [MailHog GitHub](https://github.com/mailhog/MailHog)
- [Gmail App-Passwörter](https://support.google.com/accounts/answer/185833)
- [AWS SES Setup](https://docs.aws.amazon.com/ses/latest/dg/smtp-credentials.html)
