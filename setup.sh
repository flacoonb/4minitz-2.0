#!/bin/bash

# 4Minitz 2.0 - Setup Script
# Dieses Script richtet die komplette Entwicklungsumgebung ein

set -e  # Exit on error

echo "🚀 4Minitz 2.0 Setup"
echo "======================="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js nicht gefunden. Bitte installieren Sie Node.js 18+"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "⚠️  Node.js Version $NODE_VERSION ist zu alt. Mindestens v18 erforderlich."
    exit 1
fi

echo "✅ Node.js $(node -v) gefunden"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "⚠️  Docker nicht gefunden. MongoDB muss manuell installiert werden."
    SKIP_DOCKER=true
else
    echo "✅ Docker $(docker --version | cut -d' ' -f3 | tr -d ',') gefunden"
    SKIP_DOCKER=false
fi

echo ""
echo "📦 Installiere Dependencies..."
npm install

echo ""
echo "📂 Erstelle Upload-Verzeichnis..."
mkdir -p uploads
chmod 755 uploads

# .env.local erstellen wenn nicht vorhanden
if [ ! -f .env.local ]; then
    echo ""
    echo "⚙️  Erstelle .env.local..."
    cat > .env.local << 'EOF'
# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/4minitz-next

# NextAuth Configuration
NEXTAUTH_SECRET=change-this-to-a-random-secret-min-32-chars
NEXTAUTH_URL=http://localhost:3000

# Email Configuration (SMTP) - set to your SMTP server for production
# For local development point this to a test SMTP or leave default values
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
FROM_EMAIL=noreply@4minitz.local

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
EOF
    echo "✅ .env.local erstellt"
else
    echo "ℹ️  .env.local existiert bereits"
fi

