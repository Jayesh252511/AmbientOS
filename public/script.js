/**
 * AmbientOS — script.js
 * Core overlay engine. WebSocket listener, lane manager,
 * plane factory, GPU-accelerated flight animation.
 *
 * Architecture:
 *   AmbientOS (main class)
 *     ├── WebSocketManager   — connects to server, receives notifications
 *     ├── NotificationQueue  — priority queue for incoming messages
 *     ├── LaneManager        — 8 vertical tracks, collision avoidance
 *     └── PlaneFactory       — creates DOM aircraft + banner + rope
 */

'use strict';

/* ─────────────────────────────────────────────────────────
   AmbientOS v2.5 — Web Audio Procedural Synthesizer
   ───────────────────────────────────────────────────────── */
class WebAudioSynth {
  static play() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();

      // ── Whoosh Effect (Low-pass filtered white noise sweep) ──
      const bufferSize = ctx.sampleRate * 1.5; // 1.5 seconds
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 5.0;
      
      // Sweep filter frequency from 150Hz to 1200Hz then back down to 100Hz
      filter.frequency.setValueAtTime(150, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(1400, ctx.currentTime + 0.5);
      filter.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 1.5);
      
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.001, ctx.currentTime);
      noiseGain.gain.linearRampToValueAtTime(0.07, ctx.currentTime + 0.4);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
      
      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      
      // Start Whoosh
      noise.start();
      noise.stop(ctx.currentTime + 1.5);

      // ── Glowing Chime Effect (Tuned Bell/Sine with exponential decay) ──
      // Use 3 frequencies to form a nice cyber chime: root, perfect 5th, octave
      const now = ctx.currentTime + 0.35; // start chime slightly delayed after the whoosh peak
      const freqs = [523.25, 783.99, 1046.50]; // C5, G5, C6 (crystal chord)
      
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.value = freq;
        
        // Decay speed: root decays slower, octave decays fast
        const decayTime = 1.6 - (idx * 0.4);
        const volume = 0.05 / (idx + 1); // balance volume
        
        oscGain.gain.setValueAtTime(0.001, now);
        oscGain.gain.linearRampToValueAtTime(volume, now + 0.05);
        oscGain.gain.exponentialRampToValueAtTime(0.001, now + decayTime);
        
        osc.connect(oscGain);
        oscGain.connect(ctx.destination);
        
        osc.start(now);
        osc.stop(now + decayTime + 0.1);
      });
      
    } catch (e) {
      console.warn('[AmbientOS Synth] AudioContext play failed:', e.message);
    }
  }
}

/* ─────────────────────────────────────────────────────────
   AIRCRAFT DESIGNS — 3 futuristic SVG silhouettes
   ───────────────────────────────────────────────────────── */
