const jwt = require('jsonwebtoken');

// 30 days access token lifetime (ISO-ish shorthand accepted by jsonwebtoken: '30d')
const ACCESS_TOKEN_TTL = '30d';
const PASSWORD_RESET_TTL = '10m';

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
