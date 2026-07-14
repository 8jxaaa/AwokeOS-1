# AwokeOS v1
> A refined version of (previous) ArchOS. 
> A modern, fully browser-based operating system built with vanilla HTML, CSS, and JavaScript (ES Modules). Runs entirely in the browser — no backend required.

## Features

- **Desktop environment** with wallpaper, icons, taskbar, start menu, notification center, quick settings, and clock.
- **Window manager** with drag, resize, snap layouts, minimize/maximize/close, z-index focus management.
- **Virtual file system** backed by IndexedDB (files, folders, rename, delete, copy, paste, drag & drop, import/export).
- **17 built-in applications**: File Explorer, Terminal, Calculator, Calendar, Clock, Notes, Text Editor, Image Viewer, Music Player, Video Player, Browser, Task Manager, App Store, Weather, Paint, Markdown Editor, Settings.
- **Themes**: Light, Dark, AMOLED, Glassmorphism, Windows, macOS, Linux, plus accent color customization.
- **Persistence**: settings, files, window positions, themes, installed apps.
- **Offline-ready** via Service Worker.
- **Mobile & desktop** responsive, touch and keyboard accessible.

## Run

No build step. Serve the directory with any static server, e.g.:

```bash
# from this folder
python3 -m http.server 8080
# or
npx serve .
```

Then open `http://localhost:8080`.

## Architecture

```
core/         — event bus, state, app registry, kernel
desktop/      — desktop, taskbar, start menu, context menu
window-manager/ — window class, manager, snap layout
filesystem/   — VFS, IndexedDB store, path utils
apps/         — built-in applications
components/   — reusable UI components
services/     — settings, theme, notification, persistence
themes/       — theme presets
assets/       — icons, wallpapers
utils/        — DOM, sanitizer, animations, shortcuts
styles/       — CSS reset, variables, animations, main
```

See each module for details.
