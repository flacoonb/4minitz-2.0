# 🎯 4Minitz Next.js - Schnellstart Guide

## In 5 Minuten zum laufenden System

### 1️⃣ Voraussetzungen prüfen

```bash
# Node.js 18+ installiert?
node --version  # sollte v18+ sein

# Docker installiert? (für MongoDB & MailHog)
docker --version
```

### 2️⃣ Automatisches Setup

```bash
# Projekt klonen (wenn noch nicht geschehen)
cd /home/pi/4minitz-next

# Automatisches Setup ausführen
npm run setup
```

Das Script macht alles automatisch:
- ✅ npm install
- ✅ MongoDB Container starten
- ✅ MailHog Container starten  
- ✅ .env.local erstellen
- ✅ Demo-User anlegen
- ✅ Beispieldaten generieren (optional)

### 3️⃣ Development Server starten

```bash
npm run dev
```

🎉 **Fertig!** Öffne http://localhost:3000

---

## 🔑 Login

**Email:** demo@example.com  
**Passwort:** demo123

---

## 📍 Wichtige URLs

| Service | URL | Beschreibung |
|---------|-----|--------------|
| **App** | http://localhost:3000 | Hauptanwendung |
| **Dashboard** | http://localhost:3000/dashboard | Statistiken & Action Items |
| **Sitzungen** | http://localhost:3000/meeting-series | Meeting Series Overview |
| **Protokolle** | http://localhost:3000/minutes | Minutes Overview |
| **Email Settings** | http://localhost:3000/settings/email | Email Tests & Config |
| **MailHog UI** | http://localhost:8025 | Test-Emails anzeigen |
| **Health Check** | http://localhost:3000/api/health | API Status |

---

## 🚀 Erste Schritte

### 1. Neue Sitzung erstellen
1. Gehe zu "Sitzungen"
2. Klicke "Neue Sitzung erstellen"
3. Fülle Formular aus
4. Speichern

### 2. Protokoll erstellen
1. Gehe zu "Protokolle"
2. Klicke "Neues Protokoll erstellen"
3. Wähle Sitzung
4. Füge Topics & Action Items hinzu
5. Speichern

### 3. PDF exportieren
1. Öffne ein Protokoll
2. Klicke "Als PDF exportieren"
3. PDF wird heruntergeladen

### 4. Email testen
1. Gehe zu "Einstellungen"
2. Klicke "Test-Email senden"
3. Öffne MailHog: http://localhost:8025
4. Email sollte dort erscheinen

---

## 📦 Verfügbare Commands

```bash
# Development
npm run dev              # Dev-Server starten
npm run build            # Production Build
npm run start            # Production Server

# Database
npm run create-demo-user # Demo User erstellen
npm run sample-data      # Beispieldaten generieren
npm run migrate          # Alte Daten migrieren
npm run verify           # Migration verifizieren

# Quality
npm run lint             # ESLint Check
npm run type-check       # TypeScript Check

# Setup
npm run setup            # Komplettes Setup
```

---

## 🐳 Docker Container Management

```bash
# MongoDB Container
docker ps | grep mongodb           # Status prüfen
docker restart mongodb-4minitz     # Neustart
docker logs mongodb-4minitz        # Logs anzeigen

# MailHog Container  
docker ps | grep mailhog          # Status prüfen
docker restart mailhog            # Neustart
docker logs mailhog               # Logs anzeigen

# Alle Container stoppen
docker stop mongodb-4minitz mailhog

# Alle Container starten
docker start mongodb-4minitz mailhog
```

---

## 🔧 Konfiguration

### .env.local bearbeiten

