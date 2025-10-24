// utils/error-logger.js

import pool from "../main.js";
import { sendCriticalErrorAlert } from "../services/email-service.js";

/**
 * Log error to database and send alert if critical
 * @param {Error} error - The error object
 * @param {Object} context - Additional context (req, user, etc.)
 * @param {string} severity - 'low', 'medium', 'high', 'critical'
 */
export async function logError(error, context = {}, severity = 'medium') {
  try {
    const {
      req = null,
      user = null,
      additionalData = null
    } = context;

    // Extract error details
    const errorType = error.name || 'Error';
    const errorMessage = error.message || 'Unknown error';
    const stackTrace = error.stack || null;

    // Extract request details
    let requestMethod = null;
    let requestPath = null;
    let requestBody = null;
    let requestQuery = null;
    let requestParams = null;
    let ipAddress = null;
    let userAgent = null;
    let statusCode = null;

    if (req) {
      requestMethod = req.method;
      requestPath = req.path || req.url;
      requestBody = sanitizeRequestBody(req.body);
      requestQuery = req.query;
      requestParams = req.params;
      ipAddress = req.ip || req.connection?.remoteAddress;
      userAgent = req.get('user-agent');
      statusCode = req.statusCode || error.statusCode || 500;
    }

    // Extract user details
    let userId = null;
    let userEmail = null;
    let userRole = null;

    if (user) {
      userId = user.id;
      userEmail = user.email;
      userRole = user.role;
    } else if (req?.user) {
      userId = req.user.id;
      userEmail = req.user.email;
      userRole = req.user.role;
    }

    // If we have userId but no email, fetch from database
    if (userId && !userEmail) {
      try {
        const [users] = await pool.execute(
          'SELECT email, role FROM users WHERE id = ?',
          [userId]
        );
        if (users.length > 0) {
          userEmail = users[0].email;
          userRole = userRole || users[0].role;
        }
      } catch (dbError) {
        console.error('Failed to fetch user details:', dbError);
      }
    }

    // Insert error log
    const [result] = await pool.execute(
      `INSERT INTO error_logs (
        error_type, error_message, stack_trace, severity,
        request_method, request_path, request_body, request_query, request_params,
        user_id, user_email, user_role,
        ip_address, user_agent, status_code,
        additional_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        errorType,
        errorMessage,
        stackTrace || null,
        severity,
        requestMethod || null,
        requestPath || null,
        requestBody ? JSON.stringify(requestBody) : null,
        requestQuery ? JSON.stringify(requestQuery) : null,
        requestParams ? JSON.stringify(requestParams) : null,
        userId || null,
        userEmail || null,
        userRole || null,
        ipAddress || null,
        userAgent || null,
        statusCode || null,
        additionalData ? JSON.stringify(additionalData) : null
      ]
    );

    const errorId = result.insertId;

    // Send email alert for critical errors
    if (severity === 'critical') {
      await sendCriticalErrorAlert({
        errorId,
        errorType,
        errorMessage,
        requestPath,
        userId,
        userEmail,
        timestamp: new Date()
      });
    }

    console.error(`[ERROR LOGGED] ID: ${errorId}, Severity: ${severity}, Type: ${errorType}, Message: ${errorMessage}`);

    return errorId;
  } catch (loggingError) {
    // If error logging fails, at least log to console
    console.error('❌ Failed to log error to database:', loggingError);
    console.error('Original error:', error);
  }
}

/**
 * Sanitize request body to remove sensitive data
 */
function sanitizeRequestBody(body) {
  if (!body) return null;

  const sanitized = { ...body };
  
  // Remove sensitive fields
  const sensitiveFields = [
    'password',
    'newPassword',
    'oldPassword',
    'confirmPassword',
    'token',
    'authToken',
    'accessToken',
    'refreshToken',
    'apiKey',
    'secret',
    'creditCard',
    'cvv',
    'ssn'
  ];

  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });

  return sanitized;
}

/**
 * Determine error severity based on error type and status code
 */
export function determineSeverity(error, statusCode) {
  // Critical errors
  if (error.name === 'DatabaseError' || error.code === 'ECONNREFUSED') {
    return 'critical';
  }
  if (statusCode >= 500) {
    return 'high';
  }

  // High severity
  if (error.name === 'UnauthorizedError' || error.name === 'SecurityError') {
    return 'high';
  }

  // Medium severity
  if (statusCode >= 400 && statusCode < 500) {
    return 'medium';
  }

  // Low severity
  return 'low';
}

/**
 * Wrapper for try-catch blocks with automatic logging
 * Usage: await tryCatch(async () => { your code }, req, 'Operation description')
 */
export async function tryCatch(fn, req = null, operation = 'Unknown operation') {
  try {
    return await fn();
  } catch (error) {
    const severity = determineSeverity(error, error.statusCode || 500);
    await logError(error, { 
      req,
      additionalData: { operation }
    }, severity);
    throw error; // Re-throw to let the caller handle it
  }
}

/**
 * Get super admin emails for critical alerts
 */
async function getSuperAdminEmails() {
  try {
    const [admins] = await pool.execute(
      'SELECT email, name FROM users WHERE role = "super_admin" AND deleted_at IS NULL'
    );
    return admins;
  } catch (error) {
    console.error('Failed to get super admin emails:', error);
    return [];
  }
}

export default {
  logError,
  determineSeverity,
  tryCatch
};