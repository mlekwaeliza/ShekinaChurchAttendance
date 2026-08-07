// server/config/constants.js
module.exports = {
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: 100,
  AUTH_RATE_LIMIT_MAX: 5,
  EXPORT_RATE_LIMIT_MAX: 10,
  
  // Session & Security
  SESSION_MAX_AGE: 24 * 60 * 60 * 1000, // 24 hours
  BCRYPT_ROUNDS: 10,
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION_MINUTES: 30,
  
  // Upload Limits
  MAX_FILE_SIZE: 2 * 1024 * 1024, // 2MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  
  // Pagination
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  
  // Timeouts
  SERVER_TIMEOUT: 30000, // 30s
  KEEP_ALIVE_TIMEOUT: 5000, // 5s
  HEADERS_TIMEOUT: 10000, // 10s
  
  // Array Limits
  MAX_ARRAY_LENGTH: 1000,
  MAX_BULK_OPERATIONS: 100
};