# Docker Container starten / MongoDB Setup
if [ "$SKIP_DOCKER" = false ]; then
    echo ""
    echo "🐳 Docker/DB Konfiguration"

    # Read default DB name from .env.local if present
    DEFAULT_URI="$(grep -E '^MONGODB_URI=' .env.local 2>/dev/null | cut -d'=' -f2- || true)"
    if [ -n "$DEFAULT_URI" ]; then
        # try to extract DB name
        DEFAULT_DB=$(echo "$DEFAULT_URI" | sed -E 's|.*\/([^\/?]+)(\?.*)?$|\1|')
    fi
    DEFAULT_DB=${DEFAULT_DB:-4minitz}

    read -p "MongoDB per Docker verwenden? (Y/n) " -n 1 -r
    echo ""
    USE_DOCKER=true
    if [[ $REPLY =~ ^[Nn]$ ]]; then
        USE_DOCKER=false
    fi

    read -p "Datenbankname [$DEFAULT_DB]: " DB_NAME
    DB_NAME=${DB_NAME:-$DEFAULT_DB}

    read -p "MongoDB Auth aktivieren? (y/N) " -n 1 -r
    echo ""
    ENABLE_AUTH=false
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        ENABLE_AUTH=true
    fi

    if [ "$USE_DOCKER" = true ]; then
        echo "🐳 Starte/erstelle MongoDB Docker Container..."

            # Ensure we have root credentials (ask user if not provided earlier)
            if [ -z "${ROOT_USER:-}" ]; then
                read -p "Root-Benutzername für MongoDB (admin) [root]: " ROOT_USER
                ROOT_USER=${ROOT_USER:-root}
            fi
            if [ -z "${ROOT_PASS:-}" ]; then
                read -s -p "Root-Passwort für MongoDB: " ROOT_PASS
                echo ""
            fi

        if docker ps -a | grep -q mongodb-4minitz; then
            echo "ℹ️  MongoDB Container existiert bereits"
            if ! docker ps | grep -q mongodb-4minitz; then
                echo "🔄 Starte MongoDB..."
                docker start mongodb-4minitz
            fi
        else
            if [ "$ENABLE_AUTH" = true ]; then
                # create container with root user
                docker run -d \
                    --name mongodb-4minitz \
                    --network host \
                    -v mongodb_data:/data/db \
                    -e MONGO_INITDB_ROOT_USERNAME="$ROOT_USER" \
                    -e MONGO_INITDB_ROOT_PASSWORD="$ROOT_PASS" \
                    mongo:7.0
            else
                docker run -d \
                    --name mongodb-4minitz \
                    --network host \
                    -v mongodb_data:/data/db \
                    mongo:7.0
            fi
        fi

        echo "⏳ Warte kurz bis MongoDB startet..."
        sleep 5

        if [ "$ENABLE_AUTH" = true ]; then
            # create application user
            read -p "App-Benutzername (wird für die App verwendet) [minitz_app]: " APP_USER
            APP_USER=${APP_USER:-minitz_app}
            read -s -p "App-Passwort: " APP_PASS
            echo ""

            echo "🔐 Erstelle App-Benutzer in DB '$DB_NAME'..."
            export MONGODB_ADMIN_URI="mongodb://$ROOT_USER:$ROOT_PASS@localhost:27017/admin"
            export TARGET_DB="$DB_NAME"
            export NEW_DB_USER="$APP_USER"
            export NEW_DB_PASS="$APP_PASS"

            node scripts/create_mongo_user.js

            # Update .env.local with app credentials
            sed -i "/^MONGODB_URI=/d" .env.local || true
            echo "MONGODB_URI=mongodb://$APP_USER:$APP_PASS@localhost:27017/$DB_NAME" >> .env.local
            echo "✅ .env.local aktualisiert mit geschützter DB-URI"
            # create one-time setup token to protect web setup (if not existing)
            if [ ! -f .setup_token ]; then
                TOKEN=$(node -e "console.log(require('crypto').randomBytes(16).toString('hex'))")
                echo "$TOKEN" > .setup_token
                echo "🔐 One-time setup token created: $TOKEN"
                echo "   Use this token in the web setup page (or pass as header 'x-setup-token')."
            fi
        else
            # no auth -> ensure env has plain URI
            sed -i "/^MONGODB_URI=/d" .env.local || true
            echo "MONGODB_URI=mongodb://localhost:27017/$DB_NAME" >> .env.local
            echo "✅ .env.local aktualisiert (keine Auth)"
        fi
    else
        echo "ℹ️  Docker wird nicht verwendet. Bitte stellen Sie sicher, dass MongoDB läuft und MONGODB_URI in .env.local korrekt ist."
        if [ ! -f .env.local ]; then
            echo "MONGODB_URI=mongodb://localhost:27017/$DB_NAME" >> .env.local
        fi
    fi

    # MailHog removed — no local SMTP test container will be started

    # optional: Datenbank jetzt leeren
    read -p "Möchten Sie jetzt alle Datenbank‑Einträge löschen (DROP DATABASE)? (y/N) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "⚠️  Datenbank wird gelöscht (Drop). Dies ist unwiderruflich."
        # ensure .env.local has MONGODB_URI set (possibly with app credentials)
        export MONGODB_URI=$(grep -E '^MONGODB_URI=' .env.local | cut -d'=' -f2-)
        if [ -z "$MONGODB_URI" ]; then
            echo "MONGODB_URI nicht gefunden in .env.local. Abbruch."
        else
            FORCE=1 node scripts/reset_db.js
            echo "✅ Datenbank gelöscht"
        fi
    fi
fi

# Demo User erstellen (optional)
echo ""
# Allow skipping demo creation via env flag SKIP_DEMO=1
if [ "${SKIP_DEMO:-0}" = "1" ]; then
    echo "ℹ️  SKIP_DEMO=1 gesetzt — Demo-User wird übersprungen."
else
    read -p "👤 Demo-User erstellen? (Y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Nn]$ ]]; then
        echo "ℹ️  Demo-User Erstellung übersprungen."
    else
        echo "👤 Erstelle Demo-User..."
        # use npx --yes to avoid interactive prompt on installing tsx
        npx --yes tsx scripts/create-demo-user.ts || {
            echo "Warnung: Demo-User-Erstellung fehlgeschlagen oder abgebrochen.";
        }
    fi
fi

# Sample Data erstellen
echo ""
read -p "📊 Möchten Sie Beispieldaten erstellen? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    npx tsx scripts/sample-data.ts
    echo "✅ Beispieldaten erstellt"
fi

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║           ✅ Setup erfolgreich abgeschlossen! ✅           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "🎯 Nächste Schritte:"
echo ""
echo "1. Development Server starten:"
echo "   npm run dev"
echo ""
echo "2. Anwendung öffnen:"
echo "   http://localhost:3000"
echo ""
echo "3. Mit Demo-User anmelden:"
echo "   Email: demo@example.com"
echo "   Passwort: demo123"
echo ""
# Note: MailHog removed from setup. Configure SMTP in .env.local if needed.
echo "📚 Weitere Infos: README.md"
echo ""
