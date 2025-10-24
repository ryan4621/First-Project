// auth-routes.js

import express from 'express';
import pool from "../main.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { requireAuth } from '../middleware/auth.js';
import crypto from 'crypto';
import { sendNotificationEmail, send2FACodeEmail, sendVerificationEmail } from '../services/email-service.js';
import { body, query, validationResult } from 'express-validator';
import { logUserActivity } from './user-routes.js';
import { validateRegister, validateLogin, validateResendVerification, validate2faVerify, validate2faResend, handleValidationErrors  } from '../middleware/validation.js';
import { checkVerificationCooldown, updateVerificationTimestamp } from '../middleware/email-verification-cooldown.js';

const router = express.Router();

// Register route with email verification
router.post("/register", validateRegister, handleValidationErrors,
  async (req, res) => {
    try {
      const { name, email, password, subscribe } = req.body;
      
      // Check if email already exists in EITHER table
      const [existingUser] = await pool.execute(
        "SELECT id FROM users WHERE email = ?", 
        [email]
      );
      
      if (existingUser.length > 0) {
        return res.status(409).json({ message: "Email already registered" });
      }

      await pool.execute(
        "DELETE FROM pending_registrations WHERE email = ?",
        [email]
      );
      
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Generate verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
      
      // Insert into PENDING table instead of users
      await pool.execute(
        `INSERT INTO pending_registrations 
         (email, name, password_hash, subscribe, verification_token, verification_token_expires) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [email, name, hashedPassword, subscribe || false, verificationToken, tokenExpires]
      );
      
      // Send verification email
      const verificationUrl = `${'https://localhost:3000'}/auth/verify-email?token=${verificationToken}`;
      await sendVerificationEmail(email, name, verificationUrl);
      
      res.status(201).json({ 
        message: "Registration successful! Please check your email to verify your account.",
        email: email
      });
    } catch (err) {
      console.error('Registration error:', err);
      res.status(500).json({ message: "Registration failed. Please try again." });
    }
  }
);
  
// Email verification route - FIXED
router.get("/verify-email",
  [
    query('token')
      .trim()
      .isLength({ min: 64, max: 64 })
      .withMessage('Invalid token format')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty() || !req.query.token) {
      return res.status(400).send(`
        <html>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h2>Invalid Verification Link</h2>
            <p>The verification link is invalid or incomplete.</p>
            <a href="/frontend/farfetch.html">Return to homepage</a>
          </body>
        </html>
      `);
    }

    try {
      const { token } = req.query;

      // FIRST: Check if this token is for a pending registration
      const [pendingUsers] = await pool.execute(
        "SELECT id, email, name, password_hash, subscribe, verification_token_expires FROM pending_registrations WHERE verification_token = ?",
        [token]
      );
      
      if (pendingUsers.length > 0) {
        const pendingUser = pendingUsers[0];
        
        // Check if token expired
        if (new Date() > new Date(pendingUser.verification_token_expires)) {
          await pool.execute(
            "DELETE FROM pending_registrations WHERE id = ?",
            [pendingUser.id]
          );
          
          return res.status(400).send(`
            <html>
              <body style="font-family: Arial; text-align: center; padding: 50px;">
                <h2>Link Expired</h2>
                <p>This verification link has expired. Please register again.</p>
                <a href="/frontend/farfetch.html">Return to homepage</a>
              </body>
            </html>
          `);
        }
        
        // Insert into users table
        await pool.execute(
          "INSERT INTO users (name, email, password, subscribe, email_verified, created_at) VALUES (?, ?, ?, ?, TRUE, NOW())",
          [pendingUser.name, pendingUser.email, pendingUser.password_hash, pendingUser.subscribe]
        );
        
        // Delete from pending registrations
        await pool.execute(
          "DELETE FROM pending_registrations WHERE id = ?",
          [pendingUser.id]
        );
        
        return res.send(`
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Email Verified - FARFETCH</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.1/dist/css/bootstrap.min.css" rel="stylesheet">
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.5.0/font/bootstrap-icons.css">
            <style>
              body {
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                background: #f8f9fa;
              }
              .verification-success {
                background: white;
                padding: 3rem;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                text-align: center;
                max-width: 500px;
              }
            </style>
          </head>
          <body>
            <div class="verification-success">
              <i class="bi bi-check-circle-fill text-success" style="font-size: 5rem;"></i>
              <h2 class="mt-3">Email Verified!</h2>
              <p class="mt-3">Your email has been successfully verified. You can now sign in to your account.</p>
              <a href="/frontend/farfetch.html?verified=true" class="btn btn-dark mt-4">Sign In Now</a>
            </div>
          </body>
          </html>
        `);
      }
      
      // SECOND: Check if this token is for an email change in users table
      const [unverifiedUsers] = await pool.execute(
        "SELECT id, email, email_verified, verification_token_expires FROM users WHERE verification_token = ? AND email_verified = FALSE",
        [token]
      );
      
      if (unverifiedUsers.length === 0) {
        return res.status(400).send(`
          <html>
            <body style="font-family: Arial; text-align: center; padding: 50px;">
              <h2>Invalid Verification Link</h2>
              <p>This verification link is invalid or has already been used.</p>
              <a href="/frontend/farfetch.html">Return to homepage</a>
            </body>
          </html>
        `);
      }
      
      const user = unverifiedUsers[0];
      
      // Check if token expired
      if (new Date() > new Date(user.verification_token_expires)) {
        // Don't delete from users, just clear the verification token
        await pool.execute(
          "UPDATE users SET verification_token = NULL, verification_token_expires = NULL WHERE id = ?",
          [user.id]
        );
        
        return res.status(400).send(`
          <html>
            <body style="font-family: Arial; text-align: center; padding: 50px;">
              <h2>Link Expired</h2>
              <p>This verification link has expired. Please request a new verification email.</p>
              <a href="/frontend/farfetch.html">Return to homepage</a>
            </body>
          </html>
        `);
      }
      
      // Mark email as verified
      await pool.execute(
        "UPDATE users SET email_verified = TRUE, verification_token = NULL, verification_token_expires = NULL WHERE id = ?",
        [user.id]
      );
      
      res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Email Verified - FARFETCH</title>
          <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.1/dist/css/bootstrap.min.css" rel="stylesheet">
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.5.0/font/bootstrap-icons.css">
          <style>
            body {
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              background: #f8f9fa;
            }
            .verification-success {
              background: white;
              padding: 3rem;
              border-radius: 8px;
              box-shadow: 0 4px 12px rgba(0,0,0,0.1);
              text-align: center;
              max-width: 500px;
            }
          </style>
        </head>
        <body>
          <div class="verification-success">
            <i class="bi bi-check-circle-fill text-success" style="font-size: 5rem;"></i>
            <h2 class="mt-3">Email Verified!</h2>
            <p class="mt-3">Your email has been successfully verified. You can now sign in to your account.</p>
            <a href="/frontend/farfetch.html" class="btn btn-dark mt-4">Sign In Now</a>
          </div>
        </body>
        </html>
      `);
      
    } catch (err) {
      console.error(err);
      res.status(500).send("Verification failed");
    }
  }
);
  
