# Cron Jobs für 4Minitz Next

## Überfällige Erinnerungen

### Einrichtung

#### 1. Cron Secret setzen

Füge in `.env.local` hinzu:

```bash
CRON_SECRET=dein-geheimer-cron-schlüssel-min-32-zeichen
```

#### 2. Crontab einrichten (Linux/Mac)

```bash
# Crontab bearbeiten
crontab -e

# Täglich um 9:00 Uhr Erinnerungen senden
0 9 * * * curl -X GET "http://localhost:3000/api/cron/overdue-reminders" -H "x-cron-secret: dein-geheimer-cron-schlüssel-min-32-zeichen" >> /var/log/4minitz-cron.log 2>&1
```

#### 3. Vercel Cron (für Produktion)

Erstelle `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/overdue-reminders",
      "schedule": "0 9 * * *"
    }
  ]
}
```

Füge in Vercel Environment Variables hinzu:
- `CRON_SECRET` = dein-geheimer-schlüssel

#### 4. Manueller Test

```bash
# Lokal testen
curl -X GET "http://localhost:3000/api/cron/overdue-reminders" \
  -H "x-cron-secret: dein-geheimer-cron-schlüssel-min-32-zeichen"

# Antwort sollte sein:
{
  "success": true,
  "message": "Overdue reminders processed",
  "results": {
    "sent": 2,
    "failed": 0,
    "users": 2,
    "totalItems": 5
  }
}
```

## Andere mögliche Cron Jobs

### Wöchentlicher Digest (in Entwicklung)

```bash
# Jeden Montag um 8:00 Uhr
0 8 * * 1 curl -X GET "http://localhost:3000/api/cron/weekly-digest" -H "x-cron-secret: ..."
```

### Automatische Archivierung alter Protokolle

```bash
# Monatlich am 1. um 2:00 Uhr
0 2 1 * * curl -X GET "http://localhost:3000/api/cron/archive-old-minutes" -H "x-cron-secret: ..."
```

### Backup-Reminder

```bash
# Täglich um 23:00 Uhr
0 23 * * * curl -X GET "http://localhost:3000/api/cron/backup-reminder" -H "x-cron-secret: ..."
```

## Logs

### Cron Logs anzeigen

```bash
# System Cron Logs
tail -f /var/log/cron

# Custom Log
tail -f /var/log/4minitz-cron.log
```

### Log Rotation einrichten

Erstelle `/etc/logrotate.d/4minitz`:

```
/var/log/4minitz-cron.log {
    daily
    rotate 7
    compress
    missingok
    notifempty
}
```

## Monitoring

### Health Check

```bash
# Endpoint testen
curl http://localhost:3000/api/health

# Mit Monitoring-Service (z.B. UptimeRobot, Pingdom)
# https://yourdomain.com/api/health
```

### Error Notifications

Für Produktions-Monitoring:
- Sentry Integration
- Datadog
- New Relic
- CloudWatch (AWS)

## Troubleshooting

### Cron läuft nicht

```bash
# Cron Service Status
systemctl status cron

# Crontab überprüfen
crontab -l

# Cron Logs überprüfen
grep CRON /var/log/syslog
```

### Emails werden nicht gesendet

1. Prüfe SMTP-Konfiguration in `.env.local`
2. Teste Email-Endpoint manuell: `/settings/email`
3. Prüfe MailHog: http://localhost:8025
4. Schaue in Server-Logs: `tail -f /tmp/nextjs.log | grep email`

### "Unauthorized" Error

- Cron Secret stimmt nicht überein
- Prüfe `.env.local` und Crontab-Befehl
- Vergleiche Header: `x-cron-secret`
