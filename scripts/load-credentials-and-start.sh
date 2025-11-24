#!/bin/bash

# load-credentials-and-start.sh
# This script loads systemd credentials and starts the Next.js application

set -e

# Check if credentials are available
if [ -n "$CREDENTIALS_DIRECTORY" ] && [ -f "$CREDENTIALS_DIRECTORY/smtp" ]; then
    echo "🔓 Loading encrypted SMTP credentials from systemd..."
    
    # Read JSON file using Python (available on all systems)
    CREDS_FILE="$CREDENTIALS_DIRECTORY/smtp"
    
    # Parse and export
    eval $(python3 << EOF
import json
import sys

try:
    with open('$CREDS_FILE', 'r') as f:
        data = json.load(f)
    
    print(f"export SMTP_HOST='{data['smtp_host']}'")
    print(f"export SMTP_PORT='{data['smtp_port']}'")
    print(f"export SMTP_SECURE='{data['smtp_secure']}'")
    print(f"export SMTP_USER='{data['smtp_user']}'")
    print(f"export SMTP_PASS='{data['smtp_pass']}'")
    print(f"export FROM_EMAIL='{data['from_email']}'")
except Exception as e:
    print(f"# ERROR: {e}", file=sys.stderr)
    sys.exit(1)
EOF
)
    
    echo "✅ SMTP credentials loaded successfully"
    echo "   Host: $SMTP_HOST:$SMTP_PORT (Secure: $SMTP_SECURE)"
    echo "   From: $FROM_EMAIL"
else
    echo "⚠️  No systemd credentials found, using .env.local fallback"
fi

# Start the Next.js application
echo "🚀 Starting Next.js application..."
exec npm start
