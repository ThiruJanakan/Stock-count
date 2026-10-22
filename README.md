# Lina Manufacturing · Enterprise Stock Verification System

[![Production Status](https://img.shields.io/badge/Status-Production%20Active-emerald)](https://stock-count-gamma.vercel.app/)
[![Node.js Engine](https://img.shields.io/badge/Node.js-18%2B%20%7C%2020%2B-blue)](https://nodejs.org)
[![Database](https://img.shields.io/badge/Database-Supabase%20Cloud%20%2B%20SQLite%20Hybrid-teal)](https://supabase.com)
[![Android](https://img.shields.io/badge/Android-SDK%2035%20%7C%20Kotlin-brightgreen)](https://developer.android.com)
[![Security Hardened](https://img.shields.io/badge/Security-PBKDF2%20%7C%20RBAC%20%7C%20Audit%20Ledger-indigo)](docs/LINA_STOCK_COUNT_SYSTEM_SDP_REPORT.md)

An enterprise-grade, dual-mode stock verification platform designed for Lina Manufacturing. The system enables real-time warehouse inventory reconciliation, high-speed barcode scanning, blind-count enforcement, automated audit ledgers, and seamless offline-to-cloud synchronization.

🌐 **Live Production Cloud**: [https://stock-count-gamma.vercel.app/](https://stock-count-gamma.vercel.app/)

---

## Architecture Overview

```
                                      ┌─────────────────────────────────────┐
                                      │    Production Cloud (Vercel)        │
                                      │   - Serverless API (/api/index.js)  │
                                      │   - Web PWA Static Distribution     │
                                      └──────────────────┬──────────────────┘
                                                         │
                        ┌────────────────────────────────┼────────────────────────────────┐
                        ▼                                ▼                                ▼
         ┌─────────────────────────────┐  ┌─────────────────────────────┐  ┌─────────────────────────────┐
         │     Modern Web / PWA        │  │   Android Native App        │  │   Local Standalone Server   │
         │  - Offline Service Worker   │  │  - Encrypted SQLite Storage │  │  - Authoritative Engine     │
         │  - Real-time Barcode Scan   │  │  - Android Keystore AES-GCM │  │  - dev-server.js (:5173)    │
         │  - Smart Sheet Import/Export│  │  - Zero Network Required    │  │  - Hybrid Failover Syncer   │
         └──────────────┬──────────────┘  └──────────────┬──────────────┘  └──────────────┬──────────────┘
                        │                                │                                │
                        └────────────────────────────────┼────────────────────────────────┘
                                                         │
                                                         ▼
                                      ┌─────────────────────────────────────┐
                                      │       Authoritative Database        │
                                      │  - Supabase Cloud (PostgreSQL)      │
                                      │  - Local ACID SQLite Engine         │
                                      │  - Cryptographic Audit Trail        │
                                      └─────────────────────────────────────┘
```

---

## Core Capabilities

- **High-Speed Warehouse Physical Counting**: Instant barcode lookup, SKU matching, location grouping, and real-time quantity validation.
- **Server-Side Blind Count Enforcement**: Prevents count bias by strictly omitting system stock quantities and variances for operational `COUNTER` accounts.
- **Authoritative Security & RBAC**:
  - Cryptographic **PBKDF2-HMAC-SHA256** password hashing with cryptographically secure per-user salts.
  - Multi-tier role permissions: `COUNTER`, `SUPERVISOR`, `ADMIN`, and `EXECUTIVE`.
  - Insecure Direct Object Reference (**IDOR**) ownership validation on all sessions and counts.
  - Multi-tier sliding-window rate limiters protecting authentication endpoints from brute-force attacks.
- **Tamper-Evident Audit Ledger**: SHA-256 cryptographic hash-chained audit entries tracking all session modifications, inventory edits, and administrative actions.
- **Offline First & Multi-Platform**:
  - Full **Progressive Web App (PWA)** with cache-first Service Worker fallback.
  - Native **Android APK** with hardware-backed Keystore encryption.
  - Excel (`.xlsx`), CSV, and encrypted JSON export/import workflows.

---

## Repository Structure

```
.
├── api/                  # Production Vercel Serverless Function entry points & security layers
├── app/                  # Android Native Studio Project (Kotlin, Jetpack, Android Keystore)
├── assets/               # Brand logos and graphic resources
├── database/             # Relational SQL schemas (SQLite & PostgreSQL / Supabase)
├── docs/                 # Engineering reports, UML diagrams, and FR/NFR specifications
│   ├── architecture_diagrams.html       # Interactive Mermaid UML architecture dashboard
│   ├── LINA_FR_NFR_SPECIFICATION.xlsx  # Formal Functional & Non-Functional Specifications
│   ├── LINA_STOCK_COUNT_SYSTEM_SDP_REPORT.md # Full Software Development Project (SDP) report
│   └── usecase_diagram.png             # Visual Use-Case Workflow Diagram
├── lib/                  # Authoritative security, cryptographic, and validation libraries
├── public/               # Static assets served at production root (Vercel & static distribution)
├── scripts/              # Build, synchronization, and specification generator utilities
├── test/                 # Automated test suites (Security, RBAC, API, and Route coverage)
├── dev-server.js         # Production-ready authoritative Node.js HTTP/API server
├── index.html            # Single-Page Application (SPA) responsive frontend interface
├── lina-stock-count.apk  # Standalone installable Android APK package
├── package.json          # Node.js project manifest and test runner configuration
├── vercel.json           # Cloud deployment, header security, and routing configuration
└── README.md             # Project documentation
```

---

## Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **Android Studio** *(optional, for native Android development)*: Android SDK 35, JDK 17

### 1. Web & Backend Server Setup

```bash
# Clone the repository
git clone https://github.com/ThiruJanakan/Stock-count.git
cd Stock-count

# Start the local development & authoritative API server
npm run dev
```

The application will be accessible at:
- **Local Application UI**: [http://localhost:5173/](http://localhost:5173/)
- **Health Verification API**: [http://localhost:5173/api/health](http://localhost:5173/api/health)
- **Authoritative Stock API**: [http://localhost:5173/api/stock/db](http://localhost:5173/api/stock/db)

### 2. Environment Configuration (Optional)

Create a `.env` file in the project root to connect to Supabase Cloud or customize secrets:

```env
PORT=5173
HOST=0.0.0.0
SESSION_SECRET=your-random-high-entropy-session-secret-at-least-32-chars
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

*Note: If no Supabase environment variables are provided, the system seamlessly operates on its high-performance local SQLite database engine.*

---

## Automated Testing & Quality Assurance

The project includes 41 comprehensive automated tests covering security controls, IDOR defenses, SQL injection prevention, rate limiting, and route integrity:

```bash
# Execute the full automated test suite
npm test

# Verify all HTTP endpoints and client-side view switches
node test/test_all_routes.js
```

---

## Android Native Application

The `app/` folder contains a standalone native Android application that bundles the stock count interface inside an isolated, high-performance WebView backed by encrypted SQLite.

### Android Build & Run:
1. Open the repository root in **Android Studio**.
2. In `local.properties`, configure the shared offline credentials:
   ```properties
   lina.auth.username=your-shared-username
   lina.auth.password=use-a-private-password-of-at-least-12-characters
   ```
3. Sync Gradle and build the APK:
   - Navigate to **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
   - The compiled installable package is output to `app/build/outputs/apk/debug/app-debug.apk`.
   - Transfer to any Android 10+ device to install.

### Native Security Protections:
- SQLite rows are encrypted with **AES-256-GCM** using keys managed directly by **Android Keystore**.
- Non-bundled network navigation and external WebView file access are disabled (`mixedContentMode = NEVER_ALLOW`).
- Encrypted session backups utilize **PBKDF2-HMAC-SHA-256** with 310,000 key derivation iterations.

---

## Documentation & Engineering References

Detailed engineering specifications and architecture models are available in the [`docs/`](docs/) directory:

- [**Full SDP Engineering Report**](docs/LINA_STOCK_COUNT_SYSTEM_SDP_REPORT.md)
- [**Interactive Architecture & UML Diagrams**](docs/architecture_diagrams.html)
- [**Production Hosting & Hardening Guide**](HOSTING_GUIDE.md)
- [**Functional & Non-Functional Specifications (Excel)**](docs/LINA_FR_NFR_SPECIFICATION.xlsx)

---

## License & Credits

Developed for **Lina Manufacturing**. All rights reserved.
