# 4Minitz Next.js

## 🎯 Overview

**4Minitz Next.js** is a modern, web-based application for managing meeting minutes and action items. It is built with the latest web technologies to ensure performance, security, and ease of use.

### Stack
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Database**: MongoDB with Mongoose
- **Styling**: TailwindCSS
- **API**: RESTful

## 🚀 Quick Start

### 1. Prerequisites
- Node.js 18+
- Docker (optional, for local MongoDB)

### 2. Automatic Setup
The easiest way to get started is using the setup script:

```bash
npm run setup
```

This script will:
- ✅ Install dependencies
- ✅ Start MongoDB (via Docker)
- ✅ Create `.env.local` configuration
- ✅ Create a Demo User
- ✅ Generate Sample Data (optional)

### 3. Manual Setup
If you prefer manual setup:

```bash
# Install dependencies
npm install

# Start MongoDB (if using Docker)
docker run -d -p 27017:27017 --name mongodb mongo

# Start Development Server
npm run dev
```

Open: http://localhost:3000

## 🔑 Default Login

If you created the demo user:
- **Email:** `demo@example.com`
- **Password:** `demo123`

## 📁 Project Structure

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
scripts/                # Helper Scripts
```

## ✅ Features

- [x] MongoDB Connection
- [x] MeetingSeries Model
- [x] Minutes Model
- [x] RESTful API
- [x] CRUD Operations
- [x] TypeScript
- [x] Internationalization (i18n)
- [x] PDF Export
