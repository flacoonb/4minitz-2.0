# 4Minitz Service Installation

Dieser Ordner enthält Scripts zur Installation der 4Minitz-App als systemd Service unter Linux.

## Dateien

- `4minitz.service` - Systemd Service Definition
- `install-service.sh` - Installations-Script
- `uninstall-service.sh` - Deinstallations-Script

## Installation

1. **Service installieren:**
   ```bash
   sudo ./install-service.sh
   ```

2. **Service-Status prüfen:**
   ```bash
   sudo systemctl status 4minitz
   ```

3. **App im Browser öffnen:**
   - http://localhost:3000
   - http://10.160.240.105:3000

## Service-Verwaltung

### Grundlegende Befehle
```bash
# Service starten
sudo systemctl start 4minitz

# Service stoppen
sudo systemctl stop 4minitz

# Service neu starten
sudo systemctl restart 4minitz

# Service-Status anzeigen
sudo systemctl status 4minitz

# Service beim Boot aktivieren
sudo systemctl enable 4minitz

# Service beim Boot deaktivieren
sudo systemctl disable 4minitz
```

### Logs anzeigen
```bash
# Live-Logs anzeigen
sudo journalctl -u 4minitz -f

# Letzte 50 Zeilen
sudo journalctl -u 4minitz -n 50

# Logs seit heute
sudo journalctl -u 4minitz --since today
```

## Service-Eigenschaften

- **Auto-Start:** Der Service startet automatisch beim System-Boot
- **Auto-Restart:** Bei Fehlern wird der Service automatisch neu gestartet
- **Logging:** Alle Logs werden in das System-Journal geschrieben
- **User:** Läuft unter dem `pi` Benutzer
- **Port:** Standard-Port 3000
- **Environment:** Production-Modus

## Troubleshooting

### Service startet nicht
1. Logs überprüfen: `sudo journalctl -u 4minitz -n 50`
2. Dependencies installieren: `cd /home/pi/4minitz-next && npm install`
3. Build erstellen: `npm run build`
4. Service neu starten: `sudo systemctl restart 4minitz`

### App nicht erreichbar
1. Port-Binding überprüfen: `sudo netstat -tlnp | grep :3000`
2. Firewall-Regeln überprüfen: `sudo ufw status`
3. Service-Status überprüfen: `sudo systemctl status 4minitz`

### Service deinstallieren
```bash
sudo ./uninstall-service.sh
```

## Konfiguration anpassen

Die Service-Konfiguration kann in der Datei `4minitz.service` angepasst werden:

- **Port ändern:** `Environment=PORT=8080`
- **Host ändern:** `Environment=HOSTNAME=localhost`
- **Node-Environment:** `Environment=NODE_ENV=development`

Nach Änderungen:
```bash
sudo systemctl daemon-reload
sudo systemctl restart 4minitz
```