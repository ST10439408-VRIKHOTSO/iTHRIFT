'use strict';

/**
 * Single sign-on: verifying a Google ID token.
 *
 * The Android app never sends us a password for an SSO customer. It sends
 * the ID token that Google issued to it, and this module decides whether
 * that token is genuine. Doing the check here rather than in the client is
 * the whole point: anything the phone tells us about who the user is can be
 * forged, so the phone is only ever a courier for a token that Google
 * signed and that we verify against Google.
 *
 * Verification uses Google's tokeninfo endpoint, which checks the RSA
 * signature, the issuer and the expiry for us. That keeps the prototype
 * dependency-free (no JWT library) while still doing a real check. We then
 * confirm the audience ourselves, because a validly signed token issued to
 * *someone else's* application must not be accepted here.
 *
 * Reference: Google. 2025. Authenticate with a backend server.
 * https://developers.google.com/identity/gsi/web/guides/verify-google-id-token
 */

const https = require('node:https');

const TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';
const VALID_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);

/**
 * The OAuth client IDs this API will accept tokens for. Set
 * GOOGLE_CLIENT_ID (comma-separated if the Android and web clients differ)
 * in the environment. When it is not set, single sign-on is switched off
 * rather than left open: an unconfigured server must not accept tokens
 * minted for any application at all.
 */
function allowedAudiences() {
  return (process.env.GOOGLE_CLIENT_ID || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function isSsoConfigured() {
  return allowedAudiences().length > 0;
}

/**
 * GETs a URL and resolves to { status, body }.
 *
 * This uses node:https rather than fetch, with a ten-second timeout. Node's
 * fetch tries each address of a host for only a quarter of a second before
 * moving on, which is too impatient on a slow connection and made a genuine
 * sign-in fail with nothing more than "fetch failed". `family` picks IPv4 (4)
 * or lets the system decide (0).
 */
function httpsGet(url, family) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { family, timeout: 10000, headers: { Accept: 'application/json' } }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, body }));
    });
    request.on('timeout', () => request.destroy(Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' })));
    request.on('error', reject);
  });
}

/** Asks Google about a token: IPv4 first, then whatever the system prefers. */
async function askGoogle(url) {
  try {
    return await httpsGet(url, 4);
  } catch (firstError) {
    console.warn('[sso] could not reach Google over IPv4:', firstError.code || firstError.message);
    return httpsGet(url, 0);
  }
}

/**
 * Verifies a Google ID token and returns the identity it carries.
 *
 * Resolves to { subject, email, firstName, lastName } on success, or
 * throws an Error whose message is safe to show a user. The caller decides
 * what to do with the identity; this function only answers "is this really
 * who the phone says it is?".
 */
async function verifyGoogleIdToken(idToken, { get = askGoogle } = {}) {
  const audiences = allowedAudiences();
  if (audiences.length === 0) {
    throw new Error('Single sign-on is not configured on this server.');
  }
  if (typeof idToken !== 'string' || idToken.length === 0) {
    throw new Error('No sign-in token was supplied.');
  }

  // Two different things can go wrong here and they need different advice:
  // Google can be unreachable from this computer, or Google can say the token
  // is not valid. Neither is a reason to sign anyone in.
  let reply;
  try {
    reply = await get(`${TOKENINFO_URL}?id_token=${encodeURIComponent(idToken)}`);
  } catch (err) {
    console.warn('[sso] could not reach Google to verify a token:', err.code || err.message);
    throw new Error('The server could not reach Google to check that sign-in. Check the internet connection on the computer running the server, then try again.');
  }

  let payload;
  try {
    payload = JSON.parse(reply.body);
  } catch {
    payload = null;
  }
  if (reply.status !== 200 || !payload) {
    const reason = payload && (payload.error_description || payload.error);
    console.warn(`[sso] Google rejected a token (HTTP ${reply.status}):`, reason || 'no reason given');
    throw new Error('Google did not accept that sign-in. Please try again.');
  }

  if (!VALID_ISSUERS.has(payload.iss)) {
    throw new Error('That sign-in token was not issued by Google.');
  }
  if (!audiences.includes(payload.aud)) {
    throw new Error('That sign-in token was issued for a different application.');
  }
  if (Number(payload.exp) * 1000 <= Date.now()) {
    throw new Error('That sign-in has expired. Please sign in again.');
  }
  // An unverified address would let anyone claim an account by signing up to
  // Google with someone else's email and never proving they own it.
  if (payload.email_verified !== true && payload.email_verified !== 'true') {
    throw new Error('Your Google email address has not been verified.');
  }
  if (!payload.email || !payload.sub) {
    throw new Error('That Google account did not share an email address.');
  }

  const given = (payload.given_name || '').trim();
  const family = (payload.family_name || '').trim();
  const fallback = (payload.name || payload.email.split('@')[0]).trim();

  return {
    subject: String(payload.sub),
    email: String(payload.email).toLowerCase(),
    firstName: given || fallback.split(' ')[0] || 'Customer',
    lastName: family || fallback.split(' ').slice(1).join(' ') || 'Account',
  };
}

module.exports = { verifyGoogleIdToken, isSsoConfigured, allowedAudiences };