const AIRCRAFT = {
  stealth: (scale = 1) => `
    <svg class="aircraft-svg" width="${Math.round(96*scale)}" height="${Math.round(40*scale)}"
         viewBox="0 0 96 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="fuselageGrad1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#e86893"/>
          <stop offset="35%" stop-color="#c23b63"/>
          <stop offset="100%" stop-color="#801f41"/>
        </linearGradient>
        <linearGradient id="wingGrad1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#c23b63"/>
          <stop offset="100%" stop-color="#691130"/>
        </linearGradient>
        <linearGradient id="engineGrad1" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#ffffff"/>
          <stop offset="100%" stop-color="#dddddd"/>
        </linearGradient>
        <linearGradient id="windowGrad1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#e0f7fa"/>
          <stop offset="100%" stop-color="#80deea"/>
        </linearGradient>
      </defs>
      <!-- Far Wing -->
      <path d="M 46 22 L 34 33 L 40 35 L 52 24 Z" fill="#691130" />
      <!-- Tail fin -->
      <path d="M 22 17 L 14 3 C 13 1, 16 0, 18 1 L 30 15 Z" fill="url(#wingGrad1)" />
      <!-- Horizontal stabilizer -->
      <path d="M 14 20 L 4 14 C 3 12, 6 12, 8 13 L 18 19 Z" fill="#691130" />
      <!-- Fuselage -->
      <path d="M 16 23 C 12 19, 20 12, 50 12 C 75 12, 90 15, 96 22 C 90 26, 75 28, 50 28 C 20 28, 16 26, 16 23 Z" fill="url(#fuselageGrad1)" />
      <!-- Cockpit Window -->
      <path d="M 80 18 C 84 18, 88 19, 90 21 C 88 23, 82 23, 80 21 Z" fill="url(#windowGrad1)" />
      <!-- Cabin Windows -->
      <circle cx="62" cy="21.5" r="1.8" fill="url(#windowGrad1)" />
      <circle cx="53" cy="21.5" r="1.8" fill="url(#windowGrad1)" />
      <circle cx="44" cy="21.5" r="1.8" fill="url(#windowGrad1)" />
      <circle cx="35" cy="21.5" r="1.8" fill="url(#windowGrad1)" />
      <!-- Near wing -->
      <path d="M 48 22 L 32 36 C 30 38, 34 38, 37 36 L 56 22 Z" fill="url(#wingGrad1)" />
      <!-- Engine pod -->
      <rect x="36" y="30" width="14" height="6" rx="3" fill="url(#engineGrad1)" />
      <rect x="36" y="30" width="3" height="6" rx="0.5" fill="#801f41" />
    </svg>`,

  glider: (scale = 1) => `
    <svg class="aircraft-svg" width="${Math.round(96*scale)}" height="${Math.round(40*scale)}"
         viewBox="0 0 96 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="fuselageGrad2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#ff7da7"/>
          <stop offset="35%" stop-color="#db4873"/>
          <stop offset="100%" stop-color="#8f1b40"/>
        </linearGradient>
        <linearGradient id="wingGrad2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#db4873"/>
          <stop offset="100%" stop-color="#730e2f"/>
        </linearGradient>
        <linearGradient id="engineGrad2" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#ffffff"/>
          <stop offset="100%" stop-color="#dddddd"/>
        </linearGradient>
        <linearGradient id="windowGrad2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#e0f7fa"/>
          <stop offset="100%" stop-color="#80deea"/>
        </linearGradient>
      </defs>
      <!-- Far Wing -->
      <path d="M 46 22 L 30 34 L 36 36 L 52 24 Z" fill="#730e2f" />
      <!-- Tail fin -->
      <path d="M 22 17 L 13 2 C 12 0, 15 0, 17 1 L 30 15 Z" fill="url(#wingGrad2)" />
      <!-- Horizontal stabilizer -->
      <path d="M 14 20 L 3 13 C 2 11, 5 11, 7 12 L 18 19 Z" fill="#730e2f" />
      <!-- Fuselage -->
      <path d="M 16 23 C 12 19, 20 12, 50 12 C 75 12, 90 15, 96 22 C 90 26, 75 28, 50 28 C 20 28, 16 26, 16 23 Z" fill="url(#fuselageGrad2)" />
      <!-- Cockpit Window -->
      <path d="M 80 18 C 84 18, 88 19, 90 21 C 88 23, 82 23, 80 21 Z" fill="url(#windowGrad2)" />
      <!-- Cabin Windows -->
      <circle cx="62" cy="21.5" r="1.8" fill="url(#windowGrad2)" />
      <circle cx="53" cy="21.5" r="1.8" fill="url(#windowGrad2)" />
      <circle cx="44" cy="21.5" r="1.8" fill="url(#windowGrad2)" />
      <circle cx="35" cy="21.5" r="1.8" fill="url(#windowGrad2)" />
      <!-- Near wing (slightly longer) -->
      <path d="M 48 22 L 28 38 C 26 40, 30 40, 33 38 L 56 22 Z" fill="url(#wingGrad2)" />
      <!-- Engine pod -->
      <rect x="34" y="31" width="14" height="6" rx="3" fill="url(#engineGrad2)" />
      <rect x="34" y="31" width="3" height="6" rx="0.5" fill="#8f1b40" />
    </svg>`,

  interceptor: (scale = 1) => `
    <svg class="aircraft-svg" width="${Math.round(96*scale)}" height="${Math.round(40*scale)}"
         viewBox="0 0 96 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="fuselageGrad3" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#f05b8e"/>
          <stop offset="35%" stop-color="#cc3165"/>
          <stop offset="100%" stop-color="#80183b"/>
        </linearGradient>
        <linearGradient id="wingGrad3" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#cc3165"/>
          <stop offset="100%" stop-color="#660d2d"/>
        </linearGradient>
        <linearGradient id="engineGrad3" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#ffffff"/>
          <stop offset="100%" stop-color="#dddddd"/>
        </linearGradient>
        <linearGradient id="windowGrad3" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#e0f7fa"/>
          <stop offset="100%" stop-color="#80deea"/>
        </linearGradient>
      </defs>
      <!-- Far Wing -->
      <path d="M 46 22 L 34 33 L 40 35 L 52 24 Z" fill="#660d2d" />
      <!-- Tail fin -->
      <path d="M 22 17 L 15 3 C 14 1, 17 0, 19 1 L 30 15 Z" fill="url(#wingGrad3)" />
      <!-- Horizontal stabilizer -->
      <path d="M 14 20 L 4 14 C 3 12, 6 12, 8 13 L 18 19 Z" fill="#660d2d" />
      <!-- Fuselage -->
      <path d="M 16 23 C 12 19, 20 12, 50 12 C 75 12, 90 15, 96 22 C 90 26, 75 28, 50 28 C 20 28, 16 26, 16 23 Z" fill="url(#fuselageGrad3)" />
      <!-- Cockpit Window -->
      <path d="M 80 18 C 84 18, 88 19, 90 21 C 88 23, 82 23, 80 21 Z" fill="url(#windowGrad3)" />
      <!-- Cabin Windows -->
      <circle cx="62" cy="21.5" r="1.8" fill="url(#windowGrad3)" />
      <circle cx="53" cy="21.5" r="1.8" fill="url(#windowGrad3)" />
      <circle cx="44" cy="21.5" r="1.8" fill="url(#windowGrad3)" />
      <circle cx="35" cy="21.5" r="1.8" fill="url(#windowGrad3)" />
      <!-- Near wing -->
      <path d="M 48 22 L 32 36 C 30 38, 34 38, 37 36 L 56 22 Z" fill="url(#wingGrad3)" />
      <!-- Dual Engine Pods -->
      <rect x="36" y="29" width="12" height="5" rx="2.5" fill="url(#engineGrad3)" />
      <rect x="38" y="34" width="12" height="5" rx="2.5" fill="url(#engineGrad3)" />
    </svg>`,
};

