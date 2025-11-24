# MongoDB Setup Guide

## 🎯 Sie müssen MongoDB installieren

Die Migration benötigt MongoDB. Hier sind Ihre Optionen:

## Option 1: MongoDB mit Docker (Empfohlen - Schnell & Einfach)

### Installation

```bash
# 1. Docker installieren (falls noch nicht vorhanden)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
# Neu einloggen nach diesem Schritt

# 2. MongoDB Container starten
docker run -d \
  --name mongodb \
  -p 27017:27017 \
  -v mongodb_data:/data/db \
  mongo:7.0

# 3. Prüfen ob MongoDB läuft
docker ps | grep mongodb
```

### Verwaltung

```bash
# Status prüfen
docker ps -a | grep mongodb

# Starten
docker start mongodb

# Stoppen
docker stop mongodb

# Logs ansehen
docker logs mongodb

# MongoDB Shell öffnen
docker exec -it mongodb mongosh
```

### Nach Neustart automatisch starten

```bash
docker update --restart unless-stopped mongodb
```

## Option 2: Native MongoDB Installation (Debian/Raspberry Pi)

### Für Debian/Ubuntu:

```bash
# 1. MongoDB GPG Key hinzufügen
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
  sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

# 2. Repository hinzufügen
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] \
http://repo.mongodb.org/apt/debian bookworm/mongodb-org/7.0 main" | \
  sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# 3. System aktualisieren
sudo apt-get update

# 4. MongoDB installieren
sudo apt-get install -y mongodb-org

# 5. MongoDB starten
sudo systemctl start mongod
sudo systemctl enable mongod

# 6. Status prüfen
sudo systemctl status mongod
```

### Für Raspberry Pi (ARM):

MongoDB bietet keine offiziellen ARM Builds mehr. Nutzen Sie stattdessen:

```bash
# Community Build für ARM
sudo apt-get update
sudo apt-get install -y mongodb

# Oder Docker (siehe Option 1)
```

## Option 3: Meteor MongoDB nutzen (Falls vorhanden)

Falls die alte 4minitz-App läuft:

```bash
# Terminal 1: 4minitz starten
cd /home/pi/4minitz
meteor

# Terminal 2: MongoDB URI herausfinden
cd /home/pi/4minitz
meteor mongo --url
# Kopieren Sie diese URI

# Dann in .env.local eintragen:
SOURCE_MONGODB_URI=<meteor-mongo-url>
```

## 🚀 Nach der Installation

### 1. Verbindung testen

```bash
# Mit mongosh (wenn nativ installiert)
mongosh

# Mit Docker
docker exec -it mongodb mongosh

# In der Shell:
> show dbs
> exit
```

### 2. .env.local konfigurieren

```env
# Für lokale Installation oder Docker
MONGODB_URI=mongodb://localhost:27017/4minitz-next

# Für Meteor (wenn es läuft)
SOURCE_MONGODB_URI=mongodb://127.0.0.1:3001/meteor
```

### 3. Sample Data erstellen

```bash
cd /home/pi/4minitz-next
npm run sample-data
```

### 4. Development Server starten

```bash
npm run dev
```

## 🐛 Troubleshooting

### MongoDB verbindet nicht

```bash
# Prüfen ob Port 27017 verwendet wird
sudo netstat -tlnp | grep 27017

# Prüfen ob Firewall blockiert
sudo ufw allow 27017

# Docker: Container neu starten
docker restart mongodb
```

### Speicherplatz-Warnung

```bash
# Verfügbaren Speicher prüfen
df -h

# MongoDB Daten bereinigen (in mongosh)
use admin
db.runCommand({ repairDatabase: 1 })
```

### Performance-Probleme

```bash
# Docker: Mehr RAM zuweisen
docker run -d \
  --name mongodb \
  -p 27017:27017 \
  --memory="2g" \
  -v mongodb_data:/data/db \
  mongo:7.0
```

## 📊 Empfohlene Konfiguration

Für diese Anwendung benötigen Sie:
- **Mindestens**: 512 MB RAM für MongoDB
- **Empfohlen**: 1-2 GB RAM
- **Speicher**: ~100 MB für kleine Datenbanken, ~1 GB für große

## ✅ Nächste Schritte

Nach erfolgreicher MongoDB-Installation:

1. ✅ MongoDB ist gestartet: `docker ps` oder `systemctl status mongod`
2. ✅ Verbindung testen: `mongosh` oder `docker exec -it mongodb mongosh`
3. ✅ Sample Data erstellen: `npm run sample-data`
4. ✅ App testen: `npm run dev`
5. ✅ Migration durchführen: `npm run migrate` (wenn alte Daten vorhanden)

## 🎓 Quick Start (Docker - Schnellste Methode)

```bash
# Alles in einem Befehl:
docker run -d --name mongodb -p 27017:27017 -v mongodb_data:/data/db --restart unless-stopped mongo:7.0

# Warten Sie 10 Sekunden, dann:
cd /home/pi/4minitz-next
npm run sample-data
npm run dev

# Fertig! Öffnen Sie: http://localhost:3000
```