// Resend verification email route - FIXED
router.post("/resend-verification", validateResendVerification, handleValidationErrors, checkVerificationCooldown,
  async (req, res) => {
    try {
      const { email } = req.body;

      // Check if email exists in users table and is VERIFIED
      const [verifiedUser] = await pool.execute(
        "SELECT id, email_verified FROM users WHERE email = ?",
        [email]
      );
      
      if (verifiedUser.length > 0 && verifiedUser[0].email_verified === 1) {
        return res.status(400).json({ 
          message: "Email already verified. Please log in to your account.",
          alreadyVerified: true
        });
      }
      
      // Check if email exists in users table but is NOT verified (email change case)
      if (verifiedUser.length > 0 && verifiedUser[0].email_verified === 0) {
        // Generate new token
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
        
        await pool.execute(
          "UPDATE users SET verification_token = ?, verification_token_expires = ? WHERE email = ?",
          [verificationToken, tokenExpires, email]
        );
        
        // Send verification email
        const verificationUrl = `${'https://localhost:3000'}/auth/verify-email?token=${verificationToken}`;
        await sendVerificationEmail(email, verifiedUser[0].name || 'User', verificationUrl);
        
        // Update the timestamp for cooldown tracking
        await updateVerificationTimestamp(email);
        
        return res.json({ 
          message: "Verification email sent",
          cooldownSeconds: 60
        });
      }
      
      // Check in pending registrations (new signup case)
      const [pending] = await pool.execute(
        "SELECT id, name, email FROM pending_registrations WHERE email = ?",
        [email]
      );
      
      if (pending.length === 0) {
        return res.status(404).json({ message: "Registration not found. Please sign up first." });
      }
      
      // Generate new token for pending registration
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
      
      await pool.execute(
        "UPDATE pending_registrations SET verification_token = ?, verification_token_expires = ? WHERE email = ?",
        [verificationToken, tokenExpires, email]
      );
      
      // Send verification email
      const verificationUrl = `${'https://localhost:3000'}/auth/verify-email?token=${verificationToken}`;
      await sendVerificationEmail(email, pending[0].name, verificationUrl);
      
      // Update the timestamp for cooldown tracking
      await updateVerificationTimestamp(email);
      
      res.json({ 
        message: "Verification email sent",
        cooldownSeconds: 60
      });
      
      
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to resend verification email" });
    }
  }
);

