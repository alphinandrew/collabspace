# CollabSpace

**Work together. Communicate better.**

CollabSpace is a production-quality centralized communication and collaboration platform designed for teams and groups. It provides real-time group chat, voice & video calling via WebRTC, persistent file sharing with a searchable library, multi-group workspace switching, and instant onboarding via human-friendly codes and cryptographically secure QR invitations.

---

## 🌟 Key Features

1. **Elegant First-Launch Experience**: Clean welcome onboarding with brand identity, tagline, and direct entry points to join or create workspaces.
2. **Flexible Group Onboarding**:
   - **Group Code**: Unique human-friendly identifiers (e.g., `CLB-4729`) with server-side validation.
   - **QR Invitations**: High-entropy cryptographic tokens supporting expiration, usage limits, and camera scanning with graceful fallback.
3. **Workspace Switcher**: Persistent sidebar rail for managing and toggling between multiple group workspaces without losing context.
4. **Real-time Group Chat**: Low-latency Socket.IO messaging with persistent SQLite storage, date dividers, typing indicators, auto-scroll with history lock, and delivery state tracking.
5. **Persistent File Sharing & Library**:
   - Real multipart file uploads with live percentage tracking (`Uploading... 64%`).
   - Categorized library (Documents, PDFs, Presentations, Spreadsheets, Images, Videos, Other).
   - In-browser previews for PDFs, images, and text files.
   - Strict server-side authorization: unauthorized users receive `403 Forbidden` on download/preview endpoints.
   - Files remain permanently accessible even when other teammates are offline.
6. **WebRTC Voice & Video Calling**:
   - Peer-to-peer media streams with Socket.IO signaling.
   - Microphone mute/unmute, camera toggle, screen sharing, and call state machine (`connecting`, `ringing`, `connected`, `ended`, `failed`).
   - Pre-configured public STUN servers with TURN configuration support in `.env.example`.
7. **Workspace Members & Role Administration**: Role management (`Owner`, `Admin`, `Member`), online presence tracking, and administrative moderation.
8. **Server-Backed Global Search**: SQL-backed queries across messages, files, and members.

---

## 🏗️ Architecture & Technology Stack

- **Backend**: Node.js, Express, Socket.IO
- **Database & DAL**: SQLite with Write-Ahead Logging (`WAL` mode) using `sql.js`, designed behind a repository pattern so it can migrate to PostgreSQL without modifying business logic.
- **File Storage**: Abstracted `StorageService` interface with `LocalStorageDriver` storing files securely outside the public web root (ready to plug in S3/MinIO driver).
- **Frontend**: React 18, Vite, TypeScript, bespoke CSS token system, Lucide icons.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+) and npm installed.

### Installation

1. **Install Server Dependencies**:
   ```bash
   cd server
   npm install
   ```

2. **Install Client Dependencies**:
   ```bash
   cd ../client
   npm install
   ```

### Running the Application Locally

1. **Start the Backend Server**:
   ```bash
   cd server
   npm start
   ```
   *The backend starts on `http://localhost:4000` with WebSocket support.*

2. **Start the Frontend Dev Server**:
   ```bash
   cd client
   npm run dev
   ```
   *The client opens on `http://localhost:5173` with proxying configured to the backend.*

---

## 🧪 Verification & Automated Tests

To run the automated backend integration test suite:
```bash
cd server
npm run test:api
```
This suite verifies:
- User registration and JWT authentication
- Group creation with unique code generation
- Duplicate join prevention
- Message sending and SQLite database persistence
- Multipart file upload and storage key assignment
- Authenticated file download
- Server-side authorization check (blocking non-members with 403 Forbidden)
- Backend search queries

To run frontend TypeScript verification:
```bash
cd client
npm run typecheck
npm run build
```

---

## 🔐 Environment Variables (`server/.env.example`)

```text
PORT=4000
NODE_ENV=development
CLIENT_ORIGIN=http://localhost:5173

AUTH_SECRET=collabspace_super_secret_jwt_key_min32chars
TOKEN_EXPIRY=7d

STORAGE_DRIVER=local
STORAGE_LOCAL_DIR=./storage/uploads
MAX_FILE_SIZE_MB=50

DB_DRIVER=sqlite
DB_SQLITE_PATH=./data/collabspace.db

STUN_SERVER_URL=stun:stun.l.google.com:19302
# TURN_SERVER_URL=turn:turn.collabspace.io:3478
# TURN_USERNAME=collabspace_user
# TURN_CREDENTIAL=collabspace_secret
```
