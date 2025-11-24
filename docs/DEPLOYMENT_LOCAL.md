# 🐧 Local Deployment (Systemd)

This guide describes how to install and manage the 4Minitz application as a systemd service on Linux.

## 📂 Files

- `4minitz.service` - Systemd Service Definition
- `install-service.sh` - Installation Script
- `uninstall-service.sh` - Uninstallation Script

## 🚀 Installation

1. **Install Service:**
   ```bash
   sudo ./install-service.sh
   ```

2. **Check Status:**
   ```bash
   sudo systemctl status 4minitz
   ```

3. **Open App:**
   - http://localhost:3000

## 🛠 Service Management

### Basic Commands
```bash
# Start Service
sudo systemctl start 4minitz

# Stop Service
sudo systemctl stop 4minitz

# Restart Service
sudo systemctl restart 4minitz

# Show Status
sudo systemctl status 4minitz

# Enable on Boot
sudo systemctl enable 4minitz

# Disable on Boot
sudo systemctl disable 4minitz
```

### View Logs
```bash
# Live Logs
sudo journalctl -u 4minitz -f

# Last 50 Lines
sudo journalctl -u 4minitz -n 50

# Logs since today
sudo journalctl -u 4minitz --since today
```

## 🔄 Deployment Workflow

When deploying code changes:

1. **Build Application:**
   ```bash
   cd /home/pi/4minitz-next
   npm run build
   ```

2. **Restart Service:**
   ```bash
   sudo systemctl restart 4minitz
   ```

3. **Verify Status:**
   ```bash
   sudo systemctl status 4minitz
   ```

## 📊 Monitoring

### Health Check
```bash
curl http://localhost:3000/api/health
```

Expected Response:
```json
{
  "status": "healthy",
  "services": {
    "api": "operational",
    "database": "connected"
  }
}
```

## ❓ Troubleshooting

### Service fails to start
1. Check Logs: `sudo journalctl -u 4minitz -n 50`
2. Install Dependencies: `npm install`
3. Rebuild: `npm run build`
4. Restart: `sudo systemctl restart 4minitz`

### App unreachable
1. Check Port Binding: `sudo netstat -tlnp | grep :3000`
2. Check Firewall: `sudo ufw status`
3. Check Service Status: `sudo systemctl status 4minitz`

### Uninstall Service
```bash
sudo ./uninstall-service.sh
```
