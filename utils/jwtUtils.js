const jwt = require('jsonwebtoken');

// Access & Refresh token helpers
// Access tokens: short lived (e.g. 15m)
// Refresh tokens: longer lived (e.g. 7d)
// Password reset / one-off: very short (e.g. 10m)

const ACCESS_TOKEN_TTL = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const PASSWORD_RESET_TTL = process.env.JWT_PASSWORD_RESET_EXPIRES_IN || '10m';

if (!process.env.JWT_ACCESS_SECRET) {
  console.warn('[jwtUtils] Missing JWT_ACCESS_SECRET env var. Using insecure fallback for development.');
}
if (!process.env.JWT_PASSWORD_RESET_SECRET) {
  console.warn('[jwtUtils] Missing JWT_PASSWORD_RESET_SECRET env var. Using insecure fallback for development.');
}

const signAccessToken = (payload, opts = {}) => {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET || 'dev_access_secret', {
    expiresIn: ACCESS_TOKEN_TTL,
    ...opts
  });
};


const signPasswordResetToken = (payload, opts = {}) => {
  return jwt.sign(payload, process.env.JWT_PASSWORD_RESET_SECRET || 'dev_pw_reset_secret', {
    expiresIn: PASSWORD_RESET_TTL,
    ...opts
  });
};

const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET || 'dev_access_secret');
};


const verifyPasswordResetToken = (token) => {
  return jwt.verify(token, process.env.JWT_PASSWORD_RESET_SECRET || 'dev_pw_reset_secret');
};

module.exports = {
  signAccessToken,
  signPasswordResetToken,
  verifyAccessToken,
  verifyPasswordResetToken
};
