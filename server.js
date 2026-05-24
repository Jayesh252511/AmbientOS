/**
 * AmbientOS — server.js
 * Express + WebSocket server. Orchestrates Google API polling,
 * pushes notifications to the overlay browser page in real-time.
 */

'use strict';

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { createOAuth2Client, getAuthUrl, exchangeCodeForTokens, isAuthenticated } = require('./auth');
const { fetchAllNotifications, getNextDemoNotification } = require('./notifications');

const PORT = 3000;
const POLL_INTERVAL_MS = 60 * 1000; // 60 seconds
const DEMO_INTERVAL_MS = 9 * 1000;  // 9 seconds (for demo mode)

// ─────────────────────────────────────────────────────────
// Express App
// ─────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Global OAuth client — created once
const oAuth2Client = createOAuth2Client();

// ─────────────────────────────────────────────────────────
// HTTP Server + WebSocket Server
// ─────────────────────────────────────────────────────────
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const connectedClients = new Set();

wss.on('connection', (ws) => {
  connectedClients.add(ws);
  console.log(`[AmbientOS WS] Client connected. Total: ${connectedClients.size}`);

  // Send current auth status immediately on connect
  ws.send(JSON.stringify({
    type: 'status',
    authenticated: isAuthenticated(),
    message: isAuthenticated()
      ? 'Connected to AmbientOS. Google APIs active.'
      : 'Demo mode active. Visit http://localhost:3000/auth to connect Google.',
  }));

  ws.on('close', () => {
    connectedClients.delete(ws);
    console.log(`[AmbientOS WS] Client disconnected. Total: ${connectedClients.size}`);
  });

  ws.on('error', (err) => {
    console.error('[AmbientOS WS] Error:', err.message);
    connectedClients.delete(ws);
  });
});

/**
 * Broadcast a notification payload to all connected overlay clients.
 */
function broadcast(payload) {
  const msg = JSON.stringify(payload);
  for (const client of connectedClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

// ─────────────────────────────────────────────────────────
// Google API Polling Loop
// ─────────────────────────────────────────────────────────
let pollTimer = null;

async function pollGoogleAPIs() {
  if (!isAuthenticated()) return;

  console.log('[AmbientOS] Polling Google APIs...');
  try {
    const notifications = await fetchAllNotifications(oAuth2Client);
    if (notifications.length > 0) {
      console.log(`[AmbientOS] Broadcasting ${notifications.length} notification(s).`);
      for (const n of notifications) {
        broadcast({ ...n, type: 'notification', notificationType: n.type });
        // Small stagger between multiple notifications
        await new Promise(resolve => setTimeout(resolve, 2500));
      }
    } else {
      console.log('[AmbientOS] No new notifications.');
    }
  } catch (err) {
    console.error('[AmbientOS] Poll error:', err.message);
  }
}

function startPolling() {
  console.log('[AmbientOS] Starting Google API polling every 60s...');
  pollGoogleAPIs(); // immediate first poll
  pollTimer = setInterval(pollGoogleAPIs, POLL_INTERVAL_MS);
}

// ─────────────────────────────────────────────────────────
// Demo Mode Loop (when not authenticated)
// ─────────────────────────────────────────────────────────
let demoTimer = null;

function startDemoMode() {
  console.log('[AmbientOS] Demo mode active. Cycling sample notifications...');
  demoTimer = setInterval(() => {
    if (connectedClients.size === 0) return;
    const n = getNextDemoNotification();
    broadcast({ type: 'notification', ...n });
  }, DEMO_INTERVAL_MS);
}

// ─────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────

// Health check
app.get('/status', (req, res) => {
  res.json({
    status: 'running',
    authenticated: isAuthenticated(),
    clients: connectedClients.size,
    version: '1.0.0',
  });
});

// Trigger Google OAuth consent screen
app.get('/auth', (req, res) => {
  const url = getAuthUrl(oAuth2Client);
  console.log('[AmbientOS Auth] Redirecting to Google consent screen...');
  res.redirect(url);
});

// OAuth2 callback — exchange code for tokens
app.get('/oauth2callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    console.error('[AmbientOS Auth] OAuth error:', error);
    return res.send(`
      <html><body style="background:#0c0e12;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
        <div style="text-align:center;">
          <h2 style="color:#ff3b30;">Authentication Error</h2>
          <p>${error}</p>
          <a href="/auth" style="color:#00e5ff;">Try again</a>
        </div>
      </body></html>
    `);
  }

  try {
    await exchangeCodeForTokens(oAuth2Client, code);

    // Start real polling, stop demo mode
    if (demoTimer) { clearInterval(demoTimer); demoTimer = null; }
    startPolling();

    // Notify overlay clients that auth is now live
    broadcast({ type: 'status', authenticated: true, message: 'Google APIs connected! Live notifications active.' });
    broadcast({ type: 'notification', text: 'AmbientOS connected to Google • Live mode active', type: 'system', priority: 'medium' });

    res.send(`
      <html><body style="background:#0c0e12;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
        <div style="text-align:center;">
          <div style="font-size:48px;margin-bottom:16px;">✅</div>
          <h2 style="color:#34c759;margin:0 0 8px;">AmbientOS Connected</h2>
          <p style="color:rgba(255,255,255,0.6);margin:0 0 24px;">Google Calendar, Gmail & YouTube are now live.</p>
          <p style="color:rgba(255,255,255,0.3);font-size:12px;">You can close this tab. The overlay is running.</p>
        </div>
      </body></html>
    `);
  } catch (err) {
    console.error('[AmbientOS Auth] Token exchange failed:', err.message);
    res.status(500).send(`<html><body style="background:#0c0e12;color:#ff3b30;font-family:sans-serif;padding:40px;">
      <h2>Token exchange failed</h2><p>${err.message}</p>
      <a href="/auth" style="color:#00e5ff;">Retry</a>
    </body></html>`);
  }
});

