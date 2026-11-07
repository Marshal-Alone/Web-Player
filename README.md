# Apna Course Player (Local Path Player)

A personal, self-hosted video course player modeled after **Apna College's path player**. Built with Fastify, React, Vite, TypeScript, Tailwind CSS, and MongoDB via Mongoose.

Features dual profiles (**DSA** and **Development**), non-invasive Google Drive for Desktop scanning, HTTP 206 Range video streaming, custom video controls, autoplay next across sections, robust resume tracking, and Phase 2 learning tools (timestamped notes, bookmarks, stats heatmap, and shortcuts).

---

## Quick Start (One Command)

Simply double-click `start.bat` or run:

```cmd
start.bat
```

This will automatically:
1. Verify Node.js.
2. Install any missing dependencies.
3. Build the frontend and backend.
4. Launch the server at `http://localhost:4000`.
5. Open `http://localhost:4000` in your default browser.

Alternatively, for manual control:

```bash
# In the root folder:
npm run dev      # Runs Fastify backend and Vite dev server concurrently
# OR
npm run build    # Builds both web and server
npm run start    # Starts the production server on port 4000
```

---

## Google Drive for Desktop Best Practices

Your course videos can live directly on Google Drive for Desktop (e.g. `G:\My Drive\Apna College Development`).

1. **Non-Invasive Scanning**:
   - The scanner **never** reads or downloads file contents during library scans. It only checks file names, sizes, and modified dates (`readdir` + `stat`).
   - Video durations are recorded lazily in the browser the first time each lesson is played.
2. **Smooth Seeking Tip**:
   - For instant seeking without network latency, right-click your course folder in File Explorer and choose:
     **Google Drive → Offline access → Available offline**.

---

## Core Features

### 1. Dual Profiles & Google Drive Link Support
- **DSA** and **Development** profiles are auto-seeded on first run.
- **Direct Google Drive Links or Local Paths**:
  - Enter your local path (`G:\My Drive\Apna College Development`) OR paste your browser's direct **Google Drive folder link** (`https://drive.google.com/drive/folders/...`)!
  - The system automatically discovers the folder name from Google Drive and maps it to your local Google Drive for Desktop files.
  - **Quick-Pick Chips**: Any course folders detected on your mounted `G:\My Drive` appear as 1-click auto-fill buttons in Settings!
- **Validate Button**: Non-invasively checks that the folder exists and displays "Found N sections, M videos".
- **Rescan Button**: Re-indexes the library and preserves watch progress even if files or folders are renamed (matched by `relPath` and `size + mtime`).
- **Bulk Progress Marking**:
  - **Mark All Watched**: Marks every video in the profile as 100% completed.
  - **Reset All Progress**: Resets watched progress for the entire profile.
  - **Mark Specific Section**: Select any section and mark all of its lessons completed with one click.
  - **Mark Watched Up To Lesson**: Pick a lesson from the dropdown and mark all preceding lessons up to that point as completed.

### 2. Player Page & Sidebar
- **Collapsible Sidebar (`«` / `»`)**: Remembers state in localStorage.
- **Section Accordions**: The active section auto-expands and scrolls into view.
- **Lesson Items**: Numeric badge (`672`), title, duration (`MM:SS`), per-video progress bar, and completion checkmark (`✓`).
- **Manual Toggle**: Click the circle/checkmark to mark a lesson completed or incomplete.

### 3. Custom Video Controls
- Native `<video>` engine with custom UI.
- **Seek Bar**: Scrub bar with buffered range indicator, played progress, and hover timestamp preview tooltip.
- **Speed Gear Popup**: Extended playback speeds: `0.5x`, `0.75x`, `1x`, `1.25x`, `1.5x`, `1.75x`, `2x`, `2.5x`, `3x`.
- **Skip Buttons**: Dedicated `±10s` buttons, plus double-clicking the left/right half of the video seeks `∓10s`. Single-click toggles play/pause.
- **HUD Feedback**: Brief on-screen indicator overlay when seeking, changing volume, or adjusting speed.
- **Drive Loading Indicator**: Shows a gentle "Loading from Drive…" overlay if initial streaming bytes are delayed.
- **Theatre Mode (`T`)**, **Fullscreen (`F`)**, and **PiP**.

### 4. Autoplay Next & Course Completion
- When a video ends, a 5-second countdown overlay appears with **Play now** and **Cancel**.
- Seamlessly crosses section boundaries to start the next lesson.
- Reaching the end of the entire course presents a celebratory **"Course Complete! 🎉"** screen.

### 5. Resume Tracking
- **Heartbeat Autosave**: Saves playback position every 5 seconds while playing.
- **Event-Driven Save**: Saves immediately on pause, seek, lesson change, and tab hide (`document.hidden`).
- **Page Unload Beacon**: Flushes progress via `navigator.sendBeacon` when the browser tab is closed.
- **Auto-Complete**: Automatically marks a lesson completed when progress reaches `≥ 95%`.
- **Smart Rewind**: Resumes playback at `saved - 3 seconds` (restarts from `0:00` if the lesson was already completed).

### 6. Phase 2 Features
- **Timestamped Notes (`N`)**: Add notes anchored to the current timestamp. Clicking a note jumps directly to that second in the video.
- **Bookmarks (`B`)**: Bookmark moments for quick review.
- **Keyboard Shortcuts (`?`)**: Full modal cheatsheet.
- **Study Stats & Heatmap**: Daily watch time, 7-day watch time, consecutive day streaks, and a 12-week GitHub-style activity heatmap.
- **Subtitles**: Auto-converts adjacent `.srt` files to WebVTT on the fly.
- **Progress Backup**: Export and Import all your watch progress, notes, and bookmarks as JSON.

---

## Keyboard Shortcuts Cheatsheet

| Key | Action |
|---|---|
| `Space` / `K` | Toggle Play / Pause |
| `J` / `L` | Seek backward / forward 10s |
| `←` / `→` | Seek backward / forward 5s |
| `↑` / `↓` | Volume Up / Down |
| `M` | Mute / Unmute |
| `F` | Fullscreen toggle |
| `T` | Theatre mode toggle |
| `Shift + N` | Next lesson |
| `Shift + P` | Previous lesson |
| `N` | Open Notes drawer at current timestamp |
| `B` | Add Bookmark at current timestamp |
| `?` | Open Keyboard Shortcuts cheatsheet |

---

## Configuration & MongoDB

The MongoDB connection string is located in `server/.env`:

```env
PORT=4000
HOST=127.0.0.1
MONGO_URI=mongodb+srv://trylaptop2024:trylaptop2024@cluster0.q8qtgtu.mongodb.net/course_player?appName=Cluster0
```

You can point `MONGO_URI` to a local MongoDB instance (`mongodb://127.0.0.1:27017/course_player`) or keep it connected to MongoDB Atlas.
