# ✅ Verschlüsselte SMTP-Credentials erfolgreich eingerichtet!

## 🎉 Status

Ihre SMTP-Credentials sind jetzt **sicher verschlüsselt** gespeichert und funktionieren!

### Was wurde eingerichtet:

✅ **Verschlüsselte Speicherung**: `/etc/4minitz/secrets/smtp.encrypted`
- Verschlüsselt mit `systemd-creds`
- Nur von root und systemd lesbar
- Hardware-gebunden (kann nicht auf andere Maschine kopiert werden)

✅ **Automatische Entschlüsselung**: systemd entschlüsselt beim Service-Start
- Datei `/run/credentials/4minitz.service/smtp` zur Laufzeit verfügbar
- Nur für den 4minitz-Service sichtbar
- Verschwindet nach Service-Stop

✅ **Umgebungsvariablen**: Credentials werden automatisch geladen
- `SMTP_HOST=mail.infomaniak.com`
- `SMTP_PORT=456`
- `SMTP_SECURE=true`
- `SMTP_USER=info@tvsg.ch`
- `SMTP_PASS=(verschlüsselt)`
- `FROM_EMAIL=info@tvsg.ch`

## 📋 Konfiguration

### Systemd Service Drop-in
Datei: `/etc/systemd/system/4minitz.service.d/credentials.conf`
```ini
[Service]
LoadCredentialEncrypted=smtp:/etc/4minitz/secrets/smtp.encrypted
```

### Start-Skript
Datei: `/home/pi/4minitz-next/scripts/load-credentials-and-start.sh`
- Lädt verschlüsselte Credentials
- Exportiert als Umgebungsvariablen
- Startet Next.js-Anwendung

### .env.local
SMTP-Einstellungen sind auskommentiert:
```bash
# SMTP Credentials loaded from systemd encrypted storage
# Location: /etc/4minitz/secrets/smtp.encrypted
```

## 🔧 Verwaltung

### Credentials anzeigen (zum Debuggen)
```bash
# Als root:
sudo systemd-creds --name=smtp decrypt /etc/4minitz/secrets/smtp.encrypted -
```

### Credentials neu verschlüsseln
```bash
# Wenn Sie die Daten ändern wollen:
sudo /home/pi/4minitz-next/scripts/setup-secrets.sh
```

### Service neu starten
```bash
sudo systemctl restart 4minitz
```

### Logs prüfen
```bash
# Credentials-Loading im Log:
sudo journalctl -u 4minitz -n 50 | grep -A5 "Loading"

# Komplette Logs:
sudo journalctl -u 4minitz -f
```

## 🔐 Sicherheit

### Was ist jetzt sicher?

✅ **Auf Festplatte**: Credentials verschlüsselt mit AES256
✅ **Zugriff**: Nur root und systemd können entschlüsseln
✅ **Laufzeit**: Nur der 4minitz-Service sieht entschlüsselte Werte
✅ **Hardware-gebunden**: Verschlüsselung nutzt TPM wenn verfügbar
✅ **Git-sicher**: Verschlüsselte Datei kann committed werden

### Was ist weiterhin im Klartext?

⚠️ **Im RAM**: SMTP-Client braucht Klartext-Passwort (unvermeidbar)
⚠️ **Zur Laufzeit**: Umgebungsvariablen im Prozess sichtbar
⚠️ **Bei Entschlüsselung**: Temporär in `/run/credentials/` (RAM-Disk)

**Das ist bei ALLEN E-Mail-Programmen so!** (Thunderbird, Outlook, etc.)

## 🚀 Testen

### E-Mail-Konfiguration testen
```bash
# Authenticated request required (login via web UI or include `Authorization: Bearer <token>`)
curl http://localhost:3000/api/email/test
```

### Test-E-Mail senden
```bash
# Authenticated request required (login via web UI or include `Authorization: Bearer <token>`)
curl -X POST http://localhost:3000/api/email/send-test \
  -H "Content-Type: application/json" \
  -d '{"to":"ihre-email@example.com"}'
```

### Web-Oberfläche
- Konfiguration: http://localhost:3000/admin/email-config
- Test senden: http://localhost:3000/settings/email

## 📁 Dateien-Übersicht

```
/etc/4minitz/secrets/smtp.encrypted        # Verschlüsselte Credentials
/etc/systemd/system/4minitz.service.d/
  └── credentials.conf                     # systemd Konfiguration
/home/pi/4minitz-next/
  ├── scripts/
  │   ├── setup-secrets.sh                 # Credentials verschlüsseln
  │   ├── load-credentials-and-start.sh    # Service-Start-Skript
  │   └── simple-secrets.sh                # Alternative: GPG
  └── .env.local                           # Fallback (auskommentiert)
```

## ⚙️ Wie es funktioniert

1. **Beim Service-Start**:
   - systemd lädt `/etc/4minitz/secrets/smtp.encrypted`
   - Entschlüsselt automatisch nach `/run/credentials/4minitz.service/smtp`
   - Setzt `$CREDENTIALS_DIRECTORY` Umgebungsvariable

2. **Start-Skript wird ausgeführt**:
   - Liest JSON aus `$CREDENTIALS_DIRECTORY/smtp`
   - Parst mit Python
   - Exportiert als Umgebungsvariablen

3. **Next.js-App startet**:
   - Liest `process.env.SMTP_HOST` etc.
   - Verwendet die Credentials für E-Mail-Versand

4. **Bei Service-Stop**:
   - `/run/credentials/` wird gelöscht (RAM-Disk)
   - Verschlüsselte Datei bleibt erhalten

## 🔄 Credentials aktualisieren

Wenn Sie die SMTP-Zugangsdaten ändern müssen:

```bash
# 1. Neue Credentials verschlüsseln
sudo /home/pi/4minitz-next/scripts/setup-secrets.sh

# 2. Service neu starten
sudo systemctl restart 4minitz

# 3. Testen (verwenden Sie Web-UI oder eine authentifizierte API-Anfrage)
curl http://localhost:3000/api/email/test
```

## ⚠️ Wichtige Hinweise

### Bei Hardware-Wechsel
Die Verschlüsselung ist hardware-gebunden. Bei Server-Migration:
1. Credentials auf neuem Server neu verschlüsseln
2. Oder: Alte Credentials entschlüsseln und manuell übertragen

### Backup
Die verschlüsselte Datei ist nutzlos ohne die Hardware:
- Notieren Sie sich die Credentials separat (sicher!)
- Oder: Verwenden Sie die GPG-Lösung (`simple-secrets.sh`) für Backups

### Entwicklung vs. Produktion
- **Produktion**: systemd-creds (diese Lösung) ✅
- **Entwicklung**: .env.local ausreichend
- **Lokal**: `simple-secrets.sh` mit GPG

## 📚 Weitere Informationen

- systemd-creds Doku: `man systemd-creds`
- LoadCredentialEncrypted: `man systemd.exec`
- Alternative GPG-Lösung: `./scripts/simple-secrets.sh`
- Dokumentation: `docs/SECRETS-MANAGEMENT.md`

---

**Gratulation! 🎉 Ihre SMTP-Credentials sind jetzt professionell gesichert!**
