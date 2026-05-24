# AmbientOS

> **Futuristic ambient desktop notification overlay** — tiny animated planes fly across your screen carrying compact notification banners from Google Calendar, Gmail, and YouTube.

![AmbientOS Banner](https://img.shields.io/badge/AmbientOS-v1.0-00e5ff?style=for-the-badge&logo=none)

---

## ✨ What is AmbientOS?

AmbientOS is a transparent, click-through, always-on-top ambient computing layer that quietly lives over your desktop while you work, code, game, or browse.

Whenever a Google event occurs, a tiny plane smoothly flies from left to right carrying a compact glassmorphism banner.

**No popups. No sounds. No interruptions. Just ambient, peaceful awareness.**

---

## 🚀 Quick Start

### 1. Install dependencies
```bash
cd d:\AirplaneMessanger
npm install
```

### 2. Launch AmbientOS
**Double-click `launch.bat`** or run:
```bash
npm start
```

### 3. Connect Google Account (optional)
Open `http://localhost:3000/auth` in your browser and sign in with Google.

This connects:
- 📅 **Google Calendar** — meeting reminders
- 📧 **Gmail** — important email notifications
- 📺 **YouTube** — new video uploads from subscriptions

---

## 🔑 Google API Setup

The `credentials.json` file is already configured with your Google Cloud project (`gen-lang-client-0166240720`).

### Enable Required APIs in Google Cloud Console:
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Select project `gen-lang-client-0166240720`
3. Navigate to **APIs & Services → Library**
4. Enable these APIs:
   - ✅ **Google Calendar API**
   - ✅ **Gmail API**
   - ✅ **YouTube Data API v3**

### First-Time Auth:
1. Run `npm start` → visit `http://localhost:3000/auth`
2. Sign in with Google → authorize access
3. `token.json` is created automatically (never re-auth needed)

---

## 🏗️ Architecture

```
AirplaneMessanger/
├── server.js          ← Express + WebSocket server (port 3000)
├── auth.js            ← Google OAuth2 manager
├── notifications.js   ← Google API fetcher + smart formatter
├── credentials.json   ← Google OAuth credentials
├── token.json         ← Auto-generated after first auth (gitignore this!)
├── package.json
├── launch.bat         ← One-click launcher
│
└── public/            ← Browser overlay
    ├── index.html     ← Transparent overlay canvas
    ├── style.css      ← Glassmorphism + animations
    └── script.js      ← AmbientOS engine (WS + lanes + planes)
```

---

## 🎮 Developer API

From the browser console, trigger custom notifications:

```js
// Trigger a custom notification
window.AmbientOS.trigger('Deploying to production...', 'system', 'medium');
window.AmbientOS.trigger('Meeting in 2 minutes!', 'calendar', 'urgent');
window.AmbientOS.trigger('New video from Fireship', 'youtube', 'low');
```

From any HTTP client, POST to the notification endpoint:
```bash
curl -X POST http://localhost:3000/notify \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello from curl!","type":"system","priority":"low"}'
```

---

## 🎨 Priority Levels

| Priority | Visual | Use Case |
|----------|--------|----------|
| `urgent` | 🔴 Red glow + interceptor plane | Meeting in < 5m, IMPORTANT email |
| `medium` | 🔵 Blue glow + glider | Meeting in 30m, personal email |
| `low`    | 🩵 Cyan + stealth plane | YouTube uploads, build events |

---

## 🔮 Future Integrations

The architecture is prepared for:
- Slack / Discord webhooks
- Weather notifications
- Stock price alerts
- Focus mode (suppress all notifications)
- Smart scheduling (quiet hours)
- Multi-monitor support
- AI voice assistant layer

---

## ⚠️ Notes

- `token.json` contains your Google auth tokens. **Do not share or commit it.**
- For true always-on-top over fullscreen games, an Electron wrapper is needed (future roadmap).
- The overlay runs best in Chrome `--app` mode (launched via `launch.bat`).
