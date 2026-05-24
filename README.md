# ✈️ AmbientOS — Native transparent HUD overlay

> **Apple-inspired Click-Through Desktop Overlay Layer** — A premium, high-fidelity transparent HUD that lives silently on your screen. Watch shaded 3D pink commercial airliners soar across your desktop, carrying beautiful floating glassmorphic banners for Google Calendar, Gmail, and YouTube notifications.

![AmbientOS Version](https://img.shields.io/badge/AmbientOS-v2.0--Native-ff69b4?style=for-the-badge&logo=none)
![Engine](https://img.shields.io/badge/Engine-Electron%20%2B%20Express-00e5ff?style=for-the-badge)
![Optimization](https://img.shields.io/badge/YouTube%20API-100x%20Quota%20Optimized-brightgreen?style=for-the-badge)

---

## ✨ Features & Architecture

AmbientOS acts as an ambient, non-intrusive notification layer that overlays your entire desktop. It uses hardware-accelerated transparency and click-through mechanisms to keep you updated without interrupting your active windows, full-screen code editors, or games.

```
                  ┌─────────────────────────────────────┐
                  │        AmbientOS Native HUD         │
                  │  (Click-through, Always-on-top HUD) │
                  └──────────────────┬──────────────────┘
                                     │
                             (Local WebSocket)
                                     │
                  ┌──────────────────┴──────────────────┐
                  │       Local Express Server          │
                  │   (Host public folder on Port 3000) │
                  └──────────────────┬──────────────────┘
                                     │
                             (Google OAuth2)
                                     │
       ┌─────────────────────────────┼─────────────────────────────┐
       ▼                             ▼                             ▼
┌──────────────┐              ┌──────────────┐              ┌──────────────┐
│  Gmail API   │              │ Calendar API │              │ YouTube API  │
│ (Mail planes)│              │(Meeting rope)│              │ (UU Playlists│
└──────────────┘              └──────────────┘              └──────────────┘
```

### 🌟 What's New in v2.0
* 🖥️ **Native Click-Through HUD:** Handled by a custom Electron wrapper (`main.js`) with zero-frame, skip-taskbar, non-focusable, and mouse-ignore properties. Click through planes seamlessly while playing games or coding!
* 🚀 **One-Click Windows Setup:** Boot directly into the background using a single bat script (`setup.bat`). It automatically configures an elevated Windows Scheduled Task.
* 🤫 **Silent Background Engine:** Powered by a silent VBScript bootloader (`start-server.vbs`). It runs the background server with a hidden terminal window.
* ⚡ **100x YouTube Quota Optimizer:** Subscriptions check shifted from the heavy Google Search API (100 units/request) to direct Uploads playlist items extraction (`UU-playlist` mapping). Saves your API limit!
* 🎨 **High-Contrast 3D Pink Theme:** Huge shaded pink commercial airliners, double-rope visual strings, white high-contrast drop-shadow typography, triple exhaust streams, and glowing white SVG vector icons.

---

## 🚀 One-Click Quick Setup

We've packaged the entire native overlay deployment into a single automated script. To get it running on your laptop:

### 1. Execute Setup Script
1. Open your terminal/CMD **as Administrator**.
2. Run the automated installer:
   ```cmd
   d:
   cd \AirplaneMessanger
   setup.bat
   ```
3. The setup script will:
   * Install all Node.js and Electron dependencies automatically.
   * Register a Windows Scheduled Task (`AmbientOS`) to start the overlay silently every time you log on.
   * Boot the silent launcher using the background VBS engine.

### 2. Verify Google Credentials
To fetch your live personal notifications, check that `credentials.json` is located in the root folder. If you don't have one, see the **Google Cloud API Setup** section below.

### 3. One-Time Authentication
Once the background engine is running, connect your Google account:
👉 Open your browser and go to: **[http://localhost:3000/auth](http://localhost:3000/auth)**

Log in to Google, approve permissions, and the system will write an encrypted `token.json` file in your directory. **You will never have to authenticate again!**

---

## 🔑 Google Cloud API Setup

To connect your own Google Account to AmbientOS, configure a Desktop Credentials Client on Google Cloud Platform:

### 1. Enable Required APIs in the Console
1. Go to [Google Cloud Console](https://console.cloud.google.com).
2. Select your target project (e.g. `gen-lang-client-*`).
3. Search for and **Enable** the following APIs:
   * ✅ **Google Calendar API** (for meetings and schedules)
   * ✅ **Gmail API** (for unread inbox notifications)
   * ✅ **YouTube Data API v3** (for subscription feed uploads)

### 2. Create Desktop Client Credentials
1. Go to **APIs & Services → Credentials**.
2. Click **Create Credentials → OAuth client ID**.
3. Set the application type to **Desktop App** and name it `AmbientOS Client`.
4. Download the generated client secrets JSON file.
5. Place it in `d:\AirplaneMessanger\`, and rename it exactly to **`credentials.json`**.

---

## 🛠️ Management & Background Commands

Since AmbientOS runs silently in the background, you can control the engine using simple system commands:

| Action | Command / Method | Description |
|:---|:---|:---|
| **Start Overlay** | Double-click `launch.bat` | Launches the HUD in a temporary window (shows logs). |
| **Silent Boot** | Run Scheduled Task | Starts Electron in the background via the Windows task scheduler. |
| **Stop Server** | `taskkill /f /im node.exe /im electron.exe` | Completely terminates any active background servers and overlays. |
| **Status Check** | Open `http://localhost:3000/status` | View connection status, auth states, and current clients. |

> [!NOTE]
> When the system boots up, `start-server.vbs` fires `cmd.exe /c npx electron .` with an execution mode of `0`, hiding the CMD window completely. This ensures zero tray clutter while keeping the overlay active.

---

## 📦 Git & Version Control Guidelines

This project is fully initialized and configured under Git. Since it runs locally, you must follow strict guidelines to prevent leaking sensitive API information.

### 1. Un-tracked Sensitive Files (`.gitignore`)
The following files are strictly ignored and **MUST NEVER** be pushed to GitHub:
* `token.json` — Contains your active Google Access and Refresh Tokens.
* `credentials.json` — Contains your Google Cloud OAuth secret key.
* `node_modules/` — Generated package dependency tree.
* `*.log` — Local execution error logs.

### 2. Standard Git Workflow
If you make code modifications or wish to back up your custom visual styles:

* **Check status:**
  ```bash
  git status
  ```
* **Stage your changes safely:**
  ```bash
  git add public/script.js public/style.css server.js README.md
  ```
  *(Never use `git add .` unless you verify no sensitive credential JSONs are staged).*
* **Commit changes:**
  ```bash
  git commit -m "Update visual layouts and optimize notification delivery"
  ```
* **Push to a remote repository:**
  Create a private repository on GitHub to keep your local parameters safe, add it as a remote, and push:
  ```bash
  git remote add origin <your-private-repo-url>
  git branch -M master
  git push -u origin master
  ```

---

## 🧪 Quota Optimization (YouTube Engine)

Previously, querying subscription uploads cost **100 quota units** per call by using YouTube search methods, leading to an immediate API lockout.

We resolved this by mapping subscriptions straight to their default playlist uploads:
1. **Get Channels (Cost 1):** Retrieves your active subscribed channel list.
2. **UU-Playlist Mapping (Cost 0):** Channels use a unique ID starting with `UC`. We replace this prefix with `UU` to derive their dedicated "Uploads" playlist ID.
3. **Playlist Fetch (Cost 1):** We fetch the first item in the derived `UU` playlist.

This drops total checking costs to **only 1 unit per channel**, allowing the background thread to poll indefinitely without exhausting your daily Google API quotas.

---

## 🎨 Premium Custom Visual Themes

Customize styles directly in [public/style.css](file:///d:/AirplaneMessanger/public/style.css) and [public/script.js](file:///d:/AirplaneMessanger/public/script.js).

* **Planes:** Designed with heavy 3D gradients reflecting highlights on the commercial airliner wings, tails, and cockpit.
* **Banner ropes:** Handled dynamically via CSS Canvas layers using curved bezier lines to form a realistic dual-cable hanging banner.
* **Typography:** Built using high-contrast white text coupled with soft outer drop-shadow filters, guaranteeing readable alerts against white web pages, code editors, or dark terminal interfaces.
