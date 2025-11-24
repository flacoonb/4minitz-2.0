# Migration Guide

## 🎯 Übersicht

Diese Anleitung beschreibt, wie Sie Ihre bestehenden 4minitz-Daten von Meteor.js nach Next.js migrieren.

## 📋 Voraussetzungen

- Node.js 20+ installiert
- Zugriff auf die alte 4minitz MongoDB
- Next.js Projekt ist aufgesetzt

## 🔄 Migrations-Optionen

### Option 1: Sample-Daten erstellen (Zum Testen)

Erstellt Beispieldaten zum Testen der Anwendung:

```bash
npm run sample-data
```

Dies erstellt:
- 3 Meeting Series (Product Dev, Marketing, Engineering)
- 2 Minutes mit Topics und Action Items
- Realistische Test-Daten

### Option 2: Echte Daten migrieren

#### Schritt 1: Umgebungsvariablen konfigurieren

Bearbeiten Sie `.env.local`:

```env
# Quelle: Ihre alte 4minitz Datenbank
SOURCE_MONGODB_URI=mongodb://localhost:27017/4minitz

# Ziel: Neue Next.js Datenbank
MONGODB_URI=mongodb://localhost:27017/4minitz-next
```

#### Schritt 2: Migration durchführen

```bash
# Führt die komplette Migration durch
npm run migrate
```

Der Migrations-Prozess:
1. ✅ Verbindet mit Quell- und Ziel-Datenbank
2. ✅ Migriert alle Meeting Series
3. ✅ Migriert alle Minutes
4. ✅ Erhält alle Beziehungen
5. ✅ Zeigt detaillierte Statistiken

#### Schritt 3: Migration verifizieren

```bash
# Überprüft die Datenintegrität
npm run verify
```

Überprüft:
- ✅ Anzahl der migrierten Datensätze
- ✅ Datenintegrität
- ✅ Beziehungen zwischen Series & Minutes
- ✅ Required Fields

## 📊 Was wird migriert?

### Meeting Series
```typescript
- project (Projektname)
- name (Serienname)
- visibleFor (Sichtbarkeit)
- moderators (Moderatoren)
- participants (Teilnehmer)
- informedUsers (CC-Empfänger)
- availableLabels (Labels/Tags)
- lastMinutesDate (Letztes Meeting)
- lastMinutesFinalized (Status)
```

### Minutes
```typescript
- meetingSeries_id (Referenz zur Serie)
- date (Meeting-Datum)
- isFinalized (Finalisiert?)
- participants (Teilnehmer)
- topics (Themen mit Action Items)
  - subject (Thema)
  - responsibles (Verantwortliche)
  - infoItems (Action Items)
    - subject (Beschreibung)
    - itemType (actionItem/infoItem)
    - priority (Priorität)
    - duedate (Fälligkeitsdatum)
    - responsibles (Verantwortliche)
- globalNote (Notizen)
```

## 🔍 Migrations-Logs

Der Migrations-Prozess zeigt detaillierte Logs:

```
🚀 Starting 4minitz Data Migration
============================================================
Source: mongodb://localhost:27017/4minitz
Target: mongodb://localhost:27017/4minitz-next
============================================================

📋 Migrating Meeting Series...
Found 15 meeting series to migrate
   ✅ Migrated: Product Development - Weekly Sync
   ✅ Migrated: Marketing - Monthly Planning
   ...

📝 Migrating Minutes...
Found 45 minutes to migrate
   ✅ Migrated minute: xxx (2024-11-03)
   ...

============================================================
📊 MIGRATION STATISTICS
============================================================

📋 Meeting Series:
   Total:    15
   Migrated: 15 ✅
   Failed:   0 ❌

📝 Minutes:
   Total:    45
   Migrated: 45 ✅
   Failed:   0 ❌

============================================================
✅ MIGRATION COMPLETED SUCCESSFULLY!
============================================================
```

## ⚠️ Wichtige Hinweise

### Daten-Backup
**Erstellen Sie IMMER ein Backup vor der Migration!**

```bash
# MongoDB Backup erstellen
mongodump --uri="mongodb://localhost:27017/4minitz" --out=/path/to/backup

# Oder mit dem alten 4minitz:
cd /home/pi/4minitz
meteor mongo --eval "db.runCommand({shutdown:1})"
mongodump --db=meteor
```

### Inkrementelle Migration
Das Migrations-Script überspringt bereits migrierte Daten:
- Bereits vorhandene IDs werden nicht erneut migriert
- Sie können das Script mehrfach ausführen
- Neue Daten werden hinzugefügt

### Parallelbetrieb
Beide Systeme können parallel laufen:
- Alt: `mongodb://localhost:27017/4minitz`
- Neu: `mongodb://localhost:27017/4minitz-next`

## 🐛 Troubleshooting

### Problem: Connection Refused

```bash
# MongoDB läuft nicht
sudo systemctl start mongod

# Oder mit Docker
docker start mongodb
```

### Problem: Authentication Failed

```env
# Fügen Sie Credentials hinzu
MONGODB_URI=mongodb://user:password@localhost:27017/4minitz-next
```

### Problem: Timeouts

```typescript
// Erhöhen Sie das Timeout in lib/mongodb.ts
const opts = {
  bufferCommands: false,
  serverSelectionTimeoutMS: 30000, // 30 Sekunden
};
```

### Problem: Speicher-Fehler

```bash
# Erhöhen Sie Node Memory
NODE_OPTIONS="--max-old-space-size=4096" npm run migrate
```

## 📈 Performance

Migrations-Geschwindigkeit (geschätzt):
- 100 Meeting Series: ~5 Sekunden
- 1000 Minutes: ~30 Sekunden
- 10000 Minutes: ~5 Minuten

## 🔄 Rollback

Falls etwas schief geht:

```bash
# Option 1: Ziel-Datenbank löschen
mongo mongodb://localhost:27017/4minitz-next --eval "db.dropDatabase()"

# Option 2: Backup wiederherstellen
mongorestore --uri="mongodb://localhost:27017/4minitz-next" /path/to/backup
```

## ✅ Nach der Migration

1. **Verifizierung durchführen**
   ```bash
   npm run verify
   ```

2. **Anwendung testen**
   ```bash
   npm run dev
   # Öffnen: http://localhost:3000
   ```

3. **API testen**
   ```bash
   curl http://localhost:3000/api/meeting-series
   ```

4. **Produktiv schalten**
   ```bash
   npm run build
   npm start
   ```

## 🎓 Beispiel: Kompletter Workflow

```bash
# 1. Repository klonen
git clone <your-repo>
cd 4minitz-next

# 2. Dependencies installieren
npm install

# 3. Umgebung konfigurieren
cp .env.local.example .env.local
# Bearbeiten Sie .env.local

# 4. Sample-Daten erstellen (für Tests)
npm run sample-data

# 5. Development Server starten
npm run dev

# 6. Anwendung testen
# http://localhost:3000

# 7. Echte Daten migrieren
npm run migrate

# 8. Migration verifizieren
npm run verify

# 9. Produktiv bauen
npm run build
npm start
```

## 📞 Support

Bei Problemen:
1. Prüfen Sie die Logs
2. Verifizieren Sie die Datenbank-Verbindung
3. Erstellen Sie ein Backup
4. Führen Sie die Verifizierung durch

## 🔗 Weiterführende Links

- [Next.js Dokumentation](https://nextjs.org/docs)
- [MongoDB Migration Best Practices](https://www.mongodb.com/docs/manual/tutorial/migrate-data/)
- [Original 4minitz](https://github.com/4minitz/4minitz)
