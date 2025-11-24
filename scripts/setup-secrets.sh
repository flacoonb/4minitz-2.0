#!/bin/bash

# setup-secrets.sh - Encrypted secrets management for 4minitz
# This script helps you securely store SMTP credentials using systemd credentials encryption

set -e

SECRETS_DIR="/etc/4minitz/secrets"
ENCRYPTED_FILE="$SECRETS_DIR/smtp.encrypted"
SERVICE_NAME="4minitz"

echo "=========================================="
echo "  4Minitz Encrypted Secrets Setup"
echo "=========================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "⚠️  Dieses Skript muss als root ausgeführt werden."
    echo "   Führen Sie es mit 'sudo' aus:"
    echo "   sudo ./scripts/setup-secrets.sh"
    exit 1
fi

# Check if systemd-creds is available
if ! command -v systemd-creds &> /dev/null; then
    echo "❌ systemd-creds nicht gefunden."
    echo "   Installieren Sie systemd version 250 oder höher."
    exit 1
fi

echo "✅ systemd-creds gefunden"
echo ""

# Create secrets directory
echo "📁 Erstelle Secrets-Verzeichnis..."
mkdir -p "$SECRETS_DIR"
chmod 700 "$SECRETS_DIR"

# Collect SMTP credentials
echo ""
echo "Bitte geben Sie Ihre SMTP-Zugangsdaten ein:"
echo "(Diese werden verschlüsselt gespeichert)"
echo ""

read -p "SMTP Host (z.B. smtp.gmail.com): " SMTP_HOST
read -p "SMTP Port (z.B. 587): " SMTP_PORT
read -p "SMTP Secure (true/false): " SMTP_SECURE
read -p "SMTP Benutzername: " SMTP_USER
read -sp "SMTP Passwort: " SMTP_PASS
echo ""
read -p "Von E-Mail-Adresse: " FROM_EMAIL

# Create credentials JSON
CREDS_JSON=$(cat <<EOF
{
  "smtp_host": "$SMTP_HOST",
  "smtp_port": "$SMTP_PORT",
  "smtp_secure": "$SMTP_SECURE",
  "smtp_user": "$SMTP_USER",
  "smtp_pass": "$SMTP_PASS",
  "from_email": "$FROM_EMAIL"
}
EOF
)

# Encrypt credentials
echo ""
echo "🔒 Verschlüssele Zugangsdaten..."
echo "$CREDS_JSON" | systemd-creds encrypt --name=smtp - "$ENCRYPTED_FILE"

# Set proper permissions
chmod 600 "$ENCRYPTED_FILE"
chown root:root "$ENCRYPTED_FILE"

echo ""
echo "✅ Zugangsdaten erfolgreich verschlüsselt!"
echo "   Gespeichert in: $ENCRYPTED_FILE"
echo ""

# Create systemd service drop-in to load credentials
DROPIN_DIR="/etc/systemd/system/$SERVICE_NAME.service.d"
DROPIN_FILE="$DROPIN_DIR/credentials.conf"

echo "📝 Erstelle systemd Service-Konfiguration..."
mkdir -p "$DROPIN_DIR"

cat > "$DROPIN_FILE" <<EOF
[Service]
# Load encrypted SMTP credentials
LoadCredential=smtp:$ENCRYPTED_FILE

# Set environment variables from credentials
# (This will be handled by the application)
EOF

chmod 644 "$DROPIN_FILE"

echo "✅ Service-Konfiguration erstellt"
echo ""

# Create helper script to read credentials
HELPER_SCRIPT="/home/pi/4minitz-next/scripts/load-smtp-credentials.sh"

cat > "$HELPER_SCRIPT" <<'EOFSCRIPT'
#!/bin/bash

# load-smtp-credentials.sh - Load decrypted SMTP credentials into environment

CREDS_FILE="${CREDENTIALS_DIRECTORY}/smtp"

