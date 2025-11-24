# 4Minitz Next.js Migration

## 🎯 Overview

Migration von **4minitz** von Meteor.js zu **Next.js 15**.

### Stack
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Database**: MongoDB mit Mongoose
- **Styling**: TailwindCSS
- **API**: RESTful

## 🚀 Quick Start

```bash
# Dependencies installieren
npm install

# MongoDB starten (optional, falls lokal)
docker run -d -p 27017:27017 --name mongodb mongo

# Development Server starten
npm run dev
```

Öffne: http://localhost:3000

## 📁 Struktur

```
app/
 api/                   # API Routes
 meeting-series/        # Meeting Series Pages
 minutes/               # Minutes Pages
 layout.tsx             # Root Layout
 page.tsx               # Home
components/             # React Components
models/                 # Mongoose Models
lib/                    # Utilities (Auth, Email, PDF)
```

## ✅ Features

- [x] MongoDB Connection
- [x] MeetingSeries Model
- [x] Minutes Model
- [x] RESTful API
- [x] CRUD Operations
- [x] TypeScript
- [x] TailwindCSS UI
- [x] Authentication (JWT, Role-based: Admin, Moderator, User)
- [x] File Uploads (Drag & Drop, Multi-format)
- [x] Email Notifications (New Minutes, Action Items)
- [x] PDF Export (Minutes with Tables)
- [x] Internationalization (i18n: DE/EN)

## 📊 API Endpoints

```
GET    /api/meeting-series        List all
POST   /api/meeting-series        Create new
GET    /api/meeting-series/[id]   Get one
PUT    /api/meeting-series/[id]   Update
DELETE /api/meeting-series/[id]   Delete
POST   /api/attachments           Upload file
```

## 🔄 Migration Status

**Phase 1**: Core Features Implemented ✅
**Phase 2**: Testing & Refinement (In Progress)
