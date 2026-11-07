'use strict';

/**
 * HTTP security headers on every response.
 *
 * The Content-Security-Policy lets the browser run only this site's own
 * scripts, the one inline script in index.html (allowed by its hash, worked
 * out when the server starts so an edit cannot silently break it) and
 * Google's sign-in script. Even if some text slipped past esc() into a page,
 * the browser would refuse to run it. Inline styles stay allowed because the
 * pages use style attributes; styles cannot run code.
 *
 * The other headers stop the site being framed (clickjacking) or sniffed as
 * another content type, keep full addresses out of the Referer sent to other
 * sites, switch off browser features the shop never uses, and on HTTPS tell
 * the browser to use HTTPS from then on.
 *
 * The payment pages in routes/payments.js send their own, narrower policy.
 *
 * References:
 *  - OWASP. HTTP Security Response Headers Cheat Sheet.
 *    https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html
 *  - Google. Content Security Policy for Sign in with Google.
 *    https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid#content_security_policy
 */

const crypto = require('node:crypto');
const fs = require('node:fs');

/** The CSP hash of every inline <script> block in a page. */
function inlineScriptHashes(file) {
  const html = fs.readFileSync(file, 'utf8');
  return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
    .map((m) => `'sha256-${crypto.createHash('sha256').update(m[1]).digest('base64')}'`);
}

function securityHeaders({ indexHtml }) {
  const policy = [
    "default-src 'self'",
    `script-src 'self' ${inlineScriptHashes(indexHtml).join(' ')} https://accounts.google.com/gsi/client`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com/gsi/style",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https://*.googleusercontent.com",
    "connect-src 'self' https://accounts.google.com/gsi/",
    "frame-src https://accounts.google.com/gsi/",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; ');

  return (req, res, next) => {
    res.set({
      'Content-Security-Policy': policy,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
      // Google's sign-in opens a popup that must be able to report back.
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    });
    if (req.secure) res.set('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
    next();
  };
}

module.exports = { securityHeaders, inlineScriptHashes };
