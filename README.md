# 4Minitz 2.0

## 🎯 Overview

**4Minitz 2.0** is a modern, web-based application for managing meeting minutes and action items. It is built with the latest web technologies to ensure performance, security, and ease of use.

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

### 2. Installation (Recommended)
Run this command to download and install 4Minitz automatically:

```bash
curl -sL https://raw.githubusercontent.com/flacoonb/4minitz-2.0/main/install.sh | bash
```

### 3. Manual Setup (if already cloned)
If you have already cloned the repository, you can run the setup script directly:

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

## 👤 Admin / First User

### 1. Demo User (if created during setup)
If you selected "Yes" for the demo user during installation:
- **Email:** `demo@example.com`
- **Password:** `demo123`

### 2. Create Admin Manually
If you skipped the demo user or cannot log in, you must create a new admin user via the command line:

```bash
# Syntax: npm run create-user -- <email> <password> <Firstname> <Lastname>
npm run create-user -- admin@example.com mySecretPassword Admin User
```

## 📁 Project Structure
```

Open: http://localhost:3000

## 🔑 User & Admin Management

### Default Admin User
The setup script offers to create a **Demo User**. This user is assigned the **Admin** role automatically.

- **Email:** `demo@example.com`
- **Password:** `demo123`
- **Role:** Admin

### Creating Additional Users
- **Registration:** New users can register via the login page (if enabled).
- **CLI Creation:** You can use the demo user script as a template to create more admin users via command line:
  ```bash
  npm run create-demo-user
  ```
  *(Note: You can modify `scripts/create-demo-user.ts` to create different users)*

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
