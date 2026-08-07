// server/utils/errorResponse.js
const constants = require('../config/constants');

const sendError = (res, statusCode = 500, message = 'Internal server error', details = null) => {
  const response = {
    success: false,
    error: message,
    ...(details && { details })
  };
  
  // Log detailed error server-side only
  if (details && process.env.NODE_ENV !== 'production') {
    console.error('[ERROR]', message, details);
  }
  
  res.status(statusCode).json(response);
};

const sendValidationError = (res, message, field = null) => {
  sendError(res, 400, message, field ? { field } : null);
};

const sendAuthError = (res, message = 'Authentication required') => {
  sendError(res, 401, message);
};

const sendForbiddenError = (res, message = 'Access denied') => {
  sendError(res, 403, message);
};

const sendSuccess = (res, data, message = 'Success', statusCode = 200) => {
  res.status(statusCode).json({
    success: true,
    message,
    ...data
  });
};

const sendPaginatedResponse = (res, data, pagination) => {
  sendSuccess(res, {
    data,
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalItems: pagination.totalItems,
      totalPages: pagination.totalPages,
      hasNext: pagination.page < pagination.totalPages,
      hasPrev: pagination.page > 1
    }
  }, 'Success');
};

module.exports = {
  sendError,
  sendValidationError,
  sendAuthError,
  sendForbiddenError,
  sendSuccess,
  sendPaginatedResponse
};