// Check if email is verified (for polling)
router.get("/check-verification", 
  async (req, res) => {
    try {
      const { email } = req.query;
      
      if (!email) {
        return res.status(400).json({ message: "Email required" });
      }
      
      // Check in users table
      const [users] = await pool.execute(
        "SELECT email_verified FROM users WHERE email = ?",
        [email]
      );
      
      if (users.length > 0) {
        return res.json({ 
          verified: users[0].email_verified === 1 
        });
      }
      
      // Check in pending registrations
      const [pending] = await pool.execute(
        "SELECT id FROM pending_registrations WHERE email = ?",
        [email]
      );
      
      res.json({ 
        verified: false,
        pending: pending.length > 0
      });
      
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Check failed" });
    }
  }
);

function parseUserAgent(userAgent) {
    const ua = userAgent.toLowerCase();
    
    // Detect browser
    let browser = 'Unknown';
    if (ua.includes('chrome') && !ua.includes('edg')) browser = 'Chrome';
    else if (ua.includes('firefox')) browser = 'Firefox';
    else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';
    else if (ua.includes('edg')) browser = 'Edge';
    else if (ua.includes('opera')) browser = 'Opera';
  
    // Detect OS
    let os = 'Unknown';
    if (ua.includes('windows')) os = 'Windows';
    else if (ua.includes('mac')) os = 'macOS';
    else if (ua.includes('linux')) os = 'Linux';
    else if (ua.includes('android')) os = 'Android';
    else if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';
  
    return `${browser} on ${os}`;
}

// Generate random 6-digit code
function generate2FACode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
  
