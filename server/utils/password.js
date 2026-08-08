'use strict';

const crypto = require('node:crypto');

const KEY_LEN = 64;

/**
 * Hashes a plaintext password with a random salt using scrypt.
 * Returns { hash, salt } both as hex strings, ready to store in the database.
 * Passwords are never stored in plain text - this satisfies the
 * "security of credentials" non-functional requirement in the System Design.
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, KEY_LEN).toString('hex');
  return { hash, salt };
}

/**
 * Verifies a plaintext password against a stored salted hash.
 * Uses a constant-time comparison to avoid timing attacks.
 */
function verifyPassword(password, salt, expectedHashHex) {
  const candidate = crypto.scryptSync(password, salt, KEY_LEN);
  const expected = Buffer.from(expectedHashHex, 'hex');
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

/**
 * Minimum password policy: at least 8 characters, one uppercase letter,
 * one number. Matches the non-functional requirement in the System Design
 * and Prototype Documentation.
 */
function isPasswordStrong(password) {
  if (typeof password !== 'string' || password.length < 8) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  return true;
}

module.exports = { hashPassword, verifyPassword, isPasswordStrong };
