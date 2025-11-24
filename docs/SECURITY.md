# 🔐 Security & Secrets Management

## 🛡 Overview

4Minitz Next.js uses secure methods to handle sensitive information like SMTP credentials. We avoid storing plain-text passwords in the codebase or configuration files whenever possible.

## 🔑 Managing Secrets

We provide scripts to help you manage secrets securely.

### Option 1: GPG Encryption (Recommended for Simple Setup)

This method encrypts your secrets into a file that can be decrypted at runtime or for development.

**Setup:**
```bash
./scripts/simple-secrets.sh
# Choose Option 1: "Create new encrypted secrets"
```

**Usage:**
- **Development:** Decrypt to `.env.local` (Option 3 in script).
- **Production:** The app can be configured to decrypt on start (requires setup).

### Option 2: Systemd Credentials (Recommended for Production)

This method uses `systemd-creds` to securely store secrets that are only accessible by the service.

**Setup:**
```bash
sudo ./scripts/setup-secrets.sh
```

**How it works:**
1. **Encrypted Storage:** Secrets are stored in `/etc/4minitz/secrets/smtp.encrypted`.
   - Encrypted with `systemd-creds`.
   - Only readable by root.
   - Hardware-bound (cannot be copied to another machine).

2. **Automatic Decryption:** Systemd decrypts the file when starting the service.
   - Decrypted content is available at `/run/credentials/4minitz.service/smtp`.
   - Only visible to the `4minitz` service process.

3. **Environment Injection:** The start script (`scripts/load-credentials-and-start.sh`) reads the decrypted credentials and exports them as environment variables (`SMTP_PASS`, etc.) before starting the app.

## 📂 File Locations

| Type | Location | Description |
|------|----------|-------------|
| **Encrypted Secrets** | `/etc/4minitz/secrets/smtp.encrypted` | Systemd encrypted file |
| **GPG Secrets** | `~/.4minitz-secrets/smtp.gpg` | GPG encrypted file |
| **Service Config** | `/etc/systemd/system/4minitz.service.d/credentials.conf` | Systemd drop-in for credentials |
| **Start Script** | `scripts/load-credentials-and-start.sh` | Boot script that loads secrets |

## 🔍 Verification

To verify that your production secrets are loaded correctly:

1. Check the service status:
   ```bash
   sudo systemctl status 4minitz
   ```

2. Check the application logs (secrets are masked, but connection errors will show):
   ```bash
   sudo journalctl -u 4minitz -n 50
   ```