const AIRCRAFT_KEYS = Object.keys(AIRCRAFT);

/* ─────────────────────────────────────────────────────────
   DEMO NOTIFICATIONS (fallback when server unavailable)
   ───────────────────────────────────────────────────────── */
const DEMO_NOTIFICATIONS = [
  { text: 'Calendar -> Meeting with Andrew • 5m', type: 'calendar', priority: 'urgent' },
  { text: 'Mail from: HR • Interview Schedule', type: 'mail', priority: 'medium' },
  { text: 'YouTube -> Fireship: 10 JS Tricks', type: 'youtube', priority: 'low' },
  { text: 'Calendar -> Standup Meeting • 15m', type: 'calendar', priority: 'medium' },
  { text: 'System -> Build completed successfully', type: 'system', priority: 'low' },
  { text: 'Calendar -> Quarterly Review • 30m', type: 'calendar', priority: 'medium' },
  { text: 'Mail from: GitHub • PR #42 Approved', type: 'mail', priority: 'low' },
  { text: 'Calendar -> Design Review • now', type: 'calendar', priority: 'urgent' },
  { text: 'System -> Deployment to production done', type: 'system', priority: 'medium' },
  { text: 'YouTube -> Fireship: React is dead (again)', type: 'youtube', priority: 'low' },
];

/* ─────────────────────────────────────────────────────────
   LANE MANAGER — 8 vertical tracks, prevents collisions
   ───────────────────────────────────────────────────────── */
class LaneManager {
  constructor(trackCount = 8) {
    this.trackCount = trackCount;
    this.activeLanes = new Set();
  }

  /**
   * Returns a Y-pixel position for an available lane.
   * Falls back to random if all lanes are busy.
   */
  reserve() {
    const available = [];
    for (let i = 0; i < this.trackCount; i++) {
      if (!this.activeLanes.has(i)) available.push(i);
    }
    const pick = available.length > 0
      ? available[Math.floor(Math.random() * available.length)]
      : Math.floor(Math.random() * this.trackCount);

    this.activeLanes.add(pick);

    // Map track index to y-position: 8%–82% of screen height
    const pct = 0.08 + (pick / (this.trackCount - 1)) * 0.74;
    return { laneIndex: pick, yPx: Math.round(window.innerHeight * pct) };
  }

  release(laneIndex) {
    this.activeLanes.delete(laneIndex);
  }
}

