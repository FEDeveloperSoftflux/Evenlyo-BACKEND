const jwt = require('jsonwebtoken');

// Centralized JWT helper (access + password reset) – refresh tokens removed.

const {
  JWT_ACCESS_SECRET,
  JWT_PASSWORD_RESET_SECRET,
  JWT_ACCESS_EXPIRES_IN = '15m',
  JWT_PASSWORD_RESET_EXPIRES_IN = '10m',
  NODE_ENV
} = process.env;

// Basic hardening: require strong secrets in production.
function ensureSecret(name, value) {
  if (!value) {
    if (NODE_ENV === 'production') {
      throw new Error(`[jwtUtils] Required secret ${name} missing in production.`);
    } else {
      console.warn(`[jwtUtils] Missing ${name}. Using insecure development fallback.`);
    }
  } else if (value.length < 24) {
    console.warn(`[jwtUtils] ${name} is shorter than 24 chars. Consider strengthening it.`);
  }
}

ensureSecret('JWT_ACCESS_SECRET', JWT_ACCESS_SECRET);
ensureSecret('JWT_PASSWORD_RESET_SECRET', JWT_PASSWORD_RESET_SECRET);

const accessSecret = JWT_ACCESS_SECRET || 'dev_access_secret';
const resetSecret  = JWT_PASSWORD_RESET_SECRET || 'dev_pw_reset_secret';
const ALG = 'HS256';

// Generic helpers
const sign = (payload, secret, expiresIn, extraOpts = {}) =>
  jwt.sign(payload, secret, { algorithm: ALG, expiresIn, ...extraOpts });
const verify = (token, secret) => jwt.verify(token, secret, { algorithms: [ALG] });

// Public API
const signAccessToken = (payload, opts = {}) =>
  sign(payload, accessSecret, JWT_ACCESS_EXPIRES_IN, opts);
const verifyAccessToken = (token) => verify(token, accessSecret);

const signPasswordResetToken = (payload, opts = {}) =>
  sign(payload, resetSecret, JWT_PASSWORD_RESET_EXPIRES_IN, opts);
const verifyPasswordResetToken = (token) => verify(token, resetSecret);

module.exports = {
  signAccessToken,
  verifyAccessToken,
  signPasswordResetToken,
  verifyPasswordResetToken
};