```bash
# Öffne .env.local und passe an:
nano .env.local

# Wichtige Variablen:
MONGODB_URI=mongodb://localhost:27017/4minitz-next
SMTP_HOST=localhost
SMTP_PORT=1025
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Sprache wechseln

Klicke auf den Sprach-Button oben rechts (🌍 DE/EN)

---

## 📖 Dokumentation

| Dokument | Inhalt |
|----------|--------|
| **README.md** | Haupt-Dokumentation |
| **STATUS.md** | Vollständiger Projekt-Status |
| **docs/EMAIL.md** | Email Setup & MailHog Guide |
| **docs/CRON.md** | Cron Jobs für Erinnerungen |
| **docs/DEPLOYMENT.md** | Production Deployment Guide |

---

## 🐛 Häufige Probleme

### Port 3000 bereits in Verwendung

```bash
# Prozess finden und beenden
lsof -ti:3000 | xargs kill -9

# Oder anderen Port verwenden
PORT=3001 npm run dev
```

### MongoDB verbindet nicht

```bash
# Container Status prüfen
docker ps | grep mongodb

# Container neustarten
docker restart mongodb-4minitz

# Logs prüfen
docker logs mongodb-4minitz
```

### Emails werden nicht gesendet

```bash
# MailHog läuft?
docker ps | grep mailhog

# MailHog UI öffnen
open http://localhost:8025

# Settings-Seite nutzen
open http://localhost:3000/settings/email
```

### TypeScript Errors

```bash
# Cache leeren
rm -rf .next

# Neustart
npm run dev
```

---

## 💡 Tipps & Tricks

### Schneller Development Cycle

```bash
# Terminal 1: Dev Server
npm run dev

# Terminal 2: Logs
tail -f /tmp/nextjs.log | grep -i error

# Terminal 3: MongoDB Shell (optional)
docker exec -it mongodb-4minitz mongosh
```

### Sample Data zurücksetzen

```bash
# MongoDB leeren
docker exec -it mongodb-4minitz mongosh 4minitz-next --eval "db.dropDatabase()"

# Neu generieren
npm run create-demo-user
npm run sample-data
```

### Production Build testen

```bash
npm run build
npm start

# Öffne: http://localhost:3000
```

---

## 🎓 Nächste Schritte

### Für Entwickler
1. 📖 Lies **STATUS.md** für vollständigen Überblick
2. 🔍 Schaue in `app/api/` für API-Struktur
3. 🎨 Prüfe `components/` für React Components
4. 📊 Verstehe `models/` für Datenstrukturen

### Für Production
1. 📖 Lies **docs/DEPLOYMENT.md**
2. 🔐 Generiere sichere Secrets
3. 🗄️ Setup MongoDB Atlas
4. 📧 Konfiguriere SMTP Provider
5. 🚀 Deploy zu Vercel/AWS

### Für Testing
1. 📧 Teste alle Email-Benachrichtigungen
2. 📄 Exportiere verschiedene PDFs
3. 📎 Lade verschiedene Dateitypen hoch
4. 🌍 Teste beide Sprachen (DE/EN)
5. 📱 Teste Responsive Design

---

## 📞 Support

**Probleme?** Prüfe:
1. ✅ Logs: `tail -f /tmp/nextjs.log`
2. ✅ Container Status: `docker ps`
3. ✅ Environment Variables: `.env.local`
4. ✅ Dokumentation im `docs/` Ordner

**Status-Übersicht:**
```bash
# Alles prüfen auf einmal
curl http://localhost:3000/api/health
docker ps
npm run type-check
```

---

## 🎉 Viel Erfolg!

Die Anwendung ist vollständig funktionsfähig und produktionsreif.

**Entwickelt mit:**
- Next.js 15 + React 19
- TypeScript
- MongoDB + Mongoose
- TailwindCSS
- NextAuth.js
- Nodemailer + jsPDF

**Features:**
✅ Meeting Series Management  
✅ Minutes mit Action Items  
✅ Dashboard mit Statistiken  
✅ PDF Export  
✅ Email-Benachrichtigungen  
✅ File Attachments  
✅ Internationalisierung (DE/EN)  
✅ Authentication  

🚀 **Happy Coding!**