/* ─────────────────────────────────────────────────────────
   NOTIFICATION QUEUE — priority-ordered ring buffer
   ───────────────────────────────────────────────────────── */
class NotificationQueue {
  constructor() {
    this._queue = [];
  }

  enqueue(notification) {
    const order = { urgent: 0, medium: 1, low: 2 };
    const priority = order[notification.priority] ?? 2;
    // Insert in priority order
    let i = 0;
    while (i < this._queue.length && (order[this._queue[i].priority] ?? 2) <= priority) i++;
    this._queue.splice(i, 0, notification);
  }

  dequeue() {
    return this._queue.shift() || null;
  }

  get size() { return this._queue.length; }
}

/* ─────────────────────────────────────────────────────────
   PLANE FACTORY — builds DOM element for one flight
   ───────────────────────────────────────────────────────── */
class PlaneFactory {
  constructor(container) {
    this.container = container;
  }

  /**
   * Create and return a plane DOM element (not yet appended).
   */
  create(notification) {
    const { text, type = 'default', priority = 'low' } = notification;

    // Pick aircraft by priority/type
    const designMap = { urgent: 'interceptor', medium: 'glider', low: 'stealth', system: 'stealth' };
    const designKey = designMap[priority] || AIRCRAFT_KEYS[Math.floor(Math.random() * AIRCRAFT_KEYS.length)];
    const scale = priority === 'urgent' ? 1.45 : priority === 'medium' ? 1.35 : 1.25;

    // Get the high-quality inline SVG icon for this type
    const iconSvg = this._getIconSvg(type);

    const wrapper = document.createElement('div');
    wrapper.className = 'aircraft-container';

    // Random bob timing for organic feel
    const bobDuration = (4.5 + Math.random() * 2.5).toFixed(1);
    const bobDelay = (-Math.random() * 3).toFixed(1);

    wrapper.innerHTML = `
      <div class="aircraft-bobber" style="--bob-duration:${bobDuration}s; --bob-delay:${bobDelay}s;">
        <div class="ambient-banner priority-${priority} type-${type}">
          <span class="banner-icon-container">${iconSvg}</span>
          <span class="banner-text">${this._escapeHtml(text)}</span>
        </div>
        <div class="ambient-rope">
          <svg width="40" height="24" viewBox="0 0 40 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M 0 2 L 40 12 L 0 22" stroke="var(--color-low)" stroke-width="1.8" stroke-linecap="round" />
          </svg>
        </div>
        <div class="ambient-plane">
          ${AIRCRAFT[designKey](scale)}
        </div>
      </div>
    `;

    return wrapper;
  }

  _getIconSvg(type) {
    const strokeColor = "#ffffff";
    const icons = {
      calendar: `
        <svg class="banner-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${strokeColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>`,
      mail: `
        <svg class="banner-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${strokeColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
          <polyline points="22,6 12,13 2,6"></polyline>
        </svg>`,
      youtube: `
        <svg class="banner-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${strokeColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"></path>
          <polygon points="9.75,15.02 15.5,11.75 9.75,8.48" fill="currentColor"></polygon>
        </svg>`,
      weather: `
        <svg class="banner-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${strokeColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"></path>
          <circle cx="12" cy="12" r="4"></circle>
        </svg>`,
      system: `
        <svg class="banner-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${strokeColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect>
          <rect x="9" y="9" width="6" height="6"></rect>
          <line x1="9" y1="1" x2="9" y2="4"></line>
          <line x1="15" y1="1" x2="15" y2="4"></line>
          <line x1="9" y1="20" x2="9" y2="23"></line>
          <line x1="15" y1="20" x2="15" y2="23"></line>
          <line x1="20" y1="9" x2="23" y2="9"></line>
          <line x1="20" y1="15" x2="23" y2="15"></line>
          <line x1="1" y1="9" x2="4" y2="9"></line>
          <line x1="1" y1="15" x2="4" y2="15"></line>
        </svg>`,
      default: `
        <svg class="banner-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${strokeColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>`
    };
    return icons[type] || icons.default;
  }

  _escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

/* ─────────────────────────────────────────────────────────
   WEBSOCKET MANAGER
   ───────────────────────────────────────────────────────── */
class WebSocketManager {
  constructor(onMessage, onStatusChange) {
    this.onMessage = onMessage;
    this.onStatusChange = onStatusChange;
    this.ws = null;
    this.reconnectTimer = null;
    this.reconnectDelay = 2000;
    this.connected = false;
  }

