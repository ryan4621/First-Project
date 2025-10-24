import pool from "../main.js";
import cron from 'node-cron';
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

// Middleware to update session activity (add this before your routes)
export const updateSessionActivity = async (req, res, next) => {
  const token = req.cookies.authToken;
  if (token && 
    req.path !== '/login' && 
    req.path !== '/logout' && 
    req.path !== '/register' &&
    req.method === 'GET') {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      await pool.execute(
        "UPDATE user_sessions SET last_active = NOW() WHERE user_id = ? AND session_token LIKE ?",
        [decoded.id, token.substring(0, 50) + '%']
      );
    } catch (err) {
      // Ignore errors in session updates
    }
  }
  next();
};

// export const updateSessionActivity = async (req, res, next) => {
//   const token = req.cookies.authToken;

//   if (
//     token &&
//     req.path !== '/login' &&
//     req.path !== '/logout' &&
//     req.path !== '/register' &&
//     req.method === 'GET'
//   ) {
//     try {
//       const decoded = jwt.verify(token, process.env.JWT_SECRET);
//       const [[session]] = await pool.execute(
//         `SELECT * FROM user_sessions 
//          WHERE user_id = ? 
//          AND session_token LIKE ? 
//          AND device_id = ?`,
//         [decoded.id, token.substring(0, 50) + '%', req.deviceId]
//       );

//       // ❌ Session no longer exists (e.g., deleted on same device)
//       if (!session) {
//         res.clearCookie('authToken');
//         return res.redirect('/login');
//       }

//       // ✅ Session exists — update last active
//       await pool.execute(
//         'UPDATE user_sessions SET last_active = NOW() WHERE id = ?',
//         [session.id]
//       );
//     } catch (err) {
//       res.clearCookie('authToken');
//       return res.redirect('/login');
//     }
//   }

//   next();
// };

export const setupScheduledTasks = () => {
  // Clean up expired sessions every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    try {
      const [result] = await pool.execute(
        "DELETE FROM user_sessions WHERE expires_at < NOW()"
      );
      console.log(`✅ Cleaned up ${result.affectedRows} expired sessions`);
    } catch (err) {
      console.error('❌ Session cleanup failed:', err);
    }
  });

  // Clean up expired pending registrations every hour
  cron.schedule('0 * * * *', async () => {
    try {
      const [result] = await pool.execute(
        "DELETE FROM pending_registrations WHERE verification_token_expires < NOW()"
      );
      console.log(`✅ Cleaned up ${result.affectedRows} expired pending registrations`);
    } catch (err) {
      console.error('❌ Pending registrations cleanup failed:', err);
    }
  });

  // Clean up old error logs (keep last 90 days) - runs daily at 2 AM
  cron.schedule('0 2 * * *', async () => {
    try {
      const [result] = await pool.execute(
        "DELETE FROM error_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY)"
      );
      console.log(`✅ Cleaned up ${result.affectedRows} old error logs`);
    } catch (err) {
      console.error('❌ Error logs cleanup failed:', err);
    }
  });

  console.log('✅ All scheduled tasks initialized');
};

// Add session management middleware for guest carts
export const guestSessionHandler =(req, res, next) => {
  // Handle session ID for guest users
  if (!req.cookies.authToken) {
    const sessionId = req.headers['x-session-id'] || 
    req.cookies.sessionId || 
    'sess_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    
    if (!req.cookies.sessionId) {
      res.cookie('sessionId', sessionId, {
        httpOnly: true,
        secure: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'none',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
      });
    }
    req.sessionId = sessionId;
  }
  next();
};