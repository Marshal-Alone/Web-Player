# Changelog - Local Course Player

All notable milestones and architectural implementations completed for the Local Course Player.

## [1.0.0] - 2026-11-07

### Milestone 1: Foundations & Scaffolding
- Built Fastify 5 + TypeScript backend with MongoDB Atlas connection pooling.
- Designed 8 persistent Mongoose schemas: Profile, Section, Video, Progress, Note, Bookmark, WatchLog, Setting.
- Auto-seeded default profiles for `DSA` and `Development`.
- Scaffolded Vite + React + TypeScript web app with Tailwind CSS and Hallmark design tokens at `:root`.
- Configured Zustand state stores (`usePlayerStore`, `useProfileStore`, `useUIStore`).

### Milestone 2: Google Drive Non-Invasive Scanner, Profiles & Settings
- Implemented non-invasive scanner using `readdir` and `stat` exclusively (never reads file content, keeping Google Drive streaming bandwidth safe).
- Added natural numeric sorting (`57.` before `100.`, `672` before `1001`).
- Implemented badge and clean title extraction parser.
- Built rename-resilient file matcher using `relPath` and fallback to `size + mtime` so progress is never lost.
- Flagged missing videos with `missing: true` preserving watch progress.
- Built profile path configuration with non-invasive `Validate` button and `Rescan` button in Settings.
- Added instant top navigation profile switcher.
- Added **Bulk Progress Marking** tools in Settings: mark entire profile as watched, reset all progress, mark specific section as watched, or mark watched up to any selected lesson.

### Milestone 3: HTTP 206 Video Streaming & Library Dashboard
- Implemented robust HTTP 206 Partial Content Range streaming engine supporting arbitrary byte seeking and client stream abort cleanup.
- Built Continue Watching Hero Card displaying last played lesson, remaining time, and single-click Resume.
- Implemented Section Cards grid with completion counts, progress indicators, and total duration.
- Added instant cross-section search filtering lessons across the entire profile.

### Milestone 4: Player Engine, Custom Controls & Autoplay Next
- Built custom HTML5 video controls matching Apna College path player layout.
- Added scrubber seek bar with buffered ranges visualization and hover timestamp preview tooltip.
- Implemented gear popup speed menu: `0.5x, 0.75x, 1x, 1.25x, 1.5x, 1.75x, 2x, 2.5x, 3x`.
- Added dedicated `±10s` buttons and double-click left/right half seek gestures.
- Built transient on-screen HUD overlay for seek, volume, and speed changes.
- Implemented "Loading from Drive…" buffering state indicator.
- Created 5-second autoplay next countdown overlay with "Play now" and "Cancel" that seamlessly crosses section boundaries.
- Built celebratory "Course Complete! 🎉" screen.
- Implemented 5s interval progress autosave, pause/seek saves, `navigator.sendBeacon` on unload, auto-complete at `≥ 95%`, and smart 3-second rewind resume.

### Milestone 5: Phase 2 Learning Enhancements
- Added timestamped notes system (`N` key) with jump-to-time and editing.
- Built bookmarks drawer (`B` key).
- Created interactive Keyboard Shortcuts cheatsheet modal (`?` key).
- Built Study Analytics dashboard with today's watch time, 7-day watch time, consecutive day streaks, and 12-week (84-day) activity heatmap.
- Implemented on-the-fly SRT to WebVTT subtitle converter.
- Implemented JSON progress export and import for full backup portability.

### Milestone 6: Packaging & Deliverables
- Created `start.bat` for one-click setup, building, launching, and browser opening at `http://localhost:4000`.
- Authored comprehensive documentation in `README.md`.
- Verified live end-to-end operation with MongoDB Atlas and Fastify web serving.
