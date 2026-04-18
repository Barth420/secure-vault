# SecureVault — Self-Hosted Zero-Knowledge Cloud Storage

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Stack](https://img.shields.io/badge/Stack-React%20%7C%20Node.js%20%7C%20PostgreSQL-blue)]()
[![Encryption](https://img.shields.io/badge/Encryption-AES--256--GCM-green)]()
[![Docker](https://img.shields.io/badge/Deployed%20with-Docker-blue)]()

> A production-grade, self-hosted cloud storage system with **zero-knowledge client-side encryption**. Your files are encrypted in the browser before they ever leave your device. The server stores only opaque encrypted blobs — it cannot read your data even if fully compromised.

---

##  Features

| Feature | Details |
|---------|---------|
|  **AES-256-GCM Encryption** | Industry-standard authenticated encryption per file |
|  **Zero-Knowledge Architecture** | Master key derived client-side via PBKDF2, never transmitted |
|  **Drag-and-Drop Upload** | Files are encrypted in the browser before being sent |
|  **Secure File Sharing** | Expiring links, optional passwords, max download limits |
|  **Delta Sync Engine** | Hash-based change detection to minimize bandwidth |
|  **File Versioning** | Keep and restore any previous version of a file |
|  **Activity Audit Log** | Full trail of every upload, download, share, and login |
|  **Remote Access** | Cloudflare Tunnel integration for global access without port forwarding |
|  **Mobile Friendly** | Works from any browser — phone, tablet, or desktop |
|  **One-Command Deploy** | Full Docker Compose stack — runs anywhere |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                     BROWSER                         │
│  ┌──────────────┐     ┌──────────────────────────┐  │
│  │  React + UI  │────▶│  Web Crypto API (AES-GCM)│  │
│  └──────────────┘     └──────────────────────────┘  │
│         │                        │                   │
│    Axios Calls            Encrypted Blob             │
└─────────┼──────────────────────┼─────────────────────┘
          │ HTTPS                │
┌─────────▼──────────────────────▼─────────────────────┐
│               NGINX (port 80 / 443)                   │
│       /api → Express backend   / → React frontend     │
└─────────┬──────────────────────────────────────────────┘
          │
┌─────────▼────────────────┐    ┌───────────────────────┐
│  Node.js + Express        │    │     PostgreSQL         │
│  ─ JWT Auth (Argon2id)    │───▶│  users, files,        │
│  ─ File Service (Multer)  │    │  shares, versions,    │
│  ─ Share Service          │    │  activity_logs        │
│  ─ Sync Engine            │    └───────────────────────┘
└──────────┬───────────────┘
           │
┌──────────▼───────────────┐
│  /storage (encrypted blobs)│  ← Server NEVER decrypts
└──────────────────────────┘
```

---

## Encryption Flow

```
REGISTRATION
  password ──PBKDF2(310,000 iter, SHA-256)──▶ masterKey (stays in memory only)
  server stores: { email, argon2id(password), salt }

UPLOAD
  1. generateKey()           → fileKey  (random AES-256 per file)
  2. encrypt(file, fileKey)  → ciphertext + IV
  3. encrypt(fileKey, masterKey) → encryptedKey + keyIv
  4. POST { ciphertext, IV, encryptedKey, keyIv }  ← server sees no plaintext

DOWNLOAD
  1. GET encrypted blob + { IV, encryptedKey, keyIv }
  2. decrypt(encryptedKey, masterKey) → fileKey
  3. decrypt(ciphertext, fileKey, IV) → plaintext
  4. Browser saves the original file

SHARING (Zero-Knowledge)
  1. You enter a share password
  2. shareKey derived from share password via PBKDF2
  3. fileKey re-encrypted with shareKey → shareKey blob stored on server
  4. Recipient uses only the share password — no master key needed
```

**Key security properties:**
- Master key **never leaves the browser** and is **never persisted**
- Per-file keys — compromising one file never exposes others
- GCM authentication tag detects any server-side tampering
- Password reset is **impossible by design** — no key escrow

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + Tailwind CSS |
| Encryption | Web Crypto API (AES-256-GCM, PBKDF2) |
| HTTP Client | Axios with JWT interceptor + auto-refresh |
| Backend | Node.js + Express |
| Auth | Argon2id password hashing + JWT (15min access / 7d refresh) |
| Database | PostgreSQL via Prisma ORM |
| File Handling | Multer (memory storage) |
| Containers | Docker + Docker Compose |
| Reverse Proxy | NGINX |
| Global Access | Cloudflare Tunnel (optional) |

---

## Quick Start (Docker)

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- That's it.

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/secure-vault.git
cd secure-vault

# 2. Set up environment
cp .env.example .env
# Open .env and fill in:
#   POSTGRES_PASSWORD  — any strong password
#   JWT_ACCESS_SECRET  — 64-byte random hex (generate below)
#   JWT_REFRESH_SECRET — different 64-byte random hex

# Generate secrets (run twice, use each output for one variable):
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# 3. Start everything
docker compose up -d --build

# 4. Open your browser
# http://localhost
```

### First Run
1. Open `http://localhost`
2. Click **Create Vault** — register an account
3.  **Remember your password** — it cannot be recovered by design
4. Start uploading files

---

## Windows One-Click Startup

If you're self-hosting on Windows, use the included batch files:

| File | Action |
|------|--------|
| `start-vault.bat` | Starts Docker, containers, phone access proxy, and Cloudflare tunnel |
| `stop-vault.bat` | Gracefully stops all containers and removes port proxy |

> **Right-click → Run as Administrator** (required for port proxy setup)

For Cloudflare Tunnel (global access from anywhere):
1. Download [cloudflared.exe](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/) into the project folder
2. `start-vault.bat` will launch the tunnel automatically and print your public URL

---

## Local Development (Without Docker)

### Prerequisites
- Node.js 18+
- PostgreSQL 15+

```bash
# Backend
cd server
cp .env.example .env   # fill in local DB credentials
npm install
npx prisma db push
node src/app.js        # starts on port 4000

# Frontend (separate terminal)
cd client
npm install
npm run dev            # starts on port 5173
```

---

## API Reference

### Auth
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | — | Register + get JWT + salt |
| POST | `/api/auth/login` | — | Login + get JWT + salt |
| POST | `/api/auth/refresh` | — | Refresh access token |
| GET  | `/api/auth/me` | ✓ | Get current user |

### Files
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/files/upload` | ✓ | Upload encrypted blob |
| GET  | `/api/files/download/:id` | ✓ | Download encrypted blob |
| GET  | `/api/files/list` | ✓ | List all files |
| DELETE | `/api/files/:id` | ✓ | Soft delete file |
| GET  | `/api/files/:id/versions` | ✓ | Get version history |
| POST | `/api/files/:id/versions/:vId/restore` | ✓ | Restore version |

### Sharing
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/share/create` | ✓ | Create share link |
| POST | `/api/share/:token/access` | — | Access share (public) |
| GET  | `/api/share/:token/download` | — | Download via share token |
| DELETE | `/api/share/:token` | ✓ | Revoke share link |

### Sync
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/sync/delta` | ✓ | Get changes since timestamp |
| GET  | `/api/sync/status` | ✓ | Server sync summary |
| GET  | `/api/sync/activity` | ✓ | Paginated activity log |

---

## Database Schema

```
users          → id, email, passwordHash (argon2id), salt (PBKDF2)
files          → id, userId, filename, storagePath, size, hash, iv, encryptedKey, keyIv, version
file_versions  → id, fileId, storagePath, hash, iv, encryptedKey, keyIv, version
shares         → id, fileId, token, expiresAt, passwordHash, shareKey, shareKeyIv, shareSalt, accessCount
activity_logs  → id, userId, fileId, action, details, ip, createdAt
```

---

## Security Design

| Concern | Approach |
|---------|---------|
| Password storage | Argon2id (memory-hard, GPU-resistant) |
| Key derivation | PBKDF2-SHA256 (310,000 iterations — NIST 2023 minimum) |
| File encryption | AES-256-GCM (authenticated — detects tampering) |
| Session tokens | JWT HS256 — 15min access, 7d refresh |
| Rate limiting | 300 req/15min global; 20 req/15min on auth routes |
| HTTP headers | Helmet.js (HSTS, CSP, XSS protection, etc.) |
| Key escrow | None — password recovery is impossible by design |

---

## License

MIT — see [LICENSE](LICENSE)
