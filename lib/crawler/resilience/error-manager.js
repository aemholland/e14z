/**
 * Production-Grade Error Management System
 * Based on 2025 Node.js Best Practices
 */

class AppError extends Error {
  constructor(name, httpCode, description, isOperational) {
    super(description);
    Object.setPrototypeOf(this, new.target.prototype);
    
    this.name = name;
    this.httpCode = httpCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    
    Error.captureStackTrace(this);
  }
}

class ErrorHandler {
  constructor() {
    this.setupGlobalHandlers();
    this.stats = {
      operational: 0,
      critical: 0,
      recoverable: 0
    };
  }

  setupGlobalHandlers() {
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('🚨 Uncaught Exception:', error);
      this.handleError(error);
      if (!this.isTrustedError(error)) {
        console.error('💥 Process exiting due to untrusted error');
        process.exit(1);
      }
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
      throw reason; // Convert to uncaught exception
    });

    // Graceful shutdown on SIGTERM/SIGINT
    process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
  }

  async handleError(error, responseStream = null) {
    try {
      await this.logError(error);
      await this.updateMetrics(error);
      await this.notifyIfCritical(error);
      
      if (responseStream) {
        this.sendErrorResponse(error, responseStream);
      }
    } catch (handlingError) {
      console.error('Error in error handler:', handlingError);
    }
  }

  async logError(error) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      name: error.name,
      message: error.message,
      stack: error.stack,
      isOperational: error.isOperational,
      httpCode: error.httpCode,
      userId: error.userId,
      url: error.url,
      method: error.method
    };

    console.error('📝 Error Log:', JSON.stringify(logEntry, null, 2));
  }

  async updateMetrics(error) {
    if (error.isOperational) {
      this.stats.operational++;
    } else {
      this.stats.critical++;
    }
  }

  async notifyIfCritical(error) {
    if (!error.isOperational && error.httpCode >= 500) {
      console.error('🚨 Critical error detected:', error.message);
      // In production: send to monitoring service, email alerts, etc.
    }
  }

  isTrustedError(error) {
    if (error instanceof AppError) {
      return error.isOperational;
    }
    return false;
  }

  sendErrorResponse(error, res) {
    if (res && !res.headersSent) {
      const statusCode = error.httpCode || 500;
      res.status(statusCode).json({
        error: {
          message: error.isOperational ? error.message : 'Internal server error',
          code: error.name,
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  gracefulShutdown(signal) {
    console.log(`🔄 Received ${signal}. Starting graceful shutdown...`);
    
    // Give processes time to finish
    setTimeout(() => {
      console.log('💤 Graceful shutdown complete');
      process.exit(0);
    }, 5000);
  }

  getStats() {
    return { ...this.stats };
  }
}

// Common error types
const ErrorTypes = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
  AUTH_ERROR: 'AUTH_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  PARSING_ERROR: 'PARSING_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  CIRCUIT_BREAKER_OPEN: 'CIRCUIT_BREAKER_OPEN'
};

const createOperationalError = (type, message, details = {}) => {
  return new AppError(type, 500, message, true, details);
};

const createCriticalError = (type, message, details = {}) => {
  return new AppError(type, 500, message, false, details);
};

module.exports = {
  ErrorHandler,
  AppError,
  ErrorTypes,
  createOperationalError,
  createCriticalError,
  handler: new ErrorHandler()
};