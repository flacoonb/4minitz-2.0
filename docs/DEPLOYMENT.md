# 4Minitz Next.js - Deployment Guide

## Vercel Deployment (Empfohlen)

### Voraussetzungen
- Vercel Account (kostenlos)
- MongoDB Atlas Account (kostenlos)
- SMTP Email Provider (Gmail, SendGrid, etc.)

### Schritt 1: MongoDB Atlas Setup

```bash
# 1. Gehe zu https://cloud.mongodb.com/
# 2. Erstelle kostenloses Cluster (M0)
# 3. Erstelle Database User
# 4. Whitelist IP: 0.0.0.0/0 (für Vercel)
# 5. Kopiere Connection String
```

Beispiel Connection String:
```
mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/4minitz-next?retryWrites=true&w=majority
```

### Schritt 2: SMTP Provider

#### Option A: Gmail (Einfach)
```bash
# 1. Google Account → Sicherheit
# 2. 2-Faktor-Authentifizierung aktivieren
# 3. App-Passwörter → Mail → Passwort generieren
# 4. Notiere Passwort für später
```

#### Option B: SendGrid (Professionell)
```bash
# 1. https://sendgrid.com/ Account erstellen
# 2. API Key generieren
# 3. SMTP Credentials erhalten
```

### Schritt 3: Vercel Deployment

```bash
# 1. Vercel CLI installieren
npm i -g vercel

# 2. In Projekt-Verzeichnis
cd 4minitz-next

# 3. Login
vercel login

# 4. Deployment starten
vercel

# Folge den Prompts:
# - Set up and deploy? [Y]
# - Which scope? [Dein Account]
# - Link to existing project? [N]
# - What's your project's name? [4minitz-next]
# - In which directory is your code located? [./]
# - Want to override the settings? [N]
```

### Schritt 4: Environment Variables

In Vercel Dashboard (oder CLI):

```bash
# Via CLI
vercel env add MONGODB_URI
# Paste: mongodb+srv://...

vercel env add NEXTAUTH_SECRET
# Generate: openssl rand -base64 32
# Paste generated secret

vercel env add NEXTAUTH_URL
# Paste: https://your-project.vercel.app

vercel env add SMTP_HOST
# Gmail: smtp.gmail.com
# SendGrid: smtp.sendgrid.net

vercel env add SMTP_PORT
# Gmail: 587
# SendGrid: 587

vercel env add SMTP_SECURE
# false

vercel env add SMTP_USER
# Deine Email oder Username

vercel env add SMTP_PASS
# App-Passwort oder API Key

vercel env add FROM_EMAIL
# Absender-Email

vercel env add NEXT_PUBLIC_APP_URL
# https://your-project.vercel.app

vercel env add CRON_SECRET
# Generate: openssl rand -base64 32
```

### Schritt 5: Production Deployment

```bash
# Production deployment
vercel --prod

# Oder via Git
git push origin main
# Automatisches Deployment via Vercel GitHub Integration
```

### Schritt 6: Cron Jobs einrichten

Die `vercel.json` ist bereits konfiguriert für tägliche Erinnerungen um 9:00 Uhr.

**Wichtig:** In Vercel Dashboard:
1. Settings → Environment Variables
2. Stelle sicher, dass `CRON_SECRET` gesetzt ist
3. Cron Jobs sind automatisch aktiv

### Schritt 7: Demo User erstellen

```bash
# Nach erstem Deployment
vercel env pull .env.local
npm run create-demo-user

# Oder manuell via MongoDB Atlas
# Verbinde zu Atlas und füge User in 'users' Collection ein
```

---

## AWS Deployment

### Voraussetzungen
- AWS Account
- AWS CLI installiert
- Docker installiert

### Option A: AWS Elastic Beanstalk

```bash
# 1. Erstelle Dockerfile
cat > Dockerfile << 'EOF'
FROM node:20-alpine AS base

# Dependencies
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Runner
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
EOF

# 2. next.config.ts anpassen
# output: 'standalone' hinzufügen

# 3. EB CLI installieren
pip install awsebcli

# 4. Initialize
eb init -p docker 4minitz-next

# 5. Create environment
eb create 4minitz-production

# 6. Set environment variables
eb setenv MONGODB_URI=mongodb+srv://...
eb setenv NEXTAUTH_SECRET=...
# ... alle anderen vars

# 7. Deploy
eb deploy
```

### Option B: AWS ECS (Docker)

```bash
# 1. Build image
docker build -t 4minitz-next .

# 2. Push to ECR
aws ecr create-repository --repository-name 4minitz-next
docker tag 4minitz-next:latest xxx.dkr.ecr.region.amazonaws.com/4minitz-next
aws ecr get-login-password | docker login --username AWS --password-stdin xxx.dkr.ecr...
docker push xxx.dkr.ecr.region.amazonaws.com/4minitz-next

# 3. Create ECS Task Definition
# 4. Create ECS Service
# 5. Configure Load Balancer
```

---

## Digital Ocean Deployment

### App Platform