  connect() {
    try {
      this.ws = new WebSocket('ws://localhost:3000');

      this.ws.addEventListener('open', () => {
        this.connected = true;
        this.reconnectDelay = 2000;
        console.log('[AmbientOS] WebSocket connected.');
        this.onStatusChange('connected');
      });

      this.ws.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data);
          this.onMessage(data);
        } catch (e) {
          console.warn('[AmbientOS] Bad WS message:', event.data);
        }
      });

      this.ws.addEventListener('close', () => {
        this.connected = false;
        this.onStatusChange('disconnected');
        this._scheduleReconnect();
      });

      this.ws.addEventListener('error', () => {
        this.connected = false;
        this.onStatusChange('disconnected');
      });

    } catch (e) {
      this._scheduleReconnect();
    }
  }

  _scheduleReconnect() {
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, 30000);
      this.connect();
    }, this.reconnectDelay);
  }
}

/* ─────────────────────────────────────────────────────────
   AMBIENTOS — Main Engine
   ───────────────────────────────────────────────────────── */
class AmbientOS {
  constructor() {
    this.overlay    = document.getElementById('ambient-overlay');
    this.hudDot     = document.getElementById('hud-dot');
    this.hudLabel   = document.getElementById('hud-label');
    this.setupPanel = document.getElementById('setup-panel');

    this.lanes    = new LaneManager(8);
    this.queue    = new NotificationQueue();
    this.factory  = new PlaneFactory(this.overlay);

    this.isLive         = false;  // true = server + Google auth active
    this.spawnLock      = false;  // prevents spawning when lane is being claimed
    this.demoIndex      = 0;
    this.demoInterval   = null;
    this.processTimer   = null;
    this.activePlanes   = 0;
    this.MAX_PLANES     = 4;      // max simultaneous planes on screen

    this._init();
  }