// LOGIN ROUTE WITH VALIDATION
router.post("/login", validateLogin, handleValidationErrors,
  async (req, res) => {
    try {
      const { email, password, keepMeSignedIn } = req.body;
      
      const [rows] = await pool.execute(
        "SELECT id, name, email, password, role, deactivated_at, deleted_at, suspended_at FROM users WHERE email = ?", 
        [email]
      );
      
      if (rows.length === 0) {
        return res.status(401).json({ 
          message: "Email not registered",
          emailNotFound: true
        });
      }
      
      const user = rows[0];
      
      // Check if account is deleted
      if (user.deleted_at) {
        return res.status(403).json({
          message: "Account deleted, contact support for more info",
          accountStatus: "deleted"
        });
      }
      
      // Check if account is deactivated
      if (user.deactivated_at) {
        return res.status(403).json({
          message: "Account deactivated, contact support for more info",
          accountStatus: "deactivated"
        });
      }
      
      // Check if account is suspended
      if (user.suspended_at) {
        return res.status(403).json({
          message: "Account suspended, contact support for more info",
          accountStatus: "suspended"
        });
      }
      
      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      //Check if 2FA is enabled for this user
      const [securitySettings] = await pool.execute(
        "SELECT two_factor_enabled FROM user_security_settings WHERE user_id = ?",
        [user.id]
      );
      
      const twoFactorEnabled = securitySettings.length > 0 && securitySettings[0].two_factor_enabled;
      
      if (twoFactorEnabled) {
        // Generate 2FA code
        const code = generate2FACode();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        
        // Store code in database
        await pool.execute(
          `UPDATE user_security_settings 
          SET two_factor_code = ?, two_factor_code_expires = ? 
          WHERE user_id = ?`,
          [code, expiresAt, user.id]
        );
        
        // Send code via email
        await send2FACodeEmail(user.email, user.name, code);
        
        // Return response indicating 2FA is required
        return res.json({
          requires2FA: true,
          message: "2FA code sent to your email",
          userId: user.id // Temporarily store this for verification
        });
      }
      
      const token = jwt.sign(
        { id: user.id, role: user.role }, 
        process.env.JWT_SECRET, 
        { expiresIn: keepMeSignedIn ? "7d" : "1h" }
      );
      
      // Get device and location info
      const userAgent = req.headers['user-agent'] || 'Unknown Device';
      const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
      const deviceInfo = parseUserAgent(userAgent);
      
      // Calculate expiry date
      const expiresAt = new Date();
      if (keepMeSignedIn) {
        expiresAt.setDate(expiresAt.getDate() + 7);
      } else {
        expiresAt.setHours(expiresAt.getHours() + 1);
      }
      
      // Mark all existing sessions as not current
      await pool.execute(
        "DELETE FROM user_sessions WHERE user_id = ? AND ip_address = ?",
        [user.id, ipAddress]
      );
      
      // Create new session record
      await pool.execute(
        `INSERT INTO user_sessions (user_id, session_token, device_info, ip_address, is_current, expires_at)
          VALUES (?, ?, ?, ?, TRUE, ?)`,
        [user.id, token.substring(0, 50), deviceInfo, ipAddress, expiresAt]
      );
      
      // Clean up expired sessions
      await pool.execute("DELETE FROM user_sessions WHERE expires_at < NOW()");
      
      let cookieOptions = { 
        httpOnly: true, 
        secure: true, 
        sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'none'
      };
      
      if (keepMeSignedIn) {
        cookieOptions.maxAge = 7 * 24 * 60 * 60 * 1000;
      }
      
      res.cookie("authToken", token, cookieOptions);
      res.json({ message: "Login successful", role: user.role });
      
      await logUserActivity(user.id, 'login', 'User logged in successfully', req);

      // Log admin login to admin_activity_logs
      if (user.role === 'admin' || user.role === "super_admin") {
        try {
          await pool.execute(
            `INSERT INTO admin_activity_logs 
            (admin_id, action, entity_type, entity_id, new_value, 
            ip_address, user_agent, request_method, request_path, status_code)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              user.id,
              'admin_login',
              null,
              null,
              JSON.stringify({ keepMeSignedIn, deviceInfo }),
              ipAddress,
              userAgent,
              'POST',
              '/login',
              200
            ]
          );
        } catch (logError) {
          console.error('Failed to log admin login:', logError);
        }
      }
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ message: "Login failed. Please try again." });
    }
  }
);

// NEW ENDPOINT: Verify 2FA code
router.post("/2fa/verify", validate2faVerify, handleValidationErrors, 
  async (req, res) => {

    try {
      const { userId, code, keepMeSignedIn } = req.body;
      
      // Get stored code and user info
      const [rows] = await pool.execute(
        `SELECT uss.two_factor_code, uss.two_factor_code_expires, u.id, u.role, u.name
         FROM user_security_settings uss
         JOIN users u ON uss.user_id = u.id
         WHERE uss.user_id = ?`,
        [userId]
      );
      
      if (rows.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const userData = rows[0];
      
      // Check if code exists
      if (!userData.two_factor_code) {
        return res.status(400).json({ message: "No 2FA code was generated. Please try logging in again." });
      }
      
      // Check if code expired
      if (new Date() > new Date(userData.two_factor_code_expires)) {
        // Clear expired code
        await pool.execute(
          "UPDATE user_security_settings SET two_factor_code = NULL, two_factor_code_expires = NULL WHERE user_id = ?",
          [userId]
        );
        return res.status(400).json({ message: "2FA code expired. Please try logging in again." });
      }
      
      // Verify code
      if (userData.two_factor_code !== code) {
        return res.status(401).json({ message: "Invalid 2FA code" });
      }
      
      // Code is valid - clear it and create session
      await pool.execute(
        "UPDATE user_security_settings SET two_factor_code = NULL, two_factor_code_expires = NULL WHERE user_id = ?",
        [userId]
      );
      
      // Generate JWT token
      const token = jwt.sign(
        { id: userData.id, role: userData.role }, 
        process.env.JWT_SECRET, 
        { expiresIn: keepMeSignedIn ? "7d" : "1h" }
      );
      
      // Create session
      const userAgent = req.headers['user-agent'] || 'Unknown Device';
      const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
      const deviceInfo = parseUserAgent(userAgent);
      
      const expiresAt = new Date();
      if (keepMeSignedIn) {
        expiresAt.setDate(expiresAt.getDate() + 7);
      } else {
        expiresAt.setHours(expiresAt.getHours() + 1);
      }
      
      await pool.execute(
        "DELETE FROM user_sessions WHERE user_id = ? AND ip_address = ?",
        [user.id, ipAddress]
      );

      
      await pool.execute(
        `INSERT INTO user_sessions (user_id, session_token, device_info, ip_address, is_current, expires_at)
         VALUES (?, ?, ?, ?, TRUE, ?)`,
        [userData.id, token.substring(0, 50), deviceInfo, ipAddress, expiresAt]
      );

      await pool.execute("DELETE FROM user_sessions WHERE expires_at < NOW()");
      
      let cookieOptions = { 
        httpOnly: true, 
        secure: true, 
        sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'none'
      };
      
      if (keepMeSignedIn) {
        cookieOptions.maxAge = 7 * 24 * 60 * 60 * 1000;
      }
      
      res.cookie("authToken", token, cookieOptions);
      res.json({ 
        message: "2FA verification successful", 
        role: userData.role 
      });
      
      await logUserActivity(userData.id, 'login', 'User logged in successfully with 2FA', req);

      if (userData.role === 'admin') {
        try {
          await pool.execute(
            `INSERT INTO admin_activity_logs 
            (admin_id, action, entity_type, entity_id, new_value, 
            ip_address, user_agent, request_method, request_path, status_code)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              userData.id,
              'admin_login',
              null,
              null,
              JSON.stringify({ keepMeSignedIn, deviceInfo, with2FA: true }),
              ipAddress,
              userAgent,
              'POST',
              '/2fa/verify',
              200
            ]
          );
        } catch (logError) {
          console.error('Failed to log admin login:', logError);
        }
      }
      
    } catch (err) {
      console.error('2FA verification error:', err);
      res.status(500).json({ message: "Verification failed. Please try again." });
    }
  }
);

