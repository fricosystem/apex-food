'use strict';

function origensPermitidas() {
  return [...new Set([
    process.env.APP_ORIGIN,
    ...(process.env.ALLOWED_ORIGINS || '').split(','),
  ].map((item) => (item || '').trim()).filter(Boolean))];
}

module.exports = { origensPermitidas };
