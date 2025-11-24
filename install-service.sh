#!/bin/bash

# 4Minitz Service Installation Script
# This script sets up the 4Minitz app as a systemd service

set -e

APP_NAME="4minitz"
APP_DIR="/home/pi/4minitz-next"
SERVICE_FILE="$APP_DIR/4minitz.service"
SYSTEMD_DIR="/etc/systemd/system"

echo "🚀 Installing 4Minitz as a systemd service..."

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
    sudo -u pi npm install
fi

# Copy service file to systemd directory
echo "📋 Installing service file..."
cp "$SERVICE_FILE" "$SYSTEMD_DIR/${APP_NAME}.service"

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