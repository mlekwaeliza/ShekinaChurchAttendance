// server/middleware/inputLimits.js
const constants = require('../config/constants');
const { sendValidationError } = require('../utils/errorResponse');

const limitPayloadSize = (req, res, next) => {
  const contentLength = req.headers['content-length'];
  
  if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) { // 10MB hard limit
    return sendValidationError(req, res, 'Request payload too large');
  }
  
  next();
};

const limitArrayLength = (maxSize = constants.MAX_ARRAY_LENGTH) => {
  return (req, res, next) => {
    if (!req.body || typeof req.body !== 'object') {
      return next();
    }
    
    for (const key in req.body) {
      if (Array.isArray(req.body[key])) {
        if (req.body[key].length > maxSize) {
          return sendValidationError(
            req, 
            res, 
            `Array '${key}' exceeds maximum length of ${maxSize}`,
            { field: key, maxLength: maxSize, actualLength: req.body[key].length }
          );
        }
      }
    }
    
    next();
  };
};

const limitFieldLength = (maxLength = 1000) => {
  return (req, res, next) => {
    if (!req.body || typeof req.body !== 'object') {
      return next();
    }
    
    for (const key in req.body) {
      if (typeof req.body[key] === 'string' && req.body[key].length > maxLength) {
        return sendValidationError(
          req,
          res,
          `Field '${key}' exceeds maximum length of ${maxLength}`,
          { field: key, maxLength }
        );
      }
    }
    
    next();
  };
};

module.exports = {
  limitPayloadSize,
  limitArrayLength,
  limitFieldLength
};
