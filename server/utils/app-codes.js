'use strict';

/**
 * Single-use codes that carry a Google sign-in from a browser tab back to
 * the Android app.
 *
 * The app signs in with Google through the website, in a browser tab,
 * because Google's on-phone sign-in needs the app registered separately in
 * Google Cloud. The tab must not hand a session token straight back through
 * an ithrift:// link, because another app could claim that link and read
 * it. So the app sends a challenge (the SHA-256 of a secret it keeps), the
 * tab gets a short-lived code bound to that challenge, and only the app,
 * which holds the secret, can swap the code for a session. This is the
 * idea behind PKCE in OAuth.
 *
 * Reference: Sakimura, N., Bradley, J. and Agarwal, N. 2015. RFC 7636:
 * Proof Key for Code Exchange by OAuth Public Clients. IETF.
 */
const crypto = require('crypto');

const TTL_MS = 5 * 60 * 1000;
const codes = new Map(); // code -> { user, challenge, expires }

const base64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** A challenge is the base64url SHA-256 of the app's secret: 43 characters. */
function isChallenge(value) {
  return /^[A-Za-z0-9_-]{43}$/.test(String(value || ''));
}

function challengeFor(verifier) {
  return base64url(crypto.createHash('sha256').update(String(verifier || '')).digest());
}

function issue(user, challenge, now = Date.now()) {
  for (const [c, v] of codes) if (v.expires < now) codes.delete(c);
  const code = base64url(crypto.randomBytes(24));
  codes.set(code, { user, challenge, expires: now + TTL_MS });
  return code;
}

/** The signed-in user, or an error message. A code works once only. */
function redeem(code, verifier, now = Date.now()) {
  const entry = code ? codes.get(String(code)) : null;
  if (!entry || entry.expires < now) {
    if (entry) codes.delete(String(code));
    return { error: 'That Google sign-in has expired. Please try again.' };
  }
  if (challengeFor(verifier) !== entry.challenge) {
    return { error: 'That Google sign-in did not start on this phone. Please try again.' };
  }
  codes.delete(String(code));
  return { user: entry.user };
}

module.exports = { isChallenge, challengeFor, issue, redeem, TTL_MS };
