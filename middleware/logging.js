import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure logs directory exists
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Log file paths
const logFiles = {
  error: path.join(logsDir, 'error.log'),
  access: path.join(logsDir, 'access.log'),
  security: path.join(logsDir, 'security.log'),
  address: path.join(logsDir, 'address.log')
};

// Helper function to write logs
const writeLog = (file, level, message, meta = {}) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...meta
  };
  
  const logLine = JSON.stringify(logEntry) + '\n';
  
  fs.appendFile(file, logLine, (err) => {
    if (err) console.error('Failed to write log:', err);
  });
};

// Logging functions
export const logger = {
  error: (message, meta = {}) => {
    console.error(`[ERROR] ${message}`, meta);
    writeLog(logFiles.error, 'ERROR', message, meta);
  },
  
  warn: (message, meta = {}) => {
    console.warn(`[WARN] ${message}`, meta);
    writeLog(logFiles.error, 'WARN', message, meta);
  },
  
  info: (message, meta = {}) => {
    console.log(`[INFO] ${message}`, meta);
    writeLog(logFiles.access, 'INFO', message, meta);
  },
  
  security: (message, meta = {}) => {
    console.warn(`[SECURITY] ${message}`, meta);
    writeLog(logFiles.security, 'SECURITY', message, meta);
  },
  
  address: (operation, userId, addressId = null, meta = {}) => {
    const message = `Address ${operation}`;
    const logMeta = {
      operation,
      userId,
      addressId,
      ...meta
    };
    console.log(`[ADDRESS] ${message}`, logMeta);
    writeLog(logFiles.address, 'INFO', message, logMeta);
  }
};

// Request logging middleware
export const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id || null
    };
    
    if (res.statusCode >= 400) {
      logger.error('Request failed', logData);
    } else {
      logger.info('Request completed', logData);
    }
  });
  
  next();
};

// Security event logging
export const securityLogger = (req, res, next) => {
  // Log suspicious activities
  if (req.statusCode >= 400 && req.statusCode < 500) {
    logger.security('Client error', {
      method: req.method,
      url: req.url,
      status: req.statusCode,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    });
  }
  
  next();
};