  _init() {
    // Connect to server WebSocket
    this.ws = new WebSocketManager(
      (data) => this._handleServerMessage(data),
      (status) => this._handleConnectionStatus(status),
    );
    this.ws.connect();

    // Setup panel dismiss button
    const dismissBtn = document.getElementById('setup-dismiss-btn');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', () => {
        if (this.setupPanel) this.setupPanel.classList.add('hidden');
      });
    }

    // Start processing queue every 1.5s (soft rate limiting)
    this.processTimer = setInterval(() => this._processQueue(), 1500);

    // Fallback: start demo mode if no server connection in 4s
    setTimeout(() => {
      if (!this.isLive && !this.ws.connected) {
        this._startDemoMode();
      }
    }, 4000);

    // Interactive Cyberpunk Theme Switcher
    const hud = document.getElementById('ambientos-hud');
    if (hud) {
      this.activeTheme = 'cyberpink';
      this.themes = ['cyberpink', 'neonmint', 'lasercyan'];
      
      hud.addEventListener('click', () => {
        const nextIdx = (this.themes.indexOf(this.activeTheme) + 1) % this.themes.length;
        const nextTheme = this.themes[nextIdx];
        
        // Remove old theme classes
        document.body.classList.remove(...this.themes.map(t => `theme-${t}`));
        
        // Add new theme class
        if (nextTheme !== 'cyberpink') {
          document.body.classList.add(`theme-${nextTheme}`);
        }
        
        this.activeTheme = nextTheme;
        console.log(`[AmbientOS Theme] Switched to: ${nextTheme}`);
        
        // Show temporary visual feedback inside HUD label
        const originalText = this.hudLabel.textContent;
        const displayName = nextTheme === 'cyberpink' ? 'Cyberpink' : nextTheme === 'neonmint' ? 'Neon Mint' : 'Laser Cyan';
        this.hudLabel.textContent = `Theme: ${displayName}`;
        
        // Play synthesizer chime to acknowledge the click!
        WebAudioSynth.play();
        
        setTimeout(() => {
          this.hudLabel.textContent = originalText;
        }, 1800);
      });
    }
  }

  // ── Handle incoming WebSocket messages ──
  _handleServerMessage(data) {
    if (data.type === 'status') {
      if (data.authenticated) {
        this._setLiveMode();
      } else {
        this._setDemoMode();
        if (this.setupPanel) this.setupPanel.classList.remove('hidden');
      }
      return;
    }

    // If the message contains text, it is a notification payload
    if (data.text) {
      this.queue.enqueue({
        text: data.text,
        type: data.notificationType || data.type || 'default',
        priority: data.priority || 'low',
      });
    }
  }

  // ── WebSocket connection status changes ──
  _handleConnectionStatus(status) {
    if (status === 'connected') {
      // Don't change HUD yet — wait for 'status' message
    } else {
      // Server offline — use demo mode
      if (!this.demoInterval) this._startDemoMode();
      this._updateHUD('demo');
    }
  }

  _setLiveMode() {
    this.isLive = true;
    this._stopDemoMode();
    this._updateHUD('live');
    if (this.setupPanel) this.setupPanel.classList.add('hidden');
    console.log('[AmbientOS] Live mode — Google APIs active.');
  }

  _setDemoMode() {
    this.isLive = false;
    this._startDemoMode();
    this._updateHUD('demo');
  }

  _startDemoMode() {
    if (this.demoInterval) return;
    // Immediately queue first notification
    this.queue.enqueue(DEMO_NOTIFICATIONS[this.demoIndex % DEMO_NOTIFICATIONS.length]);
    this.demoIndex++;
    // Then cycle every 9s
    this.demoInterval = setInterval(() => {
      this.queue.enqueue(DEMO_NOTIFICATIONS[this.demoIndex % DEMO_NOTIFICATIONS.length]);
      this.demoIndex++;
    }, 9000);
  }

  _stopDemoMode() {
    if (this.demoInterval) {
      clearInterval(this.demoInterval);
      this.demoInterval = null;
    }
  }

  _updateHUD(mode) {
    if (!this.hudDot || !this.hudLabel) return;
    this.hudDot.className = `hud-status-dot ${mode}`;
    this.hudLabel.textContent = mode === 'live' ? 'AmbientOS • Live' : 'AmbientOS • Demo';
  }

  // ── Dequeue and spawn next notification ──
  _processQueue() {
    if (this.queue.size === 0) return;
    if (this.activePlanes >= this.MAX_PLANES) return;
    const notification = this.queue.dequeue();
    if (notification) this._spawnPlane(notification);
  }

  // ── Spawn one aircraft + banner flight ──
  _spawnPlane(notification) {
    const { laneIndex, yPx } = this.lanes.reserve();
    this.activePlanes++;

    console.log(`[Spawn] Spawning plane in lane ${laneIndex} at Y: ${yPx}px for: "${notification.text}"`);

    // Trigger the procedural synth sweep and bell chime
    WebAudioSynth.play();

    const el = this.factory.create(notification);
    this.overlay.appendChild(el);

    // Start offscreen left, with Y position fixed
    el.style.transform = `translate3d(-640px, ${yPx}px, 0)`;
    el.style.transition = 'none';

    // Force layout
    void el.offsetWidth;

    // Pick a duration for this flight (12–20 seconds)
    const durationMs = 12000 + Math.random() * 8000;

    // Fly across screen — translate3d for GPU acceleration
    requestAnimationFrame(() => {
      el.style.transition = `transform ${durationMs}ms linear`;
      el.style.transform = `translate3d(${window.innerWidth + 120}px, ${yPx}px, 0)`;
    });

    // Release lane after 7s (allow follow-up planes on same lane)
    setTimeout(() => this.lanes.release(laneIndex), 7000);

    // Remove DOM element after flight
    el.addEventListener('transitionend', () => {
      el.remove();
      this.activePlanes = Math.max(0, this.activePlanes - 1);
    }, { once: true });
  }

  /**
   * Public API — trigger a custom notification programmatically.
   * window.AmbientOS.trigger('Hello World', 'system', 'medium')
   */
  trigger(text, type = 'default', priority = 'medium') {
    this.queue.enqueue({ text, type, priority });
  }
}

/* ─────────────────────────────────────────────────────────
   BOOT
   ───────────────────────────────────────────────────────── */
window.addEventListener('DOMContentLoaded', () => {
  window.AmbientOS = new AmbientOS();
  console.log('[AmbientOS] v1.0 — Overlay active. window.AmbientOS.trigger() available.');
});

// Resize handler — rebuild lane y-positions
window.addEventListener('resize', () => {
  if (window.AmbientOS) {
    window.AmbientOS.lanes = new LaneManager(8);
  }
});
