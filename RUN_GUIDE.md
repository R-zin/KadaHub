# KadaHub E-Commerce Management System — Complete Run & Deployment Guide

Welcome to the **KadaHub E-Commerce Management System** run guide. This document provides step-by-step instructions for running the application in local development, building for production, running tests, configuring databases and payment gateways, and deploying to cloud infrastructure.

---

## 1. Prerequisites

Before setting up KadaHub, ensure your development environment satisfies the following minimum prerequisites:

- **Node.js**: `v18.0.0` or higher (Node 20+ Recommended, LTS).
- **npm**: `v9.0.0` or higher (bundled with Node.js).
- **PostgreSQL**: PostgreSQL 14+ local instance or a managed **Supabase** PostgreSQL database.
- **Git**: Installed and configured.
- **Modern Web Browser**: Google Chrome, Mozilla Firefox, Microsoft Edge, or Safari with WebRTC/Camera support enabled for Virtual Try-On camera features.

---

## 2. Repository Structure

```
KadaHub/
├── dist/                     # Compiled frontend production bundle (generated on build)
├── node_modules/             # Frontend dependencies
├── public/                   # Static assets (favicons, icons)
├── server/                   # Node.js / Express Backend
│   ├── src/
│   │   ├── db/               # PostgreSQL connection pool, schema, migrations, seed script
│   │   ├── middleware/       # Auth (JWT & RBAC), error handler, rate limit, validation
│   │   ├── routes/           # REST API routes (auth, products, orders, tryon, admin, etc.)
│   │   ├── services/         # Domain services, storage, payments, try-on logic
│   │   ├── utils/            # Custom ApiError and helpers
│   │   ├── app.js            # Express application configuration & middleware stack
│   │   ├── config.js         # Centralized environment variable loader
│   │   └── index.js          # HTTP server bootstrap
│   ├── tests/                # Automated regression test suites (Node.js native test runner)
│   ├── uploads/              # Local storage directories (products, tryon-temp)
│   ├── .env.example          # Server environment variable template
│   └── package.json          # Backend dependencies and scripts
├── src/                      # React / Vite Frontend
│   ├── components/           # UI components (Cart, Navbar, CameraCapture, Modal, etc.)
│   ├── context/              # AppState, AuthContext, NotificationContext
│   ├── hooks/                # Custom React hooks
│   ├── layouts/              # AppLayout, DashboardLayout
│   ├── pages/                # Customer, Seller, Delivery Agent, and Admin views
│   ├── services/             # Axios/fetch API client adapters
│   ├── types/                # TypeScript interface definitions
│   ├── App.tsx               # Route declarations and root layout
│   └── main.tsx              # React DOM entry point
├── .env.example              # Frontend environment variable template
├── package.json              # Frontend dependencies and build scripts
├── tailwind.config.js        # Tailwind CSS configuration
├── tsconfig.json             # TypeScript compiler configuration
├── vercel.json               # Vercel deployment routing configuration
├── RUN_GUIDE.md              # Complete run and deployment guide (this document)
├── TEST_REPORT.md            # Comprehensive test execution and verification report
└── ROLE_ACCESS_GUIDE.md      # Matrix of allowed and forbidden actions per role
```

---

## 3. Installation

### 3.1 Clone the Repository
```bash
git clone https://github.com/R-zin/KadaHub.git
cd KadaHub
```

### 3.2 Install Frontend Dependencies
```bash
npm install
```

### 3.3 Install Backend Dependencies
```bash
cd server
npm install
cd ..
```

---

## 4. Environment Variables

### 4.1 Backend Environment Configuration (`server/.env`)
Copy the template in `server/.env.example` to `server/.env`:
```bash
cp server/.env.example server/.env
```

Edit `server/.env` with your actual credentials:
```env
# Application Server
PORT=4000
NODE_ENV=development

# Database Connection (PostgreSQL or Supabase)
DATABASE_URL=postgresql://postgres:yourpassword@db.xyz.supabase.co:5432/postgres
DB_SSL=true

# Authentication & Security
JWT_SECRET=super_secret_jwt_key_at_least_32_characters_long
JWT_EXPIRES_IN=1h
BCRYPT_ROUNDS=10

# CORS Allowed Origins (Comma-separated)
CLIENT_ORIGIN=http://127.0.0.1:5173,http://localhost:5173,https://your-frontend.vercel.app

# Storage Configuration ('local' or 'supabase')
STORAGE_DRIVER=local
UPLOAD_DIR=uploads
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_STORAGE_BUCKET=product-images

# Payment Gateway (Razorpay Test Mode)
PAYMENT_DRIVER=razorpay
RAZORPAY_KEY_ID=rzp_test_Tccqo7kitF3lOx
RAZORPAY_KEY_SECRET=FtPum9Hi3WItzCoLw88VfB8R
PAYMENT_CURRENCY=inr

# Try-On Driver ('mock')
TRYON_DRIVER=mock
```

> [!CAUTION]
> Never commit `server/.env` or `.env` to Git. Ensure `.env` is listed in `.gitignore`.

### 4.2 Frontend Environment Configuration (`.env`)
Copy `.env.example` to `.env` in the root workspace directory:
```bash
cp .env.example .env
```

Edit `.env`:
```env
# API Base URL
VITE_API_URL=http://127.0.0.1:4000/api

# Razorpay Test Key (Public Key ONLY — Safe for Frontend)
VITE_RAZORPAY_KEY_ID=rzp_test_Tccqo7kitF3lOx
```

---

## 5. Database Setup & Seeding