if [ ! -f "$CREDS_FILE" ]; then
    echo "⚠️  Credentials file not found: $CREDS_FILE" >&2
    exit 1
fi

# Read and parse JSON credentials
SMTP_HOST=$(jq -r '.smtp_host' "$CREDS_FILE")
SMTP_PORT=$(jq -r '.smtp_port' "$CREDS_FILE")
SMTP_SECURE=$(jq -r '.smtp_secure' "$CREDS_FILE")
SMTP_USER=$(jq -r '.smtp_user' "$CREDS_FILE")
SMTP_PASS=$(jq -r '.smtp_pass' "$CREDS_FILE")
FROM_EMAIL=$(jq -r '.from_email' "$CREDS_FILE")

# Export as environment variables
export SMTP_HOST
export SMTP_PORT
export SMTP_SECURE
export SMTP_USER
export SMTP_PASS
export FROM_EMAIL

# Execute the main application
exec "$@"
EOFSCRIPT

chmod +x "$HELPER_SCRIPT"
chown pi:pi "$HELPER_SCRIPT"

echo "✅ Credentials-Loader erstellt"
echo ""

# Update .env.local to use environment variables (as fallback)
ENV_FILE="/home/pi/4minitz-next/.env.local"
if [ -f "$ENV_FILE" ]; then
    # Backup current .env.local
    BACKUP_FILE="$ENV_FILE.backup.secrets.$(date +%Y%m%d_%H%M%S)"
    cp "$ENV_FILE" "$BACKUP_FILE"
    echo "📄 Backup von .env.local erstellt: $BACKUP_FILE"
    
    # Comment out SMTP credentials in .env.local
    sed -i 's/^SMTP_HOST=/#SMTP_HOST=/' "$ENV_FILE"
    sed -i 's/^SMTP_PORT=/#SMTP_PORT=/' "$ENV_FILE"
    sed -i 's/^SMTP_SECURE=/#SMTP_SECURE=/' "$ENV_FILE"
    sed -i 's/^SMTP_USER=/#SMTP_USER=/' "$ENV_FILE"
    sed -i 's/^SMTP_PASS=/#SMTP_PASS=/' "$ENV_FILE"
    sed -i 's/^FROM_EMAIL=/#FROM_EMAIL=/' "$ENV_FILE"
    
    # Add note
    if ! grep -q "Credentials loaded from systemd" "$ENV_FILE"; then
        echo "" >> "$ENV_FILE"
        echo "# SMTP Credentials loaded from systemd encrypted storage" >> "$ENV_FILE"
        echo "# Location: $ENCRYPTED_FILE" >> "$ENV_FILE"
    fi
    
    echo "✅ .env.local aktualisiert (SMTP-Credentials auskommentiert)"
fi

echo ""
echo "=========================================="
echo "  ✅ Setup abgeschlossen!"
echo "=========================================="
echo ""
echo "Ihre SMTP-Zugangsdaten sind jetzt:"
echo "  • Verschlüsselt mit systemd-creds"
echo "  • Nur von root und dem Service lesbar"
echo "  • Werden beim Service-Start automatisch entschlüsselt"
echo ""
echo "Nächste Schritte:"
echo ""
echo "1. Systemd neu laden:"
echo "   sudo systemctl daemon-reload"
echo ""
echo "2. Service neu starten:"
echo "   sudo systemctl restart $SERVICE_NAME"
echo ""
echo "3. Credentials anzeigen (zum Testen):"
echo "   sudo systemd-creds cat smtp"
echo ""
echo "4. Verschlüsselte Datei ansehen:"
echo "   sudo ls -la $ENCRYPTED_FILE"
echo ""
echo "⚠️  WICHTIG:"
echo "  • Die verschlüsselte Datei ist an diese Maschine gebunden"
echo "  • Bei Hardware-Wechsel muss die Verschlüsselung erneuert werden"
echo "  • Backup der unverschlüsselten Credentials separat aufbewahren!"
echo ""
