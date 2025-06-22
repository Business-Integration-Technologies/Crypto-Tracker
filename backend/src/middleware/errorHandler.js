const mongoose = require('mongoose');

// Error handler middleware
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  console.error('Error Stack:', err.stack);
  console.error('Error Details:', {
    name: err.name,
    message: err.message,
    status: err.statusCode,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?._id,
    timestamp: new Date().toISOString()
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Invalid resource ID format';
    error = { statusCode: 400, message };
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    const message = `${field.charAt(0).toUpperCase() + field.slice(1)} '${value}' already exists`;
    error = { statusCode: 400, message };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(error => error.message).join(', ');
    error = { statusCode: 400, message };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid authentication token';
    error = { statusCode: 401, message };
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Authentication token has expired';
    error = { statusCode: 401, message };
  }

  // Crypto service errors
  if (err.message.includes('CoinGecko')) {
    const message = 'Cryptocurrency data service temporarily unavailable';
    error = { statusCode: 503, message };
  }

  // Rate limit errors
  if (err.message.includes('rate limit')) {
    const message = 'Too many requests, please try again later';
    error = { statusCode: 429, message };
  }

  // Network/External API errors
  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    const message = 'External service unavailable';
    error = { statusCode: 503, message };
  }

  // Database connection errors
  if (err.name === 'MongoNetworkError') {
    const message = 'Database connection error';
    error = { statusCode: 503, message };
  }

  // File upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    const message = 'File size too large';
    error = { statusCode: 413, message };
  }

  // Twilio SMS errors
  if (err.code && err.code.toString().startsWith('21')) {
    const message = 'SMS service error';
    error = { statusCode: 503, message };
  }

  // SendGrid email errors
  if (err.code && (err.code === 401 || err.code === 403)) {
    const message = 'Email service configuration error';
    error = { statusCode: 503, message };
  }

  // Redis connection errors
  if (err.message.includes('Redis') || err.code === 'ECONNREFUSED') {
    console.warn('Redis connection error, continuing without cache');
    // Don't expose Redis errors to users
    const message = 'Service temporarily degraded';
    error = { statusCode: 503, message };
  }

  // Default error response
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal server error';

  // Construct error response
  const errorResponse = {
    success: false,
    error: {
      message: message,
      status: statusCode
    }
  };

  // Add error details in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error.stack = err.stack;
    errorResponse.error.name = err.name;
    
    // Add request details
    errorResponse.request = {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
      params: req.params,
      query: req.query
    };
  }

  // Add error ID for tracking
  const errorId = generateErrorId();
  errorResponse.error.id = errorId;

  // Log error for monitoring
  logError({
    id: errorId,
    name: err.name,
    message: err.message,
    stack: err.stack,
    statusCode: statusCode,
    request: {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?._id
    },
    timestamp: new Date().toISOString()
  });

  res.status(statusCode).json(errorResponse);
};

// Not found middleware
const notFound = (req, res, next) => {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

// Async error wrapper
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Custom error class
class CustomError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.name = this.constructor.name;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Specific error classes
class ValidationError extends CustomError {
  constructor(message) {
    super(message, 400);
  }
}

class AuthenticationError extends CustomError {
  constructor(message = 'Authentication required') {
    super(message, 401);
  }
}

class AuthorizationError extends CustomError {
  constructor(message = 'Access denied') {
    super(message, 403);
  }
}

class NotFoundError extends CustomError {
  constructor(message = 'Resource not found') {
    super(message, 404);
  }
}

class ConflictError extends CustomError {
  constructor(message = 'Resource conflict') {
    super(message, 409);
  }
}

class RateLimitError extends CustomError {
  constructor(message = 'Rate limit exceeded') {
    super(message, 429);
  }
}

class ServiceUnavailableError extends CustomError {
  constructor(message = 'Service temporarily unavailable') {
    super(message, 503);
  }
}

// Generate unique error ID
const generateErrorId = () => {
  return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Log error to external service (placeholder)
const logError = (errorDetails) => {
  // In production, you would send this to a logging service like:
  // - Sentry
  // - LogRocket
  // - DataDog
  // - CloudWatch
  
  console.error('Error logged:', {
    ...errorDetails,
    environment: process.env.NODE_ENV,
    service: 'cryptoalert-backend'
  });

  // Example: Send to Sentry
  // if (process.env.SENTRY_DSN) {
  //   Sentry.captureException(new Error(errorDetails.message), {
  //     extra: errorDetails
  //   });
  // }
};

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  logError({
    id: generateErrorId(),
    name: 'UncaughtException',
    message: err.message,
    stack: err.stack,
    type: 'uncaughtException',
    timestamp: new Date().toISOString()
  });
  
  // Exit the process
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  logError({
    id: generateErrorId(),
    name: 'UnhandledRejection',
    message: reason?.message || 'Unhandled promise rejection',
    stack: reason?.stack,
    type: 'unhandledRejection',
    promise: promise.toString(),
    timestamp: new Date().toISOString()
  });
  
  // Close server gracefully
  server.close(() => {
    process.exit(1);
  });
});

// Validation helper function
const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      const message = error.details.map(detail => detail.message).join(', ');
      return next(new ValidationError(message));
    }
    next();
  };
};

// Error response helper
const sendErrorResponse = (res, statusCode, message, details = {}) => {
  const response = {
    success: false,
    error: {
      message,
      status: statusCode,
      ...details
    }
  };

  if (process.env.NODE_ENV === 'development') {
    response.error.timestamp = new Date().toISOString();
  }

  res.status(statusCode).json(response);
};

module.exports = {
  errorHandler,
  notFound,
  asyncHandler,
  CustomError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ServiceUnavailableError,
  validateRequest,
  sendErrorResponse,
  logError
}; 