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
