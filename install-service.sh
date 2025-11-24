#!/bin/bash

# 4Minitz Service Installation Script
# This script sets up the 4Minitz app as a systemd service

set -e

APP_NAME="4minitz"
# Determine directory where script is located
APP_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SERVICE_FILE="$APP_DIR/4minitz.service"
SYSTEMD_DIR="/etc/systemd/system"

# Determine user who owns the directory (to run the service as)
APP_USER=$(stat -c '%U' "$APP_DIR")

echo "🚀 Installing 4Minitz as a systemd service..."
echo "   App Directory: $APP_DIR"
echo "   App User:      $APP_USER"

# Check if running as root or with sudo
if [[ $EUID -ne 0 ]]; then
   echo "❌ This script must be run as root or with sudo"
   echo "   Usage: sudo ./install-service.sh"
   exit 1
fi

# Check if the service file exists
if [[ ! -f "$SERVICE_FILE" ]]; then
    echo "❌ Service file not found at $SERVICE_FILE"
    exit 1
fi

# Check if the app directory exists
if [[ ! -d "$APP_DIR" ]]; then
    echo "❌ App directory not found at $APP_DIR"
    exit 1
fi

# Install dependencies if needed
echo "📦 Checking dependencies..."
cd "$APP_DIR"
if [[ ! -d "node_modules" ]]; then
    echo "   Installing npm dependencies..."
    sudo -u "$APP_USER" npm install
fi

# Build the application if .next doesn't exist
if [[ ! -d ".next" ]]; then
    echo "🏗️  Building application..."
    sudo -u "$APP_USER" npm run build
fi

# Copy service file to systemd directory and update paths/user
echo "📋 Installing service file..."
TARGET_SERVICE="$SYSTEMD_DIR/${APP_NAME}.service"

cp "$SERVICE_FILE" "$TARGET_SERVICE"

# Update paths and user in the installed service file
sed -i "s|User=pi|User=$APP_USER|g" "$TARGET_SERVICE"
sed -i "s|Group=pi|Group=$(id -gn $APP_USER)|g" "$TARGET_SERVICE"
sed -i "s|WorkingDirectory=/home/pi/4minitz-next|WorkingDirectory=$APP_DIR|g" "$TARGET_SERVICE"
sed -i "s|ExecStart=/home/pi/4minitz-next|ExecStart=$APP_DIR|g" "$TARGET_SERVICE"

echo "   Service file configured with User: $APP_USER, Dir: $APP_DIR"

# Reload systemd daemon
echo "🔄 Reloading systemd daemon..."
systemctl daemon-reload

# Enable the service (start on boot)
echo "✅ Enabling service to start on boot..."
systemctl enable ${APP_NAME}.service

# Start the service
echo "🚀 Starting the service..."
systemctl start ${APP_NAME}.service

# Check service status
echo "📊 Service status:"
systemctl status ${APP_NAME}.service --no-pager -l

echo ""
echo "🎉 Installation complete!"
echo ""
echo "Service management commands:"
echo "  Start:    sudo systemctl start ${APP_NAME}"
echo "  Stop:     sudo systemctl stop ${APP_NAME}"
echo "  Restart:  sudo systemctl restart ${APP_NAME}"
echo "  Status:   sudo systemctl status ${APP_NAME}"
echo "  Logs:     sudo journalctl -u ${APP_NAME} -f"
echo ""
echo "The app should now be available at http://localhost:3000"