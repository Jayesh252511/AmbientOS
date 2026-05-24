/**
 * Aether - Premium Ambient Desktop Notification System
 * Inspired by Apple, Nothing OS, and Jarvis aesthetics.
 */

// Sleek, minimal futuristic vector aircraft designs (facing right)
const AIRCRAFT_DESIGNS = [
    // Design 1: Stealth drone / Jet silhouette
    `<svg class="aircraft-svg" width="55" height="24" viewBox="0 0 100 44" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 22L85 10L95 22L85 34L10 22Z" fill="rgba(255, 255, 255, 0.95)" />
        <path d="M45 22L65 4L73 22L65 40L45 22Z" fill="rgba(255, 255, 255, 0.85)" />
        <path d="M68 20L80 18L78 22L68 20Z" fill="#00E5FF" />
        <rect x="5" y="20" width="5" height="4" rx="1" fill="#00E5FF" filter="url(#exhaust-glow)" />
        <defs>
            <filter id="exhaust-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>
        </defs>
    </svg>`,
    
    // Design 2: High-tech aero glider
    `<svg class="aircraft-svg" width="55" height="24" viewBox="0 0 100 44" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 22L90 18L95 22L90 26L12 22Z" fill="rgba(255, 255, 255, 0.95)" />
        <path d="M30 22L70 8L74 22L70 36L30 22Z" fill="rgba(255, 255, 255, 0.75)" />
        <line x1="5" y1="22" x2="12" y2="22" stroke="#00E5FF" stroke-width="3" filter="url(#glider-glow)" />
        <defs>
            <filter id="glider-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>
        </defs>
    </svg>`,

    // Design 3: Futuristic supersonic interceptor
    `<svg class="aircraft-svg" width="55" height="24" viewBox="0 0 100 44" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 22L80 14L98 22L80 30L10 22Z" fill="rgba(255, 255, 255, 0.95)" />
        <path d="M55 22L40 4L48 22L40 40L55 22Z" fill="rgba(255, 255, 255, 0.8)" />
        <path d="M78 21L88 19L86 22L78 21Z" fill="#00E5FF" />
        <rect x="4" y="20" width="6" height="4" rx="1" fill="#FF5E00" filter="url(#afterburner-glow)" />
        <defs>
            <filter id="afterburner-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>
        </defs>
    </svg>`
];

class AmbientNotificationEngine {
    constructor() {
        this.container = document.getElementById('ambient-overlay');
        this.notifications = [
            { text: "Meeting with Andrew • 5m", type: "calendar" },
            { text: "New mail from HR", type: "mail" },
            { text: "Fireship uploaded a new video", type: "youtube" },
            { text: "Daily standup starts soon", type: "calendar" },
            { text: "System deployment successful • v2.4.0", type: "system" },
            { text: "GitHub: 4 pull requests approved", type: "system" },
            { text: "Calendar: Lunch with Design Team • 1h", type: "calendar" },
            { text: "Vessel status: All systems nominal", type: "system" }
        ];
        this.activeTracks = new Set();
        this.totalTracks = 7;
        this.currentIndex = 0;
        this.spawnTimer = null;
        
        this.init();
    }
    
    init() {
        // Start the automated ambient cycle
        this.startCycle();
        
        // Expose a demo mode wallpaper switcher
        this.createDemoHUD();
    }
    
    startCycle() {
        // Initial spawn delay
        setTimeout(() => this.triggerNext(), 1500);
        
        // Spawn notifications dynamically at soft periodic intervals (16s)
        this.spawnTimer = setInterval(() => {
            this.triggerNext();
        }, 16000);
    }
    
    triggerNext() {
        const item = this.notifications[this.currentIndex];
        this.spawn(item.text, item.type);
        
        this.currentIndex = (this.currentIndex + 1) % this.notifications.length;
    }
    
    // Public method to manually feed new alerts
    spawn(text, type = 'default') {
        // 1. Track management - find an available vertical lane to prevent overlaps
        const availableTracks = [];
        for (let i = 0; i < this.totalTracks; i++) {
            if (!this.activeTracks.has(i)) {
                availableTracks.push(i);
            }
        }
        
        // Pick from free tracks, or fallback to a random one if crowded
        const trackIndex = availableTracks.length > 0 
            ? availableTracks[Math.floor(Math.random() * availableTracks.length)]
            : Math.floor(Math.random() * this.totalTracks);
            
        this.activeTracks.add(trackIndex);
        
        // 2. Compute y-coordinate layout position (percentage converted to screen pixels)
        const trackY = 12 + (trackIndex * 11); // Slots between 12% and 78% screen height
        const yPixels = (window.innerHeight * trackY) / 100;
        
        // 3. Create DOM structure
        const planeEl = document.createElement('div');
        planeEl.className = 'aircraft-container';
        
        // Select random futuristic model shape
        const svgContent = AIRCRAFT_DESIGNS[Math.floor(Math.random() * AIRCRAFT_DESIGNS.length)];
        
        planeEl.innerHTML = `
            <div class="aircraft-bobber">
                <div class="ambient-banner">
                    <span class="banner-dot ${type}"></span>
                    <span class="banner-text">${text}</span>
                </div>
                <div class="ambient-rope"></div>
                <div class="ambient-plane">
                    ${svgContent}
                </div>
            </div>
        `;
        
        // Position offscreen to the left initially
        planeEl.style.transform = `translate3d(-600px, ${yPixels}px, 0)`;
        this.container.appendChild(planeEl);
        
        // Force reflow so the starting state is processed by the GPU
        planeEl.offsetHeight;
        
        // Determine individual elegant, slower motion rate
        const duration = 14000 + Math.random() * 6000; // 14s to 20s
        
        // Animate translate across viewport to the right
        planeEl.style.transition = `transform ${duration}ms linear`;
        planeEl.style.transform = `translate3d(${window.innerWidth + 100}px, ${yPixels}px, 0)`;
        
        // Release track reservation after 8 seconds (allows a safe staggered follow-up plane)
        setTimeout(() => {
            this.activeTracks.delete(trackIndex);
        }, 8000);
        
        // Automatically prune DOM node when transition completes
        planeEl.addEventListener('transitionend', () => {
            planeEl.remove();
        });
    }
    
    createDemoHUD() {
        const hud = document.createElement('button');
        hud.className = 'demo-toggle-hud';
        hud.innerText = 'Ambient Layer • Transparent';
        hud.title = 'Click to toggle dark wallpaper preview';
        
        hud.addEventListener('click', () => {
            document.body.classList.toggle('demo-active');
            if (document.body.classList.contains('demo-active')) {
                hud.innerText = 'Ambient Layer • Wall Preview';
            } else {
                hud.innerText = 'Ambient Layer • Transparent';
            }
        });
        
        document.body.appendChild(hud);
    }
}

// Instantiate global notification controller
window.addEventListener('DOMContentLoaded', () => {
    window.Aether = new AmbientNotificationEngine();
});