```bash
# 1. Verbinde GitHub Repository mit Digital Ocean App Platform
# 2. Wähle Node.js
# 3. Build Command: npm run build
# 4. Run Command: npm start
# 5. Environment Variables hinzufügen (siehe oben)
# 6. Deploy
```

### Droplet (VPS)

```bash
# 1. Erstelle Droplet (Ubuntu 22.04)
ssh root@your-ip

# 2. Setup
apt update && apt upgrade -y
apt install -y nodejs npm nginx docker.io

# 3. Clone repo
cd /var/www
git clone <your-repo>
cd 4minitz-next

# 4. Install & Build
npm install
npm run build

# 5. PM2 für Process Management
npm install -g pm2
pm2 start npm --name "4minitz-next" -- start
pm2 save
pm2 startup

# 6. Nginx Reverse Proxy
cat > /etc/nginx/sites-available/4minitz << 'EOF'
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

ln -s /etc/nginx/sites-available/4minitz /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx

# 7. SSL mit Let's Encrypt
apt install -y certbot python3-certbot-nginx
certbot --nginx -d yourdomain.com
```

---

## Docker Compose Deployment

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - MONGODB_URI=mongodb://mongo:27017/4minitz-next
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - NEXTAUTH_URL=http://localhost:3000
      - SMTP_HOST=mailhog
      - SMTP_PORT=1025
      - FROM_EMAIL=noreply@4minitz.local
      - NEXT_PUBLIC_APP_URL=http://localhost:3000
    depends_on:
      - mongo
      - mailhog

  mongo:
    image: mongo:7.0
    volumes:
      - mongodb_data:/data/db
    ports:
      - "27017:27017"

  mailhog:
    image: mailhog/mailhog
    ports:
      - "1025:1025"
      - "8025:8025"

volumes:
  mongodb_data:
```

```bash
# Deployment
docker-compose up -d

# Logs anzeigen
docker-compose logs -f

# Stoppen
docker-compose down
```

---

## Environment Variables Checklist

Für Production:

```bash
✅ MONGODB_URI                  # Atlas Connection String
✅ NEXTAUTH_SECRET              # openssl rand -base64 32
✅ NEXTAUTH_URL                 # https://yourdomain.com
✅ SMTP_HOST                    # smtp.gmail.com oder andere
✅ SMTP_PORT                    # 587
✅ SMTP_SECURE                  # false für Port 587
✅ SMTP_USER                    # Email oder Username
✅ SMTP_PASS                    # App-Passwort oder API Key
✅ FROM_EMAIL                   # Absender
✅ NEXT_PUBLIC_APP_URL          # https://yourdomain.com
✅ CRON_SECRET                  # openssl rand -base64 32
```

---

## Post-Deployment

### 1. Health Check

```bash
curl https://yourdomain.com/api/health
```

### 2. Demo User erstellen

```bash
# Lokal mit Production DB
MONGODB_URI=<production-uri> npm run create-demo-user
```

### 3. Sample Data (optional)

```bash
MONGODB_URI=<production-uri> npm run sample-data
```

### 4. Monitoring Setup

**Vercel:**
- Automatisches Monitoring inkludiert
- Analytics Dashboard verfügbar

**Andere Plattformen:**
- Sentry für Error Tracking
- Datadog/New Relic für APM
- UptimeRobot für Uptime Monitoring

### 5. Backup Strategy

```bash
# MongoDB Atlas: Automatische Backups
# Andere: Regelmäßige mongodump
mongodump --uri="<connection-string>" --out=/backup/$(date +%Y%m%d)
```

---

## Troubleshooting

### Build Fehler
```bash
# Lokal testen
npm run build
npm start
```

### Environment Variables nicht gesetzt
```bash
# Vercel: Dashboard → Settings → Environment Variables
# AWS: eb setenv VAR_NAME=value
# Docker: .env file oder docker-compose.yml
```

### Database Connection Fehler
```bash
# IP Whitelist in MongoDB Atlas prüfen
# Connection String Format prüfen
# Network Security Groups (AWS) prüfen
```

### Email sendet nicht
```bash
# SMTP Credentials prüfen
# Gmail: App-Passwort verwenden (nicht normales Passwort)
# SendGrid: API Key Permissions prüfen
```

---

## Performance Optimierung

### CDN für Static Assets
- Vercel: Automatisch
- AWS: CloudFront
- Andere: Cloudflare

### Database Optimization
- Indexes überprüfen (bereits implementiert)
- Query Performance analysieren
- Connection Pooling (bereits implementiert)

### Caching
- Redis für API Caching
- Next.js ISR für Static Pages
- CDN Edge Caching

---

## Sicherheit Checkliste

- [x] Environment Variables nicht im Code
- [x] HTTPS erzwingen
- [x] Strong Session Secrets
- [x] CSRF Protection (NextAuth)
- [ ] Rate Limiting implementieren
- [ ] WAF konfigurieren (AWS/Cloudflare)
- [ ] Regular Security Updates
- [ ] Backup Strategy
- [ ] Monitoring & Alerting

---

**Empfehlung:** Für schnelles Deployment → **Vercel**  
Für Enterprise/Kontrolle → **AWS** oder **Digital Ocean**
