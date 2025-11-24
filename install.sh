#!/bin/bash

# 4Minitz 2.0 - Full Installer
# Usage: curl -sL https://raw.githubusercontent.com/flacoonb/4minitz-2.0/main/install.sh | sudo bash

set -e

REPO_URL="https://github.com/flacoonb/4minitz-2.0.git"
INSTALL_DIR="4minitz-2.0"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 4Minitz 2.0 Installer${NC}"
echo "========================"

# 1. Check Root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ Please run this script as root (sudo).${NC}"
    exit 1
fi

# 2. System Update & Dependencies
echo -e "\n${BLUE}🔄 Updating system and installing base dependencies...${NC}"
apt-get update
apt-get install -y git curl build-essential

# 3. Check/Install Node.js
if ! command -v node &> /dev/null || ! command -v npm &> /dev/null; then
    echo -e "${BLUE}📦 Installing Node.js 20...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
else
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        echo -e "${BLUE}📦 Updating Node.js to version 20...${NC}"
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y nodejs
    else
        echo -e "${GREEN}✅ Node.js $(node -v) is already installed.${NC}"
    fi
fi

# Ensure npm is installed (sometimes separate)
if ! command -v npm &> /dev/null; then
    echo -e "${BLUE}📦 Installing npm...${NC}"
    apt-get install -y npm
fi

# 4. Check/Install Docker
if ! command -v docker &> /dev/null; then
    echo -e "${BLUE}🐳 Installing Docker...${NC}"
    curl -fsSL https://get.docker.com | sh
    if [ -n "$SUDO_USER" ]; then
        usermod -aG docker "$SUDO_USER"
        echo -e "${GREEN}✅ Added user $SUDO_USER to docker group.${NC}"
    fi
else
    echo -e "${GREEN}✅ Docker is already installed.${NC}"
fi

# 5. Clone Repository
if [ -d "$INSTALL_DIR" ]; then
    echo -e "\n${RED}⚠️  Directory '$INSTALL_DIR' already exists.${NC}"
    read -p "Do you want to delete it and reinstall? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf "$INSTALL_DIR"
    else
        echo "Aborting."
        exit 1
    fi
fi

echo -e "\n${BLUE}📥 Cloning repository...${NC}"
git clone "$REPO_URL" "$INSTALL_DIR"

# 6. Prepare & Run Setup
echo -e "\n${BLUE}⚙️  Starting setup...${NC}"

# Fix permissions if running as sudo
if [ -n "$SUDO_USER" ]; then
    chown -R "$SUDO_USER:$SUDO_USER" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
    chmod +x setup.sh
    
    echo -e "${BLUE}👤 Running setup as user $SUDO_USER...${NC}"
    # We use 'sudo -u' to run as the original user, preserving PATH to find newly installed binaries
    sudo -u "$SUDO_USER" PATH=$PATH ./setup.sh
else
    cd "$INSTALL_DIR"
    chmod +x setup.sh
    ./setup.sh
fi

# 7. Install Systemd Service (Optional)
echo -e "\n${BLUE}🚀 Service Installation${NC}"
read -p "Do you want to install 4Minitz as a systemd service (auto-start on boot)? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    APP_NAME="4minitz-2.0"
    APP_DIR=$(pwd)
    SERVICE_FILE="4minitz-2.0.service"
    SYSTEMD_DIR="/etc/systemd/system"
    
    # Determine user who owns the directory (to run the service as)
    if [ -n "$SUDO_USER" ]; then
        APP_USER="$SUDO_USER"
    else
        APP_USER=$(stat -c '%U' "$APP_DIR")
    fi

    echo "   App Directory: $APP_DIR"
    echo "   App User:      $APP_USER"

    # Build the application if .next doesn't exist
    if [[ ! -d ".next" ]]; then
        echo -e "${BLUE}🏗️  Building application (this may take a while)...${NC}"
        # Run build as the app user to avoid root-owned files in .next
        sudo -u "$APP_USER" PATH=$PATH npm run build
    fi

    # Copy service file
    echo -e "${BLUE}📋 Installing service file...${NC}"
    TARGET_SERVICE="$SYSTEMD_DIR/${APP_NAME}.service"
    
    if [[ -f "$SERVICE_FILE" ]]; then
        cp "$SERVICE_FILE" "$TARGET_SERVICE"
        
        # Update paths and user in the installed service file
        sed -i "s|User=pi|User=$APP_USER|g" "$TARGET_SERVICE"
        sed -i "s|Group=pi|Group=$(id -gn $APP_USER)|g" "$TARGET_SERVICE"
        sed -i "s|WorkingDirectory=/home/pi/4minitz-next|WorkingDirectory=$APP_DIR|g" "$TARGET_SERVICE"
        sed -i "s|ExecStart=/home/pi/4minitz-next|ExecStart=$APP_DIR|g" "$TARGET_SERVICE"
        
        # Reload systemd
        systemctl daemon-reload
        systemctl enable ${APP_NAME}.service
        systemctl start ${APP_NAME}.service
        
        echo -e "${GREEN}✅ Service installed and started!${NC}"
        echo "   Status: sudo systemctl status ${APP_NAME}"
    else
        echo -e "${RED}❌ Service file template '$SERVICE_FILE' not found.${NC}"
    fi
else
    echo -e "\n${GREEN}✅ Installation complete!${NC}"
    echo "You can start the app manually with: cd $INSTALL_DIR && npm run dev"
fi