// NEW ENDPOINT: Resend 2FA code
router.post("/2fa/resend", validate2faResend, handleValidationErrors,
  async (req, res) => {

    try {
      const { userId } = req.body;
      
      // Get user info
      const [users] = await pool.execute(
        "SELECT id, name, email FROM users WHERE id = ?",
        [userId]
      );
      
      if (users.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const user = users[0];
      
      // Generate new code
      const code = generate2FACode();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      
      // Update code in database
      await pool.execute(
        `UPDATE user_security_settings 
         SET two_factor_code = ?, two_factor_code_expires = ? 
         WHERE user_id = ?`,
        [code, expiresAt, userId]
      );
      
      // Send new code via email
      await send2FACodeEmail(user.email, user.name, code);
      
      res.json({ message: "New 2FA code sent to your email" });
      
    } catch (err) {
      console.error('2FA resend error:', err);
      res.status(500).json({ message: "Failed to resend code. Please try again." });
    }
  }
);
  
// Logout route (updated)
router.post("/logout", async (req, res) => {
    try {
      const token = req.cookies.authToken;
      if (token) {
        // Mark session as ended
        await pool.execute(
          "DELETE FROM user_sessions WHERE session_token LIKE ? AND is_current = TRUE",
          [token.substring(0, 50) + '%']
        );
      }
      
      res.clearCookie("authToken", {
        httpOnly: true,
        secure: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'none',
      });
      res.status(200).json({ message: "Logged out successfully" });
  
      // Log activity
      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          await logUserActivity(decoded.id, 'logout', 'User logged out', req);
          
          // Log admin logout to admin_activity_logs
          if (decoded.role === 'admin') {
            await pool.execute(
              `INSERT INTO admin_activity_logs 
              (admin_id, action, entity_type, entity_id, new_value, 
              ip_address, user_agent, request_method, request_path, status_code)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                decoded.id,
                'admin_logout',
                null,
                null,
                null,
                req.ip || req.connection.remoteAddress,
                req.get('user-agent') || null,
                'POST',
                '/logout',
                200
              ]
            );
          }
        } catch (logError) {
          console.error('Failed to log logout activity:', logError);
        }
      }
    } catch (err) {
      console.error(err);
      res.status(200).json({ message: "Logged out successfully" });
    }
});
  
// Get current user profile (including profile image)
router.get("/me", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const [users] = await pool.execute(
      "SELECT id, name, email, role, profile_image, email_verified FROM users WHERE id = ?",
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = users[0];
    res.json(user);

  } catch (err) {
    console.error("Get user error:", err);
    res.status(500).json({ message: "Failed to get user data" });
  }
});

export default router;