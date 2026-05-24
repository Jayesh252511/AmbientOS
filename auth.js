/**
 * AmbientOS — auth.js
 * Google OAuth2 manager. One-time consent flow, tokens cached in token.json.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
const TOKEN_PATH = path.join(__dirname, 'token.json');

// Google API scopes required
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/youtube.readonly',
];

/**
 * Load OAuth2 credentials from file.
 */
function loadCredentials() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error('credentials.json not found. Please place it in the project root.');
  }
  const raw = fs.readFileSync(CREDENTIALS_PATH, 'utf8');
  const json = JSON.parse(raw);
  const creds = json.installed || json.web;
  if (!creds) throw new Error('Invalid credentials.json format.');
  return creds;
}

/**
 * Create an authenticated OAuth2 client.
 * If tokens exist, load and return immediately.
 * If not, returns an unauthenticated client (auth flow needed).
 */
function createOAuth2Client() {
  const { client_id, client_secret } = loadCredentials();
  // Use http://localhost:3000/oauth2callback — must be registered in Google Cloud Console
  // For installed/desktop apps Google supports any localhost port.
  const redirectUri = 'http://localhost:3000/oauth2callback';

  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirectUri);

  if (fs.existsSync(TOKEN_PATH)) {
    const tokenRaw = fs.readFileSync(TOKEN_PATH, 'utf8');
    oAuth2Client.setCredentials(JSON.parse(tokenRaw));

    // Auto-refresh handler — save new token when refreshed
    oAuth2Client.on('tokens', (tokens) => {
      const existing = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
      const merged = { ...existing, ...tokens };
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(merged, null, 2));
      console.log('[AmbientOS Auth] Token refreshed and saved.');
    });
  }

  return oAuth2Client;
}

/**
 * Generate the Google consent URL for first-time auth.
 */
function getAuthUrl(oAuth2Client) {
  return oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });
}

/**
 * Exchange authorization code for tokens and save them.
 */
async function exchangeCodeForTokens(oAuth2Client, code) {
  const { tokens } = await oAuth2Client.getToken(code);
  oAuth2Client.setCredentials(tokens);
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
  console.log('[AmbientOS Auth] Tokens saved to token.json');
  return tokens;
}

/**
 * Check if the client is currently authenticated.
 */
function isAuthenticated() {
  return fs.existsSync(TOKEN_PATH);
}

module.exports = {
  createOAuth2Client,
  getAuthUrl,
  exchangeCodeForTokens,
  isAuthenticated,
  SCOPES,
};