// Manual trigger endpoint (for future integrations / webhooks)
app.post('/notify', express.json(), (req, res) => {
  const { text, type = 'system', priority = 'medium' } = req.body;
  if (!text) return res.status(400).json({ error: 'text is required' });
  broadcast({ type: 'notification', text, notificationType: type, priority });
  res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────
// AmbientOS v2.5 — System Vitals & Live Weather Polling
// ─────────────────────────────────────────────────────────

// Helper to get CPU Usage percentage
function getCPUTicks() {
  const cpus = os.cpus();
  let totalIdle = 0, totalTick = 0;
  if (!cpus) return { idle: 0, total: 0 };
  cpus.forEach(cpu => {
    for (let type in cpu.times) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  });
  return { idle: totalIdle, total: totalTick };
}

function getCPUUsage() {
  return new Promise((resolve) => {
    const start = getCPUTicks();
    setTimeout(() => {
      const end = getCPUTicks();
      const idleDiff = end.idle - start.idle;
      const totalDiff = end.total - start.total;
      if (totalDiff === 0) return resolve(0);
      const usage = 100 - Math.round((100 * idleDiff) / totalDiff);
      resolve(usage);
    }, 500);
  });
}

// Map Weather Codes to Icons & Descriptions
function getWeatherDesc(code) {
  const codes = {
    0: 'Clear Sky',
    1: 'Mainly Clear', 2: 'Partly Cloudy', 3: 'Overcast',
    45: 'Foggy', 48: 'Foggy',
    51: 'Light Drizzle', 53: 'Moderate Drizzle', 55: 'Dense Drizzle',
    61: 'Slight Rain', 63: 'Moderate Rain', 65: 'Heavy Rain',
    71: 'Slight Snow', 73: 'Moderate Snow', 75: 'Heavy Snow',
    80: 'Rain Showers', 81: 'Rain Showers', 82: 'Heavy Rain Showers',
    95: 'Thunderstorm', 96: 'Thunderstorm', 99: 'Thunderstorm'
  };
  return codes[code] || 'Misty';
}

// Fetch Geolocation and Weather
async function pollWeather() {
  try {
    console.log('[AmbientOS Weather] Fetching IP-based geolocation...');
    const geoRes = await fetch('https://ipapi.co/json/');
    if (!geoRes.ok) throw new Error('Location service unavailable');
    const geo = await geoRes.json();
    const { latitude, longitude, city } = geo;

    if (!latitude || !longitude) throw new Error('Invalid coordinate data');

    console.log(`[AmbientOS Weather] Location detected: ${city} (${latitude}, ${longitude})`);
    
    const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`);
    if (!weatherRes.ok) throw new Error('Weather API service unavailable');
    const weather = await weatherRes.json();
    const current = weather.current_weather;

    if (!current) throw new Error('No weather data received');

    const temp = Math.round(current.temperature);
    const desc = getWeatherDesc(current.weathercode);
    const text = `Weather -> ${desc} • ${temp}°C in ${city}`;

    console.log(`[AmbientOS Weather] Current condition: ${desc}, ${temp}°C`);
    broadcast({
      type: 'notification',
      notificationType: 'weather',
      text,
      priority: 'low'
    });
  } catch (err) {
    console.error('[AmbientOS Weather] Fetch failed:', err.message);
  }
}

// Fetch System Vitals (RAM, CPU, Windows Battery)
async function pollSystemVitals() {
  try {
    console.log('[AmbientOS System] Gathering OS metrics...');
    const cpu = await getCPUUsage();
    
    // RAM Calculation
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const ram = 100 - Math.round((100 * freeMem) / totalMem);

    // Battery checking via PowerShell (Windows only)
    if (process.platform === 'win32') {
      exec('powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Battery | Select EstimatedChargeRemaining, BatteryStatus | ConvertTo-Json"', (err, stdout) => {
        let batteryText = '';
        let priority = 'low';

        if (!err && stdout.trim()) {
          try {
            const data = JSON.parse(stdout.trim());
            const percent = data.EstimatedChargeRemaining;
            const status = data.BatteryStatus; // 1 = discharging, 2 = AC, 3 = fully charged
            
            if (percent !== undefined && percent !== null) {
              const state = (status === 2 || status === 3) ? 'Charging' : 'Discharging';
              batteryText = ` • Battery: ${percent}% (${state})`;
              if (percent < 20 && status !== 2) {
                priority = 'urgent';
              }
            }
          } catch (e) {
            // No battery hardware (desktop PC) or JSON parsing failed
          }
        }

        // Broadcast System Vitals Plane
        const text = `System -> CPU: ${cpu}% • RAM: ${ram}%${batteryText}`;
        console.log(`[AmbientOS System] CPU: ${cpu}%, RAM: ${ram}%${batteryText}`);
        
        broadcast({
          type: 'notification',
          notificationType: 'system',
          text,
          priority: priority === 'urgent' ? 'urgent' : (ram > 85 || cpu > 90) ? 'medium' : 'low'
        });
      });
    } else {
      // Non-Windows fallback
      const text = `System -> CPU: ${cpu}% • RAM: ${ram}%`;
      broadcast({
        type: 'notification',
        notificationType: 'system',
        text,
        priority: (ram > 85 || cpu > 90) ? 'medium' : 'low'
      });
    }
  } catch (err) {
    console.error('[AmbientOS System] Metrics failed:', err.message);
  }
}

// ─────────────────────────────────────────────────────────
// Global background timers for vitals and weather
let vitalsTimer = null;
let weatherTimer = null;

server.listen(PORT, () => {
  console.log('');
  console.log('  ╔═══════════════════════════════════════╗');
  console.log('  ║        AmbientOS v1.0 — Online        ║');
  console.log('  ╚═══════════════════════════════════════╝');
  console.log('');
  console.log(`  Overlay  →  http://localhost:${PORT}`);
  console.log(`  Status   →  http://localhost:${PORT}/status`);

  if (isAuthenticated()) {
    console.log('  Auth     →  ✅ Google APIs connected');
    console.log('');
    startPolling();
  } else {
    console.log(`  Auth     →  ⚠️  Not connected. Visit http://localhost:${PORT}/auth`);
    console.log('');
    startDemoMode();
  }

  // Geolocation & Weather polling (every 30 minutes)
  setTimeout(pollWeather, 3000); // 3 seconds initial delay
  weatherTimer = setInterval(pollWeather, 30 * 60 * 1000);

  // System Vitals polling (every 3 minutes)
  setTimeout(pollSystemVitals, 8000); // 8 seconds initial delay
  vitalsTimer = setInterval(pollSystemVitals, 3 * 60 * 1000);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[AmbientOS] Shutting down gracefully...');
  if (pollTimer) clearInterval(pollTimer);
  if (demoTimer) clearInterval(demoTimer);
  if (vitalsTimer) clearInterval(vitalsTimer);
  if (weatherTimer) clearInterval(weatherTimer);
  server.close(() => process.exit(0));
});