### 5.1 Run Schema Migrations
Execute the database schema setup to create all 15 required tables, foreign keys, indexes, and trigger functions:
```bash
cd server
node src/db/migrate.js
```

### 5.2 Seed Sample Data
Populate the database with demo accounts, categories, 114 product items, images, and sample orders:
```bash
node src/db/seed.js
cd ..
```

---

## 6. Running the System in Development Mode

Run the backend and frontend in two separate terminal windows.

### Terminal 1: Backend API Server
```bash
cd server
npm run dev
```
The backend API server will start at: `http://127.0.0.1:4000` (Healthcheck: `http://127.0.0.1:4000/api/health`).

### Terminal 2: Frontend Vite Development Server
```bash
npm run dev
```
The frontend will start at: `http://127.0.0.1:5173`.

---

## 7. Production Build & Preview

### 7.1 Build Frontend for Production
```bash
npm run build
```
This runs TypeScript checking (`tsc -b`) and Vite production bundle generation (`vite build`). Compiled assets are output into `/dist`.

### 7.2 Run Production Preview Locally
```bash
npm run preview
```
Runs a local web server hosting the production bundle at `http://127.0.0.1:5173`.

---

## 8. Running Automated Test Suites

KadaHub uses Node.js's native test runner (`node:test`) for zero-dependency, fast, reproducible tests.

### 8.1 Run All Backend Tests
```bash
cd server
npm test
```
*(Runs `node --test --test-concurrency=1`)*

### 8.2 Run Specific Test Suites
```bash
# E2E Complete Business Flow Regression
node --test tests/phase8_e2e_regression.test.js

# Camera Try-On Hardware Integration
node --test tests/phase6_camera_tryon.test.js

# Image Security, Access Control & Temporary Cleanup
node --test tests/phase7_image_security.test.js

# Razorpay Test Mode & HMAC Signatures
node --test tests/razorpay.test.js

# Role Access Control & Security Vectors
node --test tests/security_vectors.test.js
```

---

## 9. Cloud Deployment

### 9.1 Frontend Deployment on Vercel
KadaHub includes a pre-configured `vercel.json` for single-page application routing rewrites.
1. Connect your GitHub repository to Vercel.
2. Configure project settings:
   - **Framework Preset**: Vite
   - **Root Directory**: `./`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Set Environment Variables in Vercel Dashboard:
   - `VITE_API_URL`: `https://your-backend-api.onrender.com/api`
   - `VITE_RAZORPAY_KEY_ID`: `rzp_test_Tccqo7kitF3lOx`
4. Click **Deploy**.

### 9.2 Backend Deployment (Render, Railway, Fly.io, or Heroku)
1. In your backend host dashboard, configure:
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
2. Add Environment Variables:
   - Copy all values from `server/.env` (Database URL, JWT Secret, Razorpay keys, Client origins).
   - Add your Vercel frontend URL to `CLIENT_ORIGIN`.
3. Deploy. Verify health at `https://your-backend-api.com/api/health`.

---

## 10. Supabase & Razorpay Configuration

### 10.1 Supabase Configuration
- Enable Connection Pooling (`port 6543` or `port 5432`) in Supabase Database settings.
- If using Supabase Storage for product images, set `STORAGE_DRIVER=supabase` in `server/.env` and create a public bucket named `product-images`.

### 10.2 Razorpay Test Mode Configuration
1. Log in to your Razorpay Dashboard at [https://dashboard.razorpay.com](https://dashboard.razorpay.com).
2. Switch to **Test Mode** (toggle in upper banner).
3. Navigate to **Account & Settings** -> **API Keys**.
4. Generate Test Key Pair (`rzp_test_...` and secret).
5. Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in `server/.env`.
6. Set `VITE_RAZORPAY_KEY_ID` in root `.env`.
7. Use Razorpay test cards during checkout (e.g. Card number: `4111 1111 1111 1111`, any future expiry date, CVV: `123`, OTP: `123456`).

---

## 11. Demo Accounts

All demo accounts share the standard password: `password123`.

| Role | Email | Password | Primary Purpose |
| :--- | :--- | :--- | :--- |
| **Customer** | `customer@kadahub.com` | `password123` | Browsing, Cart, Checkout, Try-On, Tracking, Returns |
| **Seller** | `seller@kadahub.com` | `password123` | Product Creation, Inventory Management, Storefront |
| **Delivery Agent** | `delivery@kadahub.com` | `password123` | Delivery Assignments, Status Progression |
| **Admin** | `admin@kadahub.com` | `password123` | Return Approvals, Refunds, User Management, Analytics |

---

## 12. Troubleshooting

### Q1: Database connection fails (`ECONNREFUSED` or SSL error)
- **Fix**: Check that PostgreSQL is running. If using Supabase, ensure `DB_SSL=true` is present in `server/.env` and your IP address is not blocked by firewalls.

### Q2: Razorpay checkout modal does not open
- **Fix**: Verify that the browser loaded `https://checkout.razorpay.com/v1/checkout.js`. If you have strict ad-blockers, allow Razorpay scripts. Check that `VITE_RAZORPAY_KEY_ID` is set in root `.env`.

### Q3: Camera capture modal displays "Camera Access Denied"
- **Fix**: The browser camera API (`getUserMedia`) requires either a secure context (`https://`) or `http://localhost` / `http://127.0.0.1`. In browser address bar, click the camera icon to grant camera permissions to the site.

### Q4: CORS Error when frontend calls backend
- **Fix**: Ensure your frontend URL is included in `CLIENT_ORIGIN` in `server/.env`.
