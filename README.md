# Apna Course Player (Local Path Player)

A high-performance, self-hosted offline video course player modeled after **Apna College's path player**. Built with Fastify, React 19, Vite, TypeScript, Tailwind CSS, and MongoDB via Mongoose.

Designed specifically for students learning **Data Structures & Algorithms (DSA)** and **Full Stack Web Development**, providing seamless HTTP 206 range streaming directly from Google Drive for Desktop or local directories.

---

## 🤖 Autonomous AI Agent Quick-Start Guide

> [!IMPORTANT]
> **Instructions for AI Coding Assistants (Antigravity, Cursor, Claude Code, GitHub Copilot, Devin):**
> If a user provides you with this repository, follow the autonomous setup sequence below. Once the server is running, provide the user with a direct clickable link to **http://localhost:4000**.

### Autonomous Setup Sequence

1. **Verify Environment**:
   - Ensure Node.js v18+ is installed (`node -v`).
   - The application connects to local MongoDB at `mongodb://127.0.0.1:27017/course_player` by default. If local MongoDB is not running, it automatically fails over to the embedded MongoDB Atlas cloud cluster. No manual database setup is required.

2. **Install Dependencies**:
   Run the root installer or install in each package:
   ```bash
   npm run install:all
   ```
   *(Or individually: `npm install`, `cd server && npm install`, `cd web && npm install`)*

3. **Build the Application**:
   Compile both the React frontend and Fastify backend:
   ```bash
   npm run build
   ```

4. **Start the Production Server**:
   Launch the server daemon on port 4000:
   ```bash
   npm start
   ```
   *(Or run `cd server && node dist/index.js`)*

