# 4Minitz Production Deployment

## ✅ Status: LIVE

Die Anwendung läuft jetzt im **Production-Modus** als Systemd-Service.

---

## 🚀 Service Management

### Service starten
```bash
sudo systemctl start 4minitz
```

### Service stoppen
```bash
sudo systemctl stop 4minitz
```

### Service neu starten
```bash
sudo systemctl restart 4minitz
```

### Service-Status prüfen
```bash
sudo systemctl status 4minitz
```

### Logs anzeigen
```bash
sudo journalctl -u 4minitz -f
```

### Letzte 100 Logs
```bash
sudo journalctl -u 4minitz -n 100 --no-pager
```

---

## 🔧 Deployment-Workflow

### Bei Code-Änderungen:

1. **Build erstellen:**
   ```bash
   cd /home/pi/4minitz-next
   npm run build
   ```

2. **Service neu starten:**
   ```bash
   sudo systemctl restart 4minitz
   ```

3. **Status prüfen:**
   ```bash
   sudo systemctl status 4minitz
   ```

---

## 📊 Monitoring

### Health-Check
```bash
curl http://localhost:3000/api/health
```

Erwartete Antwort:
```json
{
  "status": "healthy",
  "timestamp": "2025-11-16T20:22:12.171Z",
  "services": {
    "api": "operational",
    "database": "connected"
  },
  "version": "1.0.0"
}
```

### Service-Metriken
```bash
systemctl show 4minitz --property=CPUUsageNSec --property=MemoryCurrent
```

---

## 🌐 Zugriff

- **Lokal:** http://localhost:3000
- **Netzwerk:** http://10.160.240.105:3000

---

## 📝 Wichtige Änderungen (Dev → Production)

### 1. **Debug-Logs entfernt**
- ✅ Alle `console.log` Debug-Statements aus APIs entfernt
- ✅ PDF-Generator Debug-Logs entfernt
- ✅ Frontend Debug-Logs entfernt

### 2. **Service-Konfiguration**
- ✅ `NODE_ENV=production`
- ✅ `npm start` statt `npm run dev`
- ✅ Entfernt: `ExecStartPre=/usr/bin/npm install`
- ✅ Erhöhte Restart-Verzögerung: 10 Sekunden
- ✅ Reduzierte Start-Timeout: 60 Sekunden
- ✅ Dependency zu MongoDB hinzugefügt

### 3. **Mongoose Warnings behoben**
- ✅ Duplicate Index Warnings eliminiert
- ✅ `isNew` Reserved Key Warning unterdrückt
- ✅ Schema-Optimierungen durchgeführt

### 4. **Build-Optimierungen**
- ✅ Production Build erstellt
- ✅ Code minimiert und optimiert
- ✅ Alle TypeScript-Fehler behoben

---

## 🔒 Sicherheit

### Empfohlene Maßnahmen:

1. **Firewall konfigurieren:**
   ```bash
   sudo ufw allow 3000/tcp
   ```

2. **Nginx Reverse Proxy einrichten** (optional):
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

3. **SSL/TLS einrichten** (mit Let's Encrypt):
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

---

## 🗄️ Datenbank

### MongoDB Status prüfen
```bash
sudo systemctl status mongodb
```

### MongoDB Backup
```bash
mongodump --db=4minitz --out=/backup/4minitz-$(date +%Y%m%d)
```

### MongoDB Restore
```bash
mongorestore --db=4minitz /backup/4minitz-YYYYMMDD/4minitz
```

---

## 🐛 Troubleshooting

### Service startet nicht
```bash
# Prüfe Logs
sudo journalctl -u 4minitz -n 50 --no-pager

# Prüfe Syntax
cd /home/pi/4minitz-next
npm run build
```

### Port bereits in Verwendung
```bash
# Finde Prozess
sudo lsof -i :3000

# Beende Prozess
sudo kill -9 <PID>
```

### MongoDB Verbindungsfehler
```bash
# Prüfe MongoDB
sudo systemctl status mongodb

# Starte MongoDB
sudo systemctl start mongodb
```

### Hohe Memory-Nutzung
```bash
# Prüfe Memory
free -h

# Service mit Memory-Limit starten (z.B. 512MB)
sudo systemctl set-property 4minitz.service MemoryMax=512M
sudo systemctl daemon-reload
sudo systemctl restart 4minitz
```

---

## 📦 Backup-Strategie

### Automatisches Backup einrichten

1. **Backup-Script erstellen:**
   ```bash
   sudo nano /usr/local/bin/4minitz-backup.sh
   ```

2. **Script-Inhalt:**
   ```bash
   #!/bin/bash
   DATE=$(date +%Y%m%d_%H%M%S)
   BACKUP_DIR="/backup/4minitz"
   
   # MongoDB Backup
   mongodump --db=4minitz --out="$BACKUP_DIR/db_$DATE"
   
   # Uploads Backup
   tar -czf "$BACKUP_DIR/uploads_$DATE.tar.gz" /home/pi/4minitz-next/uploads
   
   # Alte Backups löschen (älter als 7 Tage)
   find "$BACKUP_DIR" -type f -mtime +7 -delete
   
   echo "Backup completed: $DATE"
   ```

3. **Executable machen:**
   ```bash
   sudo chmod +x /usr/local/bin/4minitz-backup.sh
   ```

4. **Cron-Job einrichten** (täglich um 2 Uhr):
   ```bash
   sudo crontab -e
   # Füge hinzu:
   0 2 * * * /usr/local/bin/4minitz-backup.sh >> /var/log/4minitz-backup.log 2>&1
   ```

---

## 📈 Performance-Monitoring

### PM2 Alternative (optional)
Für besseres Monitoring kann PM2 verwendet werden:

```bash
npm install -g pm2
pm2 start npm --name "4minitz" -- start
pm2 startup
pm2 save
pm2 monit
```

---

## 🎯 Nächste Schritte

- [ ] SSL-Zertifikat einrichten
- [ ] Nginx Reverse Proxy konfigurieren
- [ ] Automatische Backups einrichten
- [ ] Monitoring-Dashboard einrichten
- [ ] Rate-Limiting implementieren
- [ ] CORS-Konfiguration prüfen

---

## 📞 Support

Bei Problemen:
1. Prüfe Service-Logs: `sudo journalctl -u 4minitz -n 100`
2. Prüfe Application-Logs: `sudo journalctl -u 4minitz -f`
3. Teste Health-Endpoint: `curl http://localhost:3000/api/health`
4. Prüfe MongoDB: `sudo systemctl status mongodb`

---

**Deployment abgeschlossen am:** 16.11.2025, 20:22 UTC  
**Version:** 1.0.0  
**Status:** ✅ Production Ready
