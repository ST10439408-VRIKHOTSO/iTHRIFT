'use strict';

/**
 * HTTPS calls to the payment providers.
 *
 * This uses node:https rather than fetch, for the reason given in
 * utils/sso.js: fetch gives each address of a host only a quarter of a
 * second, which is too impatient on a slow connection. IPv4 is tried first,
 * then whatever the system prefers.
 *
 * Resolves to { status, body, json } for any HTTP status, so each provider
 * decides what a 4xx means. It throws only when the provider cannot be
 * reached at all.
 */

const https = require('node:https');

function once(url, { method = 'GET', headers = {}, body } = {}, family) {
  return new Promise((resolve, reject) => {
    const sent = body == null ? null : String(body);
    const request = https.request(url, {
      method,
      family,
      timeout: 15000,
      headers: { Accept: 'application/json', ...headers, ...(sent == null ? {} : { 'Content-Length': Buffer.byteLength(sent) }) },
    }, (response) => {
      let text = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { text += chunk; });
      response.on('end', () => {
        let json = null;
        try { json = JSON.parse(text); } catch { /* not JSON, e.g. PayFast's VALID */ }
        resolve({ status: response.statusCode, body: text, json });
      });
    });
    request.on('timeout', () => request.destroy(Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' })));
    request.on('error', reject);
    if (sent != null) request.write(sent);
    request.end();
  });
}

async function request(url, options) {
  try {
    return await once(url, options, 4);
  } catch (firstError) {
    console.warn(`[payments] could not reach ${new URL(url).host} over IPv4:`, firstError.code || firstError.message);
    return once(url, options, 0);
  }
}

module.exports = { request };