5. **User Handoff**:
   Notify the user that the course player is live and present the clickable link:
   👉 **[Click here to open Apna Course Player (http://localhost:4000)](http://localhost:4000)**

---

## ⚡ Quick Start for Humans (One-Click)

On Windows, simply double-click **`start.bat`** or run in your terminal:

```cmd
start.bat
```

`start.bat` will automatically verify Node.js, install any missing dependencies, build the frontend and backend, launch the server at `http://localhost:4000`, and open the player in your default browser.

For manual development or production control:

```bash
# Development mode (concurrent Fastify backend + Vite HMR)
npm run dev

# Production build and run
npm run build
npm start
```

---

## 📂 Preconfigured Hardcoded Profiles & Google Drive Links

The system automatically initializes and seeds two primary course profiles on first launch:

| Course Profile | Default Local Drive Path | Google Drive Folder Link |
|---|---|---|
| **DSA** | `G:\My Drive\Apna College DSA` | [DSA Course Folder](https://drive.google.com/drive/folders/1rcy3AgCQAX-x8amkpjP1AifrhOhC0eO3?usp=drive_link) |
| **Development** | `G:\My Drive\Apna College Development` | [Development Course Folder](https://drive.google.com/drive/folders/1ibiPith7qMfWpeS3Vzh6YX747hBga8bs?usp=sharing) |

### Non-Invasive Google Drive for Desktop Sync

1. **Direct Google Drive Links or Local Paths**:
   - You can enter a local directory path (`G:\My Drive\Apna College Development`) **OR** paste the direct browser Google Drive folder URL (`https://drive.google.com/drive/folders/...`).
   - The server resolves the folder ID and maps it to your local Google Drive for Desktop mount (`G:\My Drive\...`).
2. **Zero-Byte Library Scans**:
   - Scanning only inspects directory metadata (`readdir` and `stat`). It never downloads video bodies over the internet.
3. **Instant Seeking Tip**:
   - For latency-free scrubbing and instant seeking, right-click your course folder in Windows File Explorer and select:
     **Google Drive → Offline access → Available offline**.

---

## 🗄️ Database Configuration & Resilience

The application connects to MongoDB using a resilient, local-first fallback architecture:

1. **Local MongoDB by Default**:
   - Defaults to `mongodb://127.0.0.1:27017/course_player`.
   - All watched statuses, timestamps, notes, and activity logs are saved locally.
2. **Automatic Cloud Atlas Fallback**:
   - If local MongoDB is not installed or not running, the server detects the connection error and automatically switches to the cloud MongoDB Atlas cluster within 2 seconds.
3. **Custom Configuration**:
   - Configure port, host, and database in `server/.env`:
     ```env
     PORT=4000
     HOST=127.0.0.1
     MONGO_URI=mongodb://127.0.0.1:27017/course_player
     ```

---

## 🌟 Key Features

### 1. Custom High-Performance Video Player
- **Zero-Letterbox Hallmark UI**: Full-bleed responsive player canvas with zero unnecessary scrollbars or empty margins.
- **Dual-Layer Timestamp Persistence**:
  - Live timestamps are cached in `localStorage` on every video `timeupdate` tick.
  - Automatically synced to MongoDB on pause, seek, heartbeat (every 5s), and window unload (`navigator.sendBeacon`).
  - Refreshing or reopening the browser restores playback to the exact second.
- **Precision Seeking**:
  - `←` / `→` arrow keys seek backward/forward 5 seconds.
  - `J` / `L` or dedicated skip buttons seek backward/forward 10 seconds.
  - Double-clicking the left or right half of the video seeks 10 seconds.
- **Playback Speed Selector**: Extended speeds (`0.5x`, `0.75x`, `1.0x`, `1.25x`, `1.5x`, `1.75x`, `2.0x`, `2.5x`, `3.0x`).
- **Autoplay Next Lesson**: 5-second countdown modal with smooth transition across section boundaries.
- **Auto-Complete**: Automatically marks a lesson as completed when passing 95% total duration.

### 2. Dual Course Profiles & Tree Navigation
- **Instant Profile Switching**: One-click toggle between **DSA** and **Development** in the top navigation bar.
- **Collapsible Sidebar**: Sidebar remembers expanded/collapsed state across browser refreshes.
- **Section Accordions**: Automatically opens and scrolls the active lesson and section into view.
- **Instant Search**: Filter lessons and sections in real-time by keyword or lesson number.

### 3. Bulk Progress Management (Settings Page)
- **Mark Specific Section**: Select any course section to mark all of its lessons as watched in one click.
- **Mark Watched Up To Lesson**: Pick a lesson to fast-forward watch progress for all preceding lessons.
- **Mark All Watched (100%)**: Mark the entire course completed.
- **Reset All Progress**: Reset completion state and watch times for the active profile.
- **Export / Import Backup**: Export and restore your complete progress, timestamps, notes, and bookmarks as a single JSON file.

### 4. Learning Analytics & Phase 2 Tools
- **12-Week Study Heatmap**: Visual GitHub-style activity grid showing daily study consistency over 84 days.
- **Study Metrics**: Live statistics for watch time today, past 7 days, daily streaks, and completion percentages.
- **Timestamped Notes (`N`)**: Create study notes anchored to the exact video second. Clicking a note jumps directly to that timestamp.
- **Timestamped Bookmarks (`B`)**: Save important reference points for quick revision.
- **Subtitle Support**: Adjacent `.srt` files are automatically converted to WebVTT subtitles on the fly.

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|---|---|
| `Space` / `K` | Toggle Play / Pause |
| `←` / `→` | Seek backward / forward 5 seconds |
| `J` / `L` | Seek backward / forward 10 seconds |
| `↑` / `↓` | Volume Up / Down (5% increments) |
| `M` | Mute / Unmute audio |
| `F` | Toggle Fullscreen mode |
| `T` | Toggle Theatre mode |
| `Shift + N` | Skip to next lesson |
| `Shift + P` | Jump to previous lesson |
| `N` | Open Notes drawer at current video timestamp |
| `B` | Add Bookmark at current video timestamp |
| `?` | Show Keyboard Shortcuts cheatsheet |

---

## 🛠️ Project Structure

```
Apna College Player/
├── server/
│   ├── src/
│   │   ├── config/          # db.ts (Local MongoDB + Atlas fallback), env.ts
│   │   ├── models/          # Profile, Section, Video, Progress, ActivityLog, Note, Bookmark
│   │   ├── routes/          # profiles.routes.ts, videos.routes.ts, learning.routes.ts
│   │   ├── services/        # scanner.service.ts, gdrive.service.ts, seed.service.ts
│   │   └── app.ts           # Fastify application and static client serving
│   ├── package.json
│   └── tsconfig.json
├── web/
│   ├── src/
│   │   ├── components/      # CustomVideoPlayer, PlayerSidebar, Navbar, SettingsModal, etc.
│   │   ├── stores/          # usePlayerStore, useProfileStore, useUIStore, useNotesStore
│   │   └── styles/          # Tailwind CSS and Hallmark design tokens
│   ├── package.json
│   └── vite.config.ts
├── start.bat                # Windows 1-click launcher
├── package.json             # Root workspace script runner
└── README.md                # Autonomous setup & project guide
```

---

## 🔧 Troubleshooting

- **Google Drive video buffering slowly**:
  Right-click the course folder in Windows Explorer and choose **Google Drive → Offline access → Available offline**. This keeps the files cached on your local disk for instant seek operations.
- **Local MongoDB not detected**:
  Ensure the MongoDB service is running (`net start MongoDB` or via Windows Services). If MongoDB is not running, the player will automatically connect to MongoDB Atlas without interruption.
- **Port 4000 already in use**:
  Set a custom port in `server/.env` (e.g. `PORT=5000`) and restart the server.
