/**
 * AmbientOS — notifications.js
 * Smart notification engine. Fetches from Google APIs, filters, formats,
 * classifies priority, and deduplicates.
 */

'use strict';

const { google } = require('googleapis');

// ─────────────────────────────────────────────────────────
// Simple hash for deduplication (no crypto dep needed)
// ─────────────────────────────────────────────────────────
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(36);
}

// ─────────────────────────────────────────────────────────
// Deduplication store (expires after 10 minutes)
// ─────────────────────────────────────────────────────────
const deliveredHashes = new Map();

function isDuplicate(text) {
  const hash = simpleHash(text);
  const now = Date.now();
  if (deliveredHashes.has(hash)) {
    const timestamp = deliveredHashes.get(hash);
    if (now - timestamp < 10 * 60 * 1000) return true; // 10 min window
  }
  deliveredHashes.set(hash, now);
  return false;
}

// ─────────────────────────────────────────────────────────
// Smart Text Formatter
// ─────────────────────────────────────────────────────────
function truncate(str, max = 48) {
  if (!str) return '';
  str = str.trim();
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

function formatCalendarEvent(event) {
  const now = new Date();
  const start = new Date(event.start?.dateTime || event.start?.date);
  const diffMs = start - now;
  const diffMin = Math.round(diffMs / 60000);

  let timeLabel = '';
  if (diffMin <= 0) timeLabel = 'now';
  else if (diffMin < 60) timeLabel = `${diffMin}m`;
  else {
    const h = Math.floor(diffMin / 60);
    timeLabel = `${h}h`;
  }

  const title = truncate(event.summary || 'Meeting', 28);
  return `Calendar -> ${title} • ${timeLabel}`;
}

function formatEmail(message) {
  const headers = message.payload?.headers || [];
  const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
  const subject = headers.find(h => h.name === 'Subject')?.value || '';

  // Extract name from "Name <email>" format
  const nameMatch = from.match(/^([^<]+)/);
  const senderName = nameMatch ? nameMatch[1].trim().split(' ')[0] : from;

  if (subject && subject.length > 0) {
    return `Mail from: ${senderName} • ${truncate(subject, 24)}`;
  }
  return `Mail from: ${senderName}`;
}

function formatYouTubeVideo(video) {
  const channel = truncate(video.snippet?.channelTitle || 'YouTube', 18);
  const title = truncate(video.snippet?.title || 'New video', 24);
  return `YouTube -> ${channel}: ${title}`;
}

// ─────────────────────────────────────────────────────────
// Priority Classifier
// ─────────────────────────────────────────────────────────
function classifyCalendarPriority(event) {
  const now = new Date();
  const start = new Date(event.start?.dateTime || event.start?.date);
  const diffMin = (start - now) / 60000;
  if (diffMin <= 5) return 'urgent';
  if (diffMin <= 30) return 'medium';
  return 'low';
}

function classifyEmailPriority(message) {
  const labels = message.labelIds || [];
  if (labels.includes('IMPORTANT') || labels.includes('STARRED')) return 'urgent';
  if (labels.includes('CATEGORY_PERSONAL')) return 'medium';
  return 'low';
}

// ─────────────────────────────────────────────────────────
// Google Calendar — Upcoming Events
// ─────────────────────────────────────────────────────────
async function fetchCalendarNotifications(auth) {
  try {
    const calendar = google.calendar({ version: 'v3', auth });
    const now = new Date();
    const future = new Date(now.getTime() + 35 * 60 * 1000); // next 35 min

    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: future.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 5,
    });

    const events = res.data.items || [];
    return events.map(event => ({
      text: formatCalendarEvent(event),
      type: 'calendar',
      priority: classifyCalendarPriority(event),
      source: 'Google Calendar',
    })).filter(n => !isDuplicate(n.text));
  } catch (err) {
    console.error('[AmbientOS Calendar] Error:', err.message);
    return [];
  }
}

// ─────────────────────────────────────────────────────────
// Gmail — Unread Important Emails
// ─────────────────────────────────────────────────────────
async function fetchGmailNotifications(auth) {
  try {
    const gmail = google.gmail({ version: 'v1', auth });

    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread is:inbox newer_than:1d',
      maxResults: 5,
    });

    const messages = listRes.data.messages || [];
    const notifications = [];

    for (const msg of messages) {
      const detail = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject'],
      });
      const text = formatEmail(detail.data);
      const priority = classifyEmailPriority(detail.data);
      if (!isDuplicate(text)) {
        notifications.push({ text, type: 'mail', priority, source: 'Gmail' });
      }
    }

    return notifications;
  } catch (err) {
    console.error('[AmbientOS Gmail] Error:', err.message);
    return [];
  }
}

// ─────────────────────────────────────────────────────────
// YouTube — New Uploads from Subscriptions (Quota-Optimized)
// ─────────────────────────────────────────────────────────
async function fetchYouTubeNotifications(auth) {
  try {
    const youtube = google.youtube({ version: 'v3', auth });
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // last 24h

    // Get subscription channels (Costs 1 unit)
    const subsRes = await youtube.subscriptions.list({
      part: ['snippet'],
      mine: true,
      maxResults: 10,
    });

    const channels = (subsRes.data.items || []).map(s => s.snippet?.resourceId?.channelId).filter(Boolean);

    const notifications = [];

    // Check each channel's latest upload using playlistItems.list (Costs only 1 unit per channel instead of 100 units for search!)
    for (const channelId of channels.slice(0, 5)) {
      const playlistId = channelId.replace(/^UC/, 'UU'); // UU is the upload playlist ID convention

      const playlistRes = await youtube.playlistItems.list({
        part: ['snippet'],
        playlistId,
        maxResults: 1,
      });

      const items = playlistRes.data.items || [];
      for (const item of items) {
        const publishedAt = new Date(item.snippet?.publishedAt);
        if (publishedAt > cutoff) {
          const text = formatYouTubeVideo(item);
          if (!isDuplicate(text)) {
            notifications.push({ text, type: 'youtube', priority: 'low', source: 'YouTube' });
          }
        }
      }
    }

    return notifications;
  } catch (err) {
    console.error('[AmbientOS YouTube] Error:', err.message);
    return [];
  }
}

// ─────────────────────────────────────────────────────────
// Demo Notifications (fallback when not authenticated)
// ─────────────────────────────────────────────────────────
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

let demoIndex = 0;
function getNextDemoNotification() {
  const n = DEMO_NOTIFICATIONS[demoIndex % DEMO_NOTIFICATIONS.length];
  demoIndex++;
  return n;
}

// ─────────────────────────────────────────────────────────
// Main fetch orchestrator
// ─────────────────────────────────────────────────────────
async function fetchAllNotifications(auth) {
  const [calendar, gmail, youtube] = await Promise.all([
    fetchCalendarNotifications(auth),
    fetchGmailNotifications(auth),
    fetchYouTubeNotifications(auth),
  ]);

  // Interleave notifications by priority: urgent first
  const all = [...calendar, ...gmail, ...youtube];
  all.sort((a, b) => {
    const order = { urgent: 0, medium: 1, low: 2 };
    return (order[a.priority] || 2) - (order[b.priority] || 2);
  });

  return all;
}

module.exports = {
  fetchAllNotifications,
  getNextDemoNotification,
  DEMO_NOTIFICATIONS,
};
