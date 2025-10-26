// admin-routes.js
import express from "express";
import pool from "../main.js";
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import Stripe from 'stripe';
import { logError } from '../utils/error-logger.js';
import { sendNotificationEmail } from '../services/email-service.js';
import { requireAdmin, requireSuperAdmin } from '../middleware/auth.js';
import { validatePasswordChange, validateId, validateOrderNumber, validateAdminUsersQuery, validateAdminUsersExport, validateAdminUserUpdate, validateUserStatus, validateAdminSendEmail, validateAdminRefundsQuery, validateRefundProcess, validatePartialRefund, validateProductId, validateProduct, validateAdminContactQuery, validateContactSubmissionUpdate, validateAdminContactExport, validateAdminOrdersQuery, validateOrderStatus, validateAdminNotificationsQuery, validateAdminNotification, validateActivityLogsQuery, validateActivityLogsExport, validateErrorLogsQuery, validateErrorLogsExport, validateErrorResolve, validateBulkErrorResolve, validateBulkErrorDelete, handleValidationErrors } from "../middleware/validation.js";

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// GET /api/admin/stats - Get dashboard statistics (add to existing or create new)
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    // Total users
    const [userCount] = await pool.execute(
      'SELECT COUNT(*) as total FROM users WHERE role != "admin"'
    );

    // Total completed orders (delivered status)
    const [completedOrders] = await pool.execute(
      'SELECT COUNT(*) as total FROM orders WHERE status = "delivered"'
    );

     // Total orders (all statuses where payment is paid)
     const [totalOrders] = await pool.execute(
      'SELECT COUNT(*) as total FROM orders WHERE payment_status = "paid"'
    );

    // Total products
    const [productCount] = await pool.execute(
      'SELECT COUNT(*) as total FROM products'
    );

    res.json({
      total_users: userCount[0].total,
      total_purchases: completedOrders[0].total,
      total_orders: totalOrders[0].total,
      total_products: productCount[0].total
    });
  } catch (error) {
    console.error('Get admin stats error:', error);
    res.status(500).json({ message: 'Failed to fetch statistics' });
  }
});


// USERS

// Change password (admin self-service)
router.post("/change-password", validatePasswordChange, handleValidationErrors, requireAdmin, async (req, res) => {
  try {

    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: "Both old and new password are required" });
    }

    const userId = req.user.id;

    // Fetch current password
    const [rows] = await pool.execute("SELECT password FROM users WHERE id = ?", [userId]);
    if (rows.length === 0) return res.status(404).json({ message: "Admin not found" });

    const admin = rows[0];
    const match = await bcrypt.compare(oldPassword, admin.password);
    if (!match) return res.status(401).json({ message: "Old password is incorrect" });

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await pool.execute("UPDATE users SET password = ? WHERE id = ?", [hashedPassword, userId]);

    // Delete ALL sessions to force user to login with new password
    await pool.execute(
      "DELETE FROM user_sessions WHERE user_id = ?",
      [userId]
    );

    // Clear cookie immediately
    res.clearCookie("authToken", {
      httpOnly: true,
      secure: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'none'
    });

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update password" });
  }
});

// Get users with search, filter, sort and pagination
router.get("/users", validateAdminUsersQuery, handleValidationErrors, requireAdmin, async (req, res) => {
  try {
    const isSuperAdmin = req.user.role === 'super_admin';

    // Query params
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 200);
    const offset = (page - 1) * limit;
    const q = (req.query.q || "").trim();           // search
    const role = req.query.role || "";              // role filter
    const sort = req.query.sort === "created_desc" ? "created_at DESC" : "created_at ASC";

    // Build WHERE clauses
    const where = [];
    const params = [];

    // Hide super_admin users from regular admins
    if (!isSuperAdmin) {
      where.push("role != 'super_admin'");
    }

    if (q) {
      where.push("(email LIKE ? OR name LIKE ? OR id LIKE ?)");
      const like = `%${q}%`;
      params.push(like, like, like);
    }
    if (role) {
      where.push("role = ?");
      params.push(role);
    }

    const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";

    // Total count query
    const [countRows] = await pool.execute(
      `SELECT COUNT(*) AS total FROM users ${whereSql}`,
      params
    );
    const total = countRows[0].total;

    // Data query with pagination
    const [rows] = await pool.execute(
      `SELECT id, email, name, role, created_at
       FROM users
       ${whereSql}
       ORDER BY ${sort}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      },
      data: rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// Export users (CSV). Query params same as /users (q, role, sort).
router.get("/users/export", validateAdminUsersExport, handleValidationErrors, requireAdmin, async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    const role = req.query.role || "";
    const sort = req.query.sort === "created_desc" ? "created_at DESC" : "created_at ASC";

    const where = [];
    const params = [];
    if (q) {
      where.push("(email LIKE ? OR name LIKE ? OR id LIKE ?)");
      const like = `%${q}%`;
      params.push(like, like, like);
    }
    if (role) {
      where.push("role = ?");
      params.push(role);
    }
    const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";

    const [rows] = await pool.execute(
      `SELECT id, email, name, role, created_at
       FROM users
       ${whereSql}
       ORDER BY ${sort}`,
      params
    );

    // CSV headers
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=users-${Date.now()}.csv`);

    // Stream CSV (simple)
    res.write("id,name,email,role,created_at\n");
    rows.forEach(r => {
      // Escape double quotes
      const safe = val => (val === null || val === undefined) ? "" : String(val).replace(/"/g, '""');
      res.write(`"${safe(r.id)}","${safe(r.name)}","${safe(r.email)}","${safe(r.role)}","${safe(r.created_at)}"\n`);
    });
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to export CSV" });
  }
});

// Get single user by ID
router.get("/users/:id", validateId, handleValidationErrors, requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.execute(
      "SELECT id, email, name, role FROM users WHERE id = ?",
      [id]
    );

    if (rows.length === 0) return res.status(404).json({ error: "User not found" });

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// Update user by ID
router.put("/users/:id", validateId, validateAdminUserUpdate, handleValidationErrors, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { email, name, role } = req.body;

  try {
    const isSuperAdmin = req.user.role === 'super_admin';

    // Check if target user is super_admin
    const [targetUser] = await pool.execute(
      "SELECT role FROM users WHERE id = ?",
      [id]
    );

    if (targetUser.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // Regular admins cannot modify super admins
    if (!isSuperAdmin && targetUser[0].role === 'super_admin') {
      return res.status(403).json({ error: "Cannot modify super admin accounts" });
    }

    // Regular admins cannot promote users to super_admin
    if (!isSuperAdmin && role === 'super_admin') {
      return res.status(403).json({ error: "Cannot assign super admin role" });
    }

    const [result] = await pool.execute(
      "UPDATE users SET email = ?, name = ?, role = ? WHERE id = ?",
      [email, name, role, id]
    );

    if (result.affectedRows === 0) return res.status(404).json({ error: "User not found" });
    res.json({ message: "User updated successfully" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// Delete a user by ID
router.delete("/users/:id", validateId, handleValidationErrors, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const isSuperAdmin = req.user.role === 'super_admin';

    // Check if target user is super_admin
    const [targetUser] = await pool.execute(
      "SELECT role FROM users WHERE id = ?",
      [id]
    );

    if (targetUser.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // Regular admins cannot delete super admins
    if (!isSuperAdmin && targetUser[0].role === 'super_admin') {
      return res.status(403).json({ error: "Cannot delete super admin accounts" });
    }

    const [result] = await pool.execute(
      "DELETE FROM users WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0) return res.status(404).json({ error: "User not found" });
    res.json({ message: "User deleted successfully" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});


// Get detailed user information for overview page
router.get("/users/:id/overview", validateId, handleValidationErrors, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Get user basic info
    const [userRows] = await pool.execute(`
      SELECT id, name, email, phone, country, gender, role, subscribe, 
      created_at, deactivated_at, deleted_at, suspended_at, profile_image, email_verified
      FROM users WHERE id = ?
    `, [id]);

    if (userRows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = userRows[0];

    // Get user preferences
    const [preferencesRows] = await pool.execute(`
      SELECT * FROM user_preferences WHERE user_id = ?
    `, [id]);

    // Get user sessions
    const [sessionsRows] = await pool.execute(`
      SELECT device_info, ip_address, location, created_at, last_active, is_current
      FROM user_sessions 
      WHERE user_id = ? 
      ORDER BY last_active DESC, created_at DESC
      LIMIT 20
    `, [id]);

    // Get user's support tickets
    const [ticketsRows] = await pool.execute(`
      SELECT id, subject, status, priority, created_at
      FROM contact_submissions 
      WHERE user_id = ? 
      ORDER BY created_at DESC
    `, [id]);

    // Get user's notifications
    const [notificationsRows] = await pool.execute(`
      SELECT COUNT(*) as total_notifications,
        COUNT(CASE WHEN is_read = FALSE THEN 1 END) as unread_notifications
      FROM user_notifications 
      WHERE user_id = ? AND is_deleted = FALSE
    `, [id]);

    // Get user security settings
    const [securityRows] = await pool.execute(`
      SELECT two_factor_enabled FROM user_security_settings WHERE user_id = ?
    `, [id]);

    // Get activity logs
    const [activityRows] = await pool.execute(`
      SELECT activity_type, description, ip_address, created_at
      FROM activity_logs 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT 20
    `, [id]);

    // Get user addresses
    const [addressRows] = await pool.execute(`
      SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC
    `, [id]);

    // Calculate some stats
    const activeTickets = ticketsRows.filter(ticket => 
      ['pending', 'in_progress'].includes(ticket.status)
    ).length;

    // const lastLogin = sessionsRows.length > 0 ? sessionsRows[0].last_active : null;

    const lastLogin = sessionsRows.length > 0 ? 
  (sessionsRows[0].last_active || sessionsRows[0].created_at) : null;

    res.json({
      user,
      preferences: preferencesRows[0] || null,
      sessions: sessionsRows,
      supportTickets: {
        tickets: ticketsRows,
        activeCount: activeTickets,
        totalCount: ticketsRows.length
      },
      notifications: notificationsRows[0] || { total_notifications: 0, unread_notifications: 0 },
      security: securityRows[0] || { two_factor_enabled: false },
      activity: activityRows,
      addresses: addressRows,
      stats: {
        lastLogin,
        totalSessions: sessionsRows.length,
        currentSessions: sessionsRows.filter(s => s.is_current).length
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// Export user overview data as JSON
router.get("/users/:id/export-overview", validateId, handleValidationErrors, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Get user basic info
    const [userRows] = await pool.execute(`
      SELECT id, name, email, phone, country, gender, role, subscribe, 
      created_at, deactivated_at, deleted_at, suspended_at, profile_image, email_verified
      FROM users WHERE id = ?
    `, [id]);

    if (userRows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = userRows[0];

    // Get user preferences
    const [preferencesRows] = await pool.execute(`
      SELECT * FROM user_preferences WHERE user_id = ?
    `, [id]);

    // Get user sessions
    const [sessionsRows] = await pool.execute(`
      SELECT device_info, ip_address, location, created_at, last_active, is_current
      FROM user_sessions 
      WHERE user_id = ? 
      ORDER BY last_active DESC, created_at DESC
      LIMIT 20
    `, [id]);

    // Get user's support tickets
    const [ticketsRows] = await pool.execute(`
      SELECT id, subject, status, priority, created_at
      FROM contact_submissions 
      WHERE user_id = ? 
      ORDER BY created_at DESC
    `, [id]);

    // Get user's notifications
    const [notificationsRows] = await pool.execute(`
      SELECT COUNT(*) as total_notifications,
        COUNT(CASE WHEN is_read = FALSE THEN 1 END) as unread_notifications
      FROM user_notifications 
      WHERE user_id = ? AND is_deleted = FALSE
    `, [id]);

    // Get user security settings
    const [securityRows] = await pool.execute(`
      SELECT two_factor_enabled FROM user_security_settings WHERE user_id = ?
    `, [id]);

    // Get activity logs
    const [activityRows] = await pool.execute(`
      SELECT activity_type, description, ip_address, created_at
      FROM activity_logs 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT 20
    `, [id]);

    // Get user addresses
    const [addressRows] = await pool.execute(`
      SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC
    `, [id]);

    const activeTickets = ticketsRows.filter(ticket => 
      ['pending', 'in_progress'].includes(ticket.status)
    ).length;

    const lastLogin = sessionsRows.length > 0 ? 
      (sessionsRows[0].last_active || sessionsRows[0].created_at) : null;

    const exportData = {
      user,
      preferences: preferencesRows[0] || null,
      sessions: sessionsRows,
      supportTickets: {
        tickets: ticketsRows,
        activeCount: activeTickets,
        totalCount: ticketsRows.length
      },
      notifications: notificationsRows[0] || { total_notifications: 0, unread_notifications: 0 },
      security: securityRows[0] || { two_factor_enabled: false },
      activity: activityRows,
      addresses: addressRows,
      stats: {
        lastLogin,
        totalSessions: sessionsRows.length,
        currentSessions: sessionsRows.filter(s => s.is_current).length
      }
    };

    // Set headers for download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=user_${id}_overview_${Date.now()}.json`);
    
    res.json(exportData);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to export user data" });
  }
});

// Update user status (activate/deactivate/delete)
router.post("/users/:id/status", validateId, validateUserStatus, handleValidationErrors, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body;

    let updateQuery = '';
    let params = [];

    switch (action) {
      case 'activate':
        updateQuery = 'UPDATE users SET deactivated_at = NULL, deleted_at = NULL, suspended_at = NULL WHERE id = ?';
        params = [id];
        break;
      case 'deactivate':
        updateQuery = 'UPDATE users SET deactivated_at = NOW(), suspended_at = NULL WHERE id = ?';
        params = [id];
        // Clear all active sessions for this user to force logout
        await pool.execute('DELETE FROM user_sessions WHERE user_id = ?', [id]);
        break;
      case 'suspend':
        updateQuery = 'UPDATE users SET suspended_at = NOW(), deactivated_at = NULL WHERE id = ?';
        params = [id];
        // Clear all active sessions for this user to force logout
        await pool.execute('DELETE FROM user_sessions WHERE user_id = ?', [id]);
        break;
      default:
        return res.status(400).json({ error: "Invalid action" });
    }

    const [result] = await pool.execute(updateQuery, params);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ message: `User ${action}d successfully` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// Reset user password (generate new temporary password)
router.post("/users/:id/reset-password", validateId, handleValidationErrors, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Generate temporary password
    const tempPassword = Math.random().toString(36).slice(-10);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    
    const [result] = await pool.execute(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    await pool.execute(
      "DELETE FROM user_sessions WHERE user_id = ?",
      [id]
    );

    // In a real app, you'd email this to the user
    res.json({ 
      message: "Password reset successfully. User must log in with new password."// Remove this in production - send via email instead
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// Send email to user
router.post("/users/:id/send-email", validateId, validateAdminSendEmail, handleValidationErrors, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { subject, message } = req.body;

    // Get user email
    const [userRows] = await pool.execute('SELECT name, email FROM users WHERE id = ?', [id]);
    
    if (userRows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = userRows[0];

    // Send email using your existing email service
    await sendNotificationEmail(user.email, user.name, subject, message, 'general');

    res.json({ message: "Email sent successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send email" });
  }
});



// REFUNDS

// GET /api/admin/refunds - Get all refund requests (admin only)
router.get('/refunds', validateAdminRefundsQuery, handleValidationErrors, requireAdmin, async (req, res) => {

  try {
    const status = req.query.status || 'pending';
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE r.status = ?';
    let queryParams = [status];

    const [refunds] = await pool.execute(`
      SELECT 
        r.id, r.order_id, r.amount, r.reason, r.reason_description,
        r.status, r.refund_type, r.created_at,
        o.order_number, o.total as order_total, o.payment_intent_id,
        u.name as customer_name, u.email as customer_email
      FROM refunds r
      JOIN orders o ON r.order_id = o.id
      LEFT JOIN users u ON o.user_id = u.id
      ${whereClause}
      ORDER BY r.created_at ASC
      LIMIT ? OFFSET ?
    `, [...queryParams, limit, offset]);

    const [countResult] = await pool.execute(`
      SELECT COUNT(*) as total 
      FROM refunds r
      JOIN orders o ON r.order_id = o.id
      ${whereClause}
    `, queryParams);

    res.json({
      refunds,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(countResult[0].total / limit),
        totalRefunds: countResult[0].total
      }
    });

  } catch (error) {
    console.error('Admin get refunds error:', error);
    res.status(500).json({ message: 'Failed to fetch refunds' });
  }
});

// POST /api/admin/refunds/:refundId/process - Process a refund (admin only)
router.post('/refunds/:refundId/process', validateId, handleValidationErrors, validateRefundProcess, requireAdmin, async (req, res) => {

  try {
    const userId = req.user.id;

    const { refundId } = req.params;
    const { approve } = req.body; // true to approve, false to reject

    // Get refund details
    const [refunds] = await pool.execute(`
      SELECT 
        r.id, r.order_id, r.amount, r.status,
        o.payment_intent_id, o.order_number
      FROM refunds r
      JOIN orders o ON r.order_id = o.id
      WHERE r.id = ?
    `, [refundId]);

    if (refunds.length === 0) {
      return res.status(404).json({ message: 'Refund not found' });
    }

    const refund = refunds[0];

    if (refund.status !== 'pending') {
      return res.status(400).json({ 
        message: 'Refund has already been processed',
        currentStatus: refund.status
      });
    }

    if (!approve) {
      // Reject the refund
      await pool.execute(
        'UPDATE refunds SET status = "failed", processed_by = ?, updated_at = NOW() WHERE id = ?',
        [userId, refundId]
      );

      return res.json({
        message: 'Refund request rejected',
        refundId: refundId,
        status: 'failed'
      });
    }

    // Process the refund through Stripe
    try {
      const stripeRefund = await stripe.refunds.create({
        payment_intent: refund.payment_intent_id,
        amount: Math.round(refund.amount * 100), // Convert to cents
        reason: 'requested_by_customer',
        metadata: {
          refundId: refundId.toString(),
          orderId: refund.order_id.toString()
        }
      });

      // Update refund with Stripe refund ID
      await pool.execute(`
        UPDATE refunds 
        SET status = 'succeeded', stripe_refund_id = ?, processed_by = ?, updated_at = NOW()
        WHERE id = ?
      `, [stripeRefund.id, userId, refundId]);

      // Update order status
      await pool.execute(
        'UPDATE orders SET payment_status = "refunded", status = "refunded", updated_at = NOW() WHERE id = ?',
        [refund.order_id]
      );

      // Restore product stock
      const [orderItems] = await pool.execute(
        'SELECT product_id, quantity FROM order_items WHERE order_id = ?',
        [refund.order_id]
      );

      for (const item of orderItems) {
        await pool.execute(
          'UPDATE products SET stock = stock + ? WHERE product_id = ?',
          [item.quantity, item.product_id]
        );
      }

      res.json({
        message: 'Refund processed successfully',
        refundId: refundId,
        stripeRefundId: stripeRefund.id,
        amount: refund.amount,
        status: 'succeeded',
        orderNumber: refund.order_number
      });

    } catch (stripeError) {
      console.error('Stripe refund error:', stripeError);
      
      // Update refund status to failed
      await pool.execute(
        'UPDATE refunds SET status = "failed", processed_by = ?, updated_at = NOW() WHERE id = ?',
        [userId, refundId]
      );

      res.status(500).json({
        message: 'Failed to process refund through payment gateway',
        error: stripeError.message
      });
    }

  } catch (error) {
    console.error('Process refund error:', error);
    res.status(500).json({ message: 'Failed to process refund' });
  }
});

// POST /api/admin/refunds/:refundId/partial - Process partial refund (admin only)
router.post('/refunds/:refundId/partial', validateId, handleValidationErrors, validatePartialRefund, requireAdmin, async (req, res) => {

  try {
    const userId = req.user.id;
    const { refundId } = req.params;
    const { amount, reason } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Valid amount is required' });
    }

    // Get refund details
    const [refunds] = await pool.execute(`
      SELECT 
        r.id, r.order_id, r.amount as original_amount, r.status,
        o.payment_intent_id, o.order_number, o.total
      FROM refunds r
      JOIN orders o ON r.order_id = o.id
      WHERE r.id = ?
    `, [refundId]);

    if (refunds.length === 0) {
      return res.status(404).json({ message: 'Refund not found' });
    }

    const refund = refunds[0];

    if (refund.status !== 'pending') {
      return res.status(400).json({ 
        message: 'Refund has already been processed',
        currentStatus: refund.status
      });
    }

    if (amount > refund.total) {
      return res.status(400).json({ 
        message: 'Partial refund amount cannot exceed order total',
        maxAmount: refund.total
      });
    }

    try {
      // Process partial refund through Stripe
      const stripeRefund = await stripe.refunds.create({
        payment_intent: refund.payment_intent_id,
        amount: Math.round(amount * 100), // Convert to cents
        reason: 'requested_by_customer',
        metadata: {
          refundId: refundId.toString(),
          orderId: refund.order_id.toString(),
          refundType: 'partial'
        }
      });

      // Update refund record
      await pool.execute(`
        UPDATE refunds 
        SET status = 'succeeded', stripe_refund_id = ?, amount = ?, 
            refund_type = 'partial', processed_by = ?, updated_at = NOW()
        WHERE id = ?
      `, [stripeRefund.id, amount, userId, refundId]);

      // Update order payment status
      await pool.execute(
        'UPDATE orders SET payment_status = "partially_refunded", updated_at = NOW() WHERE id = ?',
        [refund.order_id]
      );

      res.json({
        message: 'Partial refund processed successfully',
        refundId: refundId,
        stripeRefundId: stripeRefund.id,
        refundAmount: amount,
        originalAmount: refund.original_amount,
        status: 'succeeded',
        orderNumber: refund.order_number
      });

    } catch (stripeError) {
      console.error('Stripe partial refund error:', stripeError);
      
      await pool.execute(
        'UPDATE refunds SET status = "failed", processed_by = ?, updated_at = NOW() WHERE id = ?',
        [userId, refundId]
      );

      res.status(500).json({
        message: 'Failed to process partial refund through payment gateway',
        error: stripeError.message
      });
    }

  } catch (error) {
    console.error('Process partial refund error:', error);
    res.status(500).json({ message: 'Failed to process partial refund' });
  }
});



// PRODUCTS

function generateProductId() {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

// Get all products
router.get("/products", requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      "SELECT product_id AS id, name, description, price, stock, image_url, created_at FROM products"
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// GET /products/:id
router.get("/products/:id", validateProductId, handleValidationErrors, requireAdmin, async (req, res) => {
  
  const id = req.params.id;
  if (!/^\d{8}$/.test(id)) {
    return res.status(400).json({ message: "Invalid product ID" });
  }
  
  try {
    const [rows] = await pool.execute(
      "SELECT product_id, name, description, price, stock, image_url FROM products WHERE product_id = ?",
      [id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ message: "Product not found" });
    }
    
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch product" });
  }
});

// POST /products (admin only)
router.post("/products", validateProduct, handleValidationErrors, requireAdmin, async (req, res) => {

  try {
    const { name, description, price, stock, image_url } = req.body || {};
    if (!name || typeof price === "undefined") {
      return res.status(400).json({ message: "name and price required" });
    }

    let productId;
    let inserted = false;

    while (!inserted) {
      productId = generateProductId();
      try {
        await pool.execute(
          "INSERT INTO products (product_id, name, description, price, stock, image_url, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())",
          [productId, name, description || "", price, stock || 0, image_url || null]
        );
        inserted = true;
      } catch (err) {
        if (err && err.code === "ER_DUP_ENTRY") continue; // collision, retry
        else throw err;
      }
    }

    res.status(201).json({ message: "Product created", id: productId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create product" });
  }
});

// PUT /products/:id (admin only)
router.put("/products/:id", validateProductId, validateProduct, handleValidationErrors, requireAdmin, async (req, res) => {

  const id = req.params.id;
  const { name, description, price, stock, image_url } = req.body || {};

  if (!/^\d{8}$/.test(id)) {
    return res.status(400).json({ message: "Invalid product ID" });
  }

  try {
    const [result] = await pool.execute(
      `UPDATE products 
       SET name = ?, description = ?, price = ?, stock = ?, image_url = ? 
       WHERE product_id = ?`,
      [name || "", description || "", price || 0, stock || 0, image_url || null, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    console.log("Product updated successfully:", id);
    res.json({ message: "Product updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update product" });
  }
});

// Delete a product by ID
router.delete("/products/:id", validateProductId, handleValidationErrors, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.execute(
      "DELETE FROM products WHERE product_id = ?",
      [id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: "Product not found" });
    res.json({ message: "Product deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});




// CONTACT / SUPPORT

// Get all contact submissions (admin only)
router.get('/contact/submissions', validateAdminContactQuery, handleValidationErrors, requireAdmin, async (req, res) => {
  try {
    const {
      status = 'all',
      subject = 'all',
      priority = 'all',
      limit = 20,
      offset = 0,
      search = '',
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    let query = `
      SELECT cs.id, cs.user_id, cs.name, cs.email, cs.subject, cs.message, 
      cs.status, cs.priority, cs.admin_notes, cs.responded_at, 
      cs.created_at, cs.updated_at,
      u.name as user_name
      FROM contact_submissions cs
      LEFT JOIN users u ON cs.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    // Apply filters
    if (status !== 'all') {
      query += ' AND cs.status = ?';
      params.push(status);
    }

    if (subject !== 'all') {
      query += ' AND cs.subject = ?';
      params.push(subject);
    }

    if (priority !== 'all') {
      query += ' AND cs.priority = ?';
      params.push(priority);
    }

    if (search) {
      query += ' AND (cs.name LIKE ? OR cs.email LIKE ? OR cs.message LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    // Add sorting
    const validSortColumns = ['created_at', 'updated_at', 'priority', 'status', 'subject'];
    const validSortOrder = ['ASC', 'DESC'];
    
    if (validSortColumns.includes(sortBy) && validSortOrder.includes(sortOrder.toUpperCase())) {
      query += ` ORDER BY cs.${sortBy} ${sortOrder.toUpperCase()}`;
    } else {
      query += ' ORDER BY cs.created_at DESC';
    }

    // Add pagination
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [submissions] = await pool.execute(query, params);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM contact_submissions cs
      WHERE 1=1
    `;
    const countParams = [];

    if (status !== 'all') {
      countQuery += ' AND cs.status = ?';
      countParams.push(status);
    }

    if (subject !== 'all') {
      countQuery += ' AND cs.subject = ?';
      countParams.push(subject);
    }

    if (priority !== 'all') {
      countQuery += ' AND cs.priority = ?';
      countParams.push(priority);
    }

    if (search) {
      countQuery += ' AND (cs.name LIKE ? OR cs.email LIKE ? OR cs.message LIKE ?)';
      const searchTerm = `%${search}%`;
      countParams.push(searchTerm, searchTerm, searchTerm);
    }

    const [countResult] = await pool.execute(countQuery, countParams);
    const total = countResult[0].total;

    res.json({
      success: true,
      data: {
        submissions,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: parseInt(offset) + parseInt(limit) < total
        },
        filters: { status, subject, priority, search }
      }
    });

  } catch (error) {
    console.error('Error fetching admin submissions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch submissions'
    });
  }
});

// Update contact submission status (admin only)
router.put('/contact/submission/:id', validateId, validateContactSubmissionUpdate, handleValidationErrors, requireAdmin, async (req, res) => {
  try {
    const submissionId = req.params.id;
    const { status, admin_notes, priority } = req.body;

    // Validate status
    const validStatuses = ['pending', 'in_progress', 'resolved', 'closed'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
    }

    // Validate priority
    const validPriorities = ['low', 'normal', 'high', 'urgent'];
    if (priority && !validPriorities.includes(priority)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid priority value'
      });
    }

    // Build update query dynamically
    const updates = [];
    const params = [];

    if (status) {
      updates.push('status = ?');
      params.push(status);
    }

    if (admin_notes !== undefined) {
      updates.push('admin_notes = ?');
      params.push(admin_notes);
    }

    if (priority) {
      updates.push('priority = ?');
      params.push(priority);
    }

    // Set responded_at if moving to resolved or closed
    if (status === 'resolved' || status === 'closed') {
      updates.push('responded_at = NOW()');
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    updates.push('updated_at = NOW()');
    params.push(submissionId);

    const [result] = await pool.execute(
      `UPDATE contact_submissions SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }

    // Get updated submission
    const [updated] = await pool.execute(
      'SELECT * FROM contact_submissions WHERE id = ?',
      [submissionId]
    );

    res.json({
      success: true,
      message: 'Submission updated successfully',
      data: updated[0]
    });

  } catch (error) {
    console.error('Error updating submission:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update submission'
    });
  }
});

// Get contact statistics (admin only)
router.get('/contact/statistics', requireAdmin, async (req, res) => {
  try {

    // Status distribution
    const [statusStats] = await pool.execute(`
      SELECT 
        status,
        COUNT(*) as count,
        ROUND(AVG(TIMESTAMPDIFF(HOUR, created_at, 
          CASE WHEN responded_at IS NOT NULL THEN responded_at ELSE NOW() END)), 2) as avg_response_time_hours
      FROM contact_submissions 
      GROUP BY status
    `);

    // Subject distribution
    const [subjectStats] = await pool.execute(`
      SELECT 
        subject,
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending
      FROM contact_submissions 
      GROUP BY subject
      ORDER BY total DESC
    `);

    // Priority distribution
    const [priorityStats] = await pool.execute(`
      SELECT 
        priority,
        COUNT(*) as count
      FROM contact_submissions 
      GROUP BY priority
    `);

    // Recent submissions (last 7 days)
    const [recentStats] = await pool.execute(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as submissions
      FROM contact_submissions 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);

    // Overall metrics
    const [overallStats] = await pool.execute(`
      SELECT 
        COUNT(*) as total_submissions,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
        COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY) THEN 1 END) as today_count,
        COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as week_count
      FROM contact_submissions
    `);

    res.json({
      success: true,
      data: {
        overall: overallStats[0],
        byStatus: statusStats,
        bySubject: subjectStats,
        byPriority: priorityStats,
        recentActivity: recentStats
      }
    });

  } catch (error) {
    console.error('Error fetching contact statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics'
    });
  }
});

// Get single contact submission for admin
router.get("/contact/submission/:id", validateId, handleValidationErrors, requireAdmin, async (req, res) => {
  try {
    const submissionId = req.params.id;

    const [rows] = await pool.execute(
      `SELECT cs.id, cs.user_id, cs.name, cs.email, cs.subject, cs.message, 
              cs.status, cs.priority, cs.admin_notes, cs.responded_at, 
              cs.created_at, cs.updated_at,
              u.name as user_name, u.email as user_email
       FROM contact_submissions cs
       LEFT JOIN users u ON cs.user_id = u.id
       WHERE cs.id = ?`,
      [submissionId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }

    res.json(rows[0]);

  } catch (error) {
    console.error('Error fetching submission:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch submission details'
    });
  }
});

// Export contact submissions as CSV
router.get("/contact/export", validateAdminContactExport, handleValidationErrors, requireAdmin, async (req, res) => {
  try {
    const {
      status = 'all',
      subject = 'all',
      priority = 'all',
      search = ''
    } = req.query;

    let query = `
      SELECT cs.id, cs.name, cs.email, cs.subject, cs.message, 
             cs.status, cs.priority, cs.admin_notes, cs.created_at, cs.updated_at,
             u.name as user_name
      FROM contact_submissions cs
      LEFT JOIN users u ON cs.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    // Apply same filters as submissions endpoint
    if (status !== 'all') {
      query += ' AND cs.status = ?';
      params.push(status);
    }

    if (subject !== 'all') {
      query += ' AND cs.subject = ?';
      params.push(subject);
    }

    if (priority !== 'all') {
      query += ' AND cs.priority = ?';
      params.push(priority);
    }

    if (search) {
      query += ' AND (cs.name LIKE ? OR cs.email LIKE ? OR cs.message LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ' ORDER BY cs.created_at DESC';

    const [rows] = await pool.execute(query, params);

    // Set CSV headers
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=support-tickets-${Date.now()}.csv`);

    // Write CSV headers
    res.write("id,name,email,subject,status,priority,message,admin_notes,user_account,created_at,updated_at\n");
    
    // Write CSV data
    rows.forEach(row => {
      const safe = val => (val === null || val === undefined) ? "" : String(val).replace(/"/g, '""');
      const userAccount = row.user_name ? 'Registered User' : 'Guest';
      const cleanMessage = safe(row.message).replace(/[\r\n]+/g, ' ').substring(0, 200);
      const cleanNotes = safe(row.admin_notes).replace(/[\r\n]+/g, ' ');
      
      res.write(`"${safe(row.id)}","${safe(row.name)}","${safe(row.email)}","${safe(row.subject)}","${safe(row.status)}","${safe(row.priority)}","${cleanMessage}","${cleanNotes}","${userAccount}","${safe(row.created_at)}","${safe(row.updated_at)}"\n`);
    });
    
    res.end();
  } catch (error) {
    console.error('Error exporting contact submissions:', error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to export CSV" 
    });
  }
});



// ORDERS

// GET /api/admin/orders - Get all orders (admin only)
router.get('/orders', validateAdminOrdersQuery, handleValidationErrors, requireAdmin, async (req, res) => {
  try {

    const { status, paymentStatus, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT 
        o.id, o.order_number, o.user_id, o.email, o.status, 
        o.payment_status, o.payment_method, o.total, o.currency,
        o.created_at, o.updated_at,
        u.name as customer_name
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE 1=1
    `;

    const params = [];

    if (status) {
      query += ` AND o.status = ?`;
      params.push(status);
    }

    if (paymentStatus) {
      query += ` AND o.payment_status = ?`;
      params.push(paymentStatus);
    }

    query += ` ORDER BY o.created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const [orders] = await pool.execute(query, params);

    // Get total count
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM orders`
    );

    res.json({
      orders,
      total: countResult[0].total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Get admin orders error:', error);
    res.status(500).json({ message: 'Failed to fetch orders' });
  }
});

// GET /api/admin/orders/:orderNumber - Get order details (admin)
router.get('/orders/:orderNumber', validateOrderNumber, handleValidationErrors, requireAdmin, async (req, res) => {
  try {
    const { orderNumber } = req.params;

    // Get order with user info
    const [orders] = await pool.execute(
      `SELECT o.*, u.name as customer_name, u.email as customer_email
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.id
       WHERE o.order_number = ?`,
      [orderNumber]
    );

    if (orders.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const order = orders[0];

    // Get order items
    const [items] = await pool.execute(
      `SELECT * FROM order_items WHERE order_id = ?`,
      [order.id]
    );

    // Get payment info
    const [payments] = await pool.execute(
      `SELECT * FROM payments WHERE order_id = ?`,
      [order.id]
    );

    // Get refunds
    const [refunds] = await pool.execute(
      `SELECT * FROM refunds WHERE order_id = ? ORDER BY created_at DESC`,
      [order.id]
    );

    res.json({
      order,
      items,
      payments,
      refunds
    });
  } catch (error) {
    console.error('Get admin order details error:', error);
    res.status(500).json({ message: 'Failed to fetch order details' });
  }
});

// PUT /api/admin/orders/:orderNumber/status - Update order status (admin only)
router.put('/orders/:orderNumber/status', validateOrderNumber, validateOrderStatus, handleValidationErrors, requireAdmin, async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    // Get order
    const [orders] = await pool.execute(
      'SELECT id FROM orders WHERE order_number = ?',
      [orderNumber]
    );

    if (orders.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Build update query based on status
    let updateQuery = 'UPDATE orders SET status = ?, updated_at = NOW()';
    const params = [status];

    if (status === 'shipped') {
      updateQuery += ', shipped_at = NOW()';
    } else if (status === 'delivered') {
      updateQuery += ', delivered_at = NOW()';
    }

    updateQuery += ' WHERE order_number = ?';
    params.push(orderNumber);

    await pool.execute(updateQuery, params);

    res.json({ message: 'Order status updated successfully' });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ message: 'Failed to update order status' });
  }
});

// DELETE /api/admin/orders/:orderNumber - Delete order completely (admin only)
router.delete('/orders/:orderNumber', validateOrderNumber, handleValidationErrors, requireAdmin, async (req, res) => {
  try {
    const { orderNumber } = req.params;

    // Get order
    const [orders] = await pool.execute(
      'SELECT id FROM orders WHERE order_number = ?',
      [orderNumber]
    );

    if (orders.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const orderId = orders[0].id;

    // Delete related records (cascade should handle this, but being explicit)
    await pool.execute('DELETE FROM refunds WHERE order_id = ?', [orderId]);
    await pool.execute('DELETE FROM payments WHERE order_id = ?', [orderId]);
    await pool.execute('DELETE FROM order_items WHERE order_id = ?', [orderId]);
    await pool.execute('DELETE FROM orders WHERE id = ?', [orderId]);

    res.json({ message: 'Order deleted successfully' });
  } catch (error) {
    console.error('Delete order error:', error);
    res.status(500).json({ message: 'Failed to delete order' });
  }
});



// NOTIFICATIONS

// Get notification statistics for admin dashboard
router.get("/notifications/statistics", requireAdmin, async (req, res) => {
  try {
    const [overallStats] = await pool.execute(`
      SELECT 
        COUNT(*) as total_notifications,
        COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent_notifications,
        COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_notifications,
        COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as scheduled_notifications,
        SUM(total_recipients) as total_recipients_reached
      FROM notifications
    `);

    // Category breakdown
    const [categoryStats] = await pool.execute(`
      SELECT 
        category,
        COUNT(*) as notification_count,
        SUM(total_recipients) as total_recipients,
        AVG(email_sent_count) as avg_email_sent
      FROM notifications 
      WHERE status = 'sent'
      GROUP BY category
    `);

    // Recent activity (last 30 days)
    const [recentActivity] = await pool.execute(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as notifications_created,
        SUM(total_recipients) as recipients_reached
      FROM notifications 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);

    // User engagement stats
    const [engagementStats] = await pool.execute(`
      SELECT 
        COUNT(*) as total_user_notifications,
        COUNT(CASE WHEN is_read = TRUE THEN 1 END) as read_notifications,
        COUNT(CASE WHEN email_opened = TRUE THEN 1 END) as email_opens,
        ROUND(AVG(TIMESTAMPDIFF(MINUTE, created_at, read_at)), 2) as avg_read_time_minutes
      FROM user_notifications
      WHERE is_deleted = FALSE
    `);

    res.json({
      success: true,
      data: {
        overall: overallStats[0],
        byCategory: categoryStats,
        recentActivity,
        engagement: engagementStats[0]
      }
    });

  } catch (error) {
    console.error('Error fetching notification statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics'
    });
  }
});

// Get all notifications with filtering and pagination
router.get("/notifications", validateAdminNotificationsQuery, handleValidationErrors, requireAdmin, async (req, res) => {
  try {
    const {
      status = 'all',
      category = 'all', 
      limit = 20,
      offset = 0,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    let query = `
      SELECT n.id, n.title, n.message, n.category, n.status, n.total_recipients,
      n.email_sent_count, n.push_sent_count, n.created_at, n.sent_at,
      u.name as created_by_name
      FROM notifications n
      LEFT JOIN users u ON n.created_by_admin_id = u.id
      WHERE 1=1
    `;
    const params = [];

    // Apply filters
    if (status !== 'all') {
      query += ' AND n.status = ?';
      params.push(status);
    }

    if (category !== 'all') {
      query += ' AND n.category = ?';
      params.push(category);
    }

    // Add sorting
    const validSortColumns = ['created_at', 'sent_at', 'status', 'category', 'total_recipients'];
    const validSortOrder = ['ASC', 'DESC'];
    
    if (validSortColumns.includes(sortBy) && validSortOrder.includes(sortOrder.toUpperCase())) {
      query += ` ORDER BY n.${sortBy} ${sortOrder.toUpperCase()}`;
    } else {
      query += ' ORDER BY n.created_at DESC';
    }

    // Add pagination
    query += ' LIMIT ? OFFSET ?';
    const limitNum = Number(limit) || 10;
		const offsetNum = Number(offset) || 0;
		params.push(limitNum, offsetNum);

    const [notifications] = await pool.execute(query, params);

    // Get total count for pagination
    let countQuery = `SELECT COUNT(*) as total FROM notifications n WHERE 1=1`;
    const countParams = [];

    if (status !== 'all') {
      countQuery += ' AND n.status = ?';
      countParams.push(status);
    }

    if (category !== 'all') {
      countQuery += ' AND n.category = ?';
      countParams.push(category);
    }

    const [countResult] = await pool.execute(countQuery, countParams);
    const total = countResult[0].total;

    res.json({
      success: true,
      data: {
        notifications,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: parseInt(offset) + parseInt(limit) < total
        }
      }
    });

  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications'
    });
  }
});

// Get single notification details
router.get("/notifications/:id", validateId, handleValidationErrors, requireAdmin, async (req, res) => {
  try {
    const notificationId = req.params.id;

    const [rows] = await pool.execute(
      `SELECT n.*, u.name as created_by_name
       FROM notifications n
       LEFT JOIN users u ON n.created_by_admin_id = u.id
       WHERE n.id = ?`,
      [notificationId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json(rows[0]);

  } catch (error) {
    console.error('Error fetching notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notification details'
    });
  }
});

// Create and send new notification
router.post("/notifications", validateAdminNotification, handleValidationErrors, requireAdmin, async (req, res) => {
  try {
    const {
      title,
      message,
      category,
      target_all_users = true,
      target_user_roles = null,
      target_specific_users = null,
      send_email = true,
      send_push = true
    } = req.body;

    // Validate required fields
    if (!title || !message || !category) {
      return res.status(400).json({
        success: false,
        message: 'Title, message, and category are required'
      });
    }

    // Validate category
    const validCategories = ['marketing_emails', 'order_updates', 'promotional_offers', 'general'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category'
      });
    }

    // Get admin ID from token (you'll need to implement this based on your auth system)
    const token = req.cookies.authToken;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const adminId = decoded.id;

    // Create the notification record
    const [result] = await pool.execute(
      `INSERT INTO notifications (title, message, category, target_all_users, target_user_roles, 
      target_specific_users, send_email, send_push, created_by_admin_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'sending')`,
      [
        title, 
        message, 
        category, 
        target_all_users, 
        target_user_roles ? JSON.stringify(target_user_roles) : null,
        target_specific_users ? JSON.stringify(target_specific_users) : null,
        send_email, 
        send_push, 
        adminId
      ]
    );

    const notificationId = result.insertId;

    // Process and send notifications
    const deliveryResult = await processNotificationDelivery(notificationId, {
      title,
      message,
      category,
      target_all_users,
      target_user_roles,
      target_specific_users,
      send_email,
      send_push
    });

    // Update notification with delivery stats
    await pool.execute(
      `UPDATE notifications 
       SET status = 'sent', total_recipients = ?, email_sent_count = ?, 
           push_sent_count = ?, sent_at = NOW()
       WHERE id = ?`,
      [deliveryResult.totalRecipients, deliveryResult.emailSent, deliveryResult.pushSent, notificationId]
    );
    
    // MANUALLY LOG THIS ACTION - Now we have the notification ID!
    try {
      await pool.execute(
        `INSERT INTO admin_activity_logs 
        (admin_id, action, entity_type, entity_id, new_value, 
         ip_address, user_agent, request_method, request_path, status_code)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          adminId,
          'sent_notification',
          'notification',
          notificationId,
          JSON.stringify({ 
            title, 
            category, 
            totalRecipients: deliveryResult.totalRecipients,
            emailSent: deliveryResult.emailSent,
            pushSent: deliveryResult.pushSent
          }),
          req.ip || req.connection.remoteAddress,
          req.get('user-agent') || null,
          'POST',
          req.path,
          201
        ]
      );
    } catch (logError) {
      console.error('Failed to log notification activity:', logError);
      // Don't fail the request if logging fails
    }

    res.status(201).json({
      success: true,
      message: 'Notification created and sent successfully',
      data: {
        id: notificationId,
        ...deliveryResult
      }
    });

  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create notification'
    });
  }
});

// // Send existing draft notification
router.post("/notifications/:id/send", validateId, handleValidationErrors, requireAdmin, async (req, res) => {
  try {
    const notificationId = req.params.id;

    // Get notification details
    const [notifications] = await pool.execute(
      'SELECT * FROM notifications WHERE id = ? AND status = "draft"',
      [notificationId]
    );

    if (notifications.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Draft notification not found'
      });
    }

    const notification = notifications[0];

    // Update status to sending
    await pool.execute(
      'UPDATE notifications SET status = "sending" WHERE id = ?',
      [notificationId]
    );

    // Process delivery
    const deliveryResult = await processNotificationDelivery(notificationId, {
      title: notification.title,
      message: notification.message,
      category: notification.category,
      target_all_users: notification.target_all_users,
      target_user_roles: notification.target_user_roles ? JSON.parse(notification.target_user_roles) : null,
      target_specific_users: notification.target_specific_users ? JSON.parse(notification.target_specific_users) : null,
      send_email: notification.send_email,
      send_push: notification.send_push
    });

    // Update with results
    await pool.execute(
      `UPDATE notifications 
       SET status = 'sent', total_recipients = ?, email_sent_count = ?, 
           push_sent_count = ?, sent_at = NOW()
       WHERE id = ?`,
      [deliveryResult.totalRecipients, deliveryResult.emailSent, deliveryResult.pushSent, notificationId]
    );

    res.json({
      success: true,
      message: 'Notification sent successfully',
      data: deliveryResult
    });

  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send notification'
    });
  }
});

// Delete notification
router.delete("/notifications/:id", validateId, handleValidationErrors, requireAdmin, async (req, res) => {
  try {
    const notificationId = req.params.id;

    const [result] = await pool.execute(
      'DELETE FROM notifications WHERE id = ?',
      [notificationId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification'
    });
  }
});



// ACTIVITY LOGGING

// Get admin activity logs with filtering and pagination
router.get("/activity-logs", validateActivityLogsQuery, handleValidationErrors, requireSuperAdmin, async (req, res) => {
  try {
    const {
      admin_id = 'all',
      action = 'all',
      entity_type = 'all',
      limit = 50,
      offset = 0,
      sortBy = 'created_at',
      sortOrder = 'DESC',
      search = '',
      date_from = '',
      date_to = ''
    } = req.query;

    let query = `
      SELECT 
        al.id,
        al.admin_id,
        al.action,
        al.entity_type,
        al.entity_id,
        al.old_value,
        al.new_value,
        al.ip_address,
        al.user_agent,
        al.request_method,
        al.request_path,
        al.status_code,
        al.created_at,
        u.name as admin_name,
        u.email as admin_email
      FROM admin_activity_logs al
      LEFT JOIN users u ON al.admin_id = u.id
      WHERE 1=1
    `;
    const params = [];

    // Apply filters
    if (admin_id !== 'all') {
      query += ' AND al.admin_id = ?';
      params.push(admin_id);
    }

    if (action !== 'all') {
      query += ' AND al.action = ?';
      params.push(action);
    }

    if (entity_type !== 'all') {
      query += ' AND al.entity_type = ?';
      params.push(entity_type);
    }

    if (search) {
      query += ' AND (al.action LIKE ? OR u.name LIKE ? OR u.email LIKE ? OR al.entity_id LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (date_from) {
      query += ' AND al.created_at >= ?';
      params.push(date_from);
    }

    if (date_to) {
      query += ' AND al.created_at <= ?';
      params.push(date_to + ' 23:59:59');
    }

    // Add sorting
    const validSortColumns = ['created_at', 'action', 'admin_name', 'entity_type'];
    const validSortOrder = ['ASC', 'DESC'];
    
    if (validSortColumns.includes(sortBy) && validSortOrder.includes(sortOrder.toUpperCase())) {
      const sortColumn = sortBy === 'admin_name' ? 'u.name' : `al.${sortBy}`;
      query += ` ORDER BY ${sortColumn} ${sortOrder.toUpperCase()}`;
    } else {
      query += ' ORDER BY al.created_at DESC';
    }

    // Add pagination
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [logs] = await pool.execute(query, params);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM admin_activity_logs al
      LEFT JOIN users u ON al.admin_id = u.id
      WHERE 1=1
    `;
    const countParams = [];

    if (admin_id !== 'all') {
      countQuery += ' AND al.admin_id = ?';
      countParams.push(admin_id);
    }

    if (action !== 'all') {
      countQuery += ' AND al.action = ?';
      countParams.push(action);
    }

    if (entity_type !== 'all') {
      countQuery += ' AND al.entity_type = ?';
      countParams.push(entity_type);
    }

    if (search) {
      countQuery += ' AND (al.action LIKE ? OR u.name LIKE ? OR u.email LIKE ? OR al.entity_id LIKE ?)';
      const searchTerm = `%${search}%`;
      countParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (date_from) {
      countQuery += ' AND al.created_at >= ?';
      countParams.push(date_from);
    }

    if (date_to) {
      countQuery += ' AND al.created_at <= ?';
      countParams.push(date_to + ' 23:59:59');
    }

    const [countResult] = await pool.execute(countQuery, countParams);
    const total = countResult[0].total;

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: parseInt(offset) + parseInt(limit) < total
        }
      }
    });

  } catch (error) {
    console.error('Error fetching admin activity logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch activity logs'
    });
  }
});

// Get activity log statistics
router.get("/activity-logs/statistics", requireSuperAdmin, async (req, res) => {
  try {
    // Overall stats
    const [overallStats] = await pool.execute(`
      SELECT 
        COUNT(*) as total_actions,
        COUNT(DISTINCT admin_id) as active_admins,
        COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 END) as actions_today,
        COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as actions_week
      FROM admin_activity_logs
    `);

    // Actions by type
    const [actionStats] = await pool.execute(`
      SELECT 
        action,
        COUNT(*) as count
      FROM admin_activity_logs 
      GROUP BY action
      ORDER BY count DESC
      LIMIT 10
    `);

    // Actions by entity type
    const [entityStats] = await pool.execute(`
      SELECT 
        entity_type,
        COUNT(*) as count
      FROM admin_activity_logs 
      WHERE entity_type IS NOT NULL
      GROUP BY entity_type
      ORDER BY count DESC
    `);

    // Most active admins
    const [adminStats] = await pool.execute(`
      SELECT 
        al.admin_id,
        u.name as admin_name,
        u.email as admin_email,
        COUNT(*) as action_count,
        MAX(al.created_at) as last_activity
      FROM admin_activity_logs al
      LEFT JOIN users u ON al.admin_id = u.id
      GROUP BY al.admin_id, u.name, u.email
      ORDER BY action_count DESC
      LIMIT 10
    `);

    // Recent activity timeline (last 7 days)
    const [timelineStats] = await pool.execute(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as action_count,
        COUNT(DISTINCT admin_id) as unique_admins
      FROM admin_activity_logs 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);

    res.json({
      success: true,
      data: {
        overall: overallStats[0],
        byAction: actionStats,
        byEntity: entityStats,
        mostActiveAdmins: adminStats,
        timeline: timelineStats
      }
    });

  } catch (error) {
    console.error('Error fetching activity log statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics'
    });
  }
});

// Export activity logs as CSV
router.get("/activity-logs/export", validateActivityLogsExport, handleValidationErrors, requireSuperAdmin, async (req, res) => {
  try {
    const {
      admin_id = 'all',
      action = 'all',
      entity_type = 'all',
      search = '',
      date_from = '',
      date_to = ''
    } = req.query;

    let query = `
      SELECT 
        al.id,
        u.name as admin_name,
        u.email as admin_email,
        al.action,
        al.entity_type,
        al.entity_id,
        al.ip_address,
        al.request_method,
        al.request_path,
        al.status_code,
        al.created_at
      FROM admin_activity_logs al
      LEFT JOIN users u ON al.admin_id = u.id
      WHERE 1=1
    `;
    const params = [];

    // Apply same filters
    if (admin_id !== 'all') {
      query += ' AND al.admin_id = ?';
      params.push(admin_id);
    }

    if (action !== 'all') {
      query += ' AND al.action = ?';
      params.push(action);
    }

    if (entity_type !== 'all') {
      query += ' AND al.entity_type = ?';
      params.push(entity_type);
    }

    if (search) {
      query += ' AND (al.action LIKE ? OR u.name LIKE ? OR u.email LIKE ? OR al.entity_id LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (date_from) {
      query += ' AND al.created_at >= ?';
      params.push(date_from);
    }

    if (date_to) {
      query += ' AND al.created_at <= ?';
      params.push(date_to + ' 23:59:59');
    }

    query += ' ORDER BY al.created_at DESC';

    const [rows] = await pool.execute(query, params);

    // Set CSV headers
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=admin-activity-logs-${Date.now()}.csv`);

    // Write CSV headers
    res.write("id,admin_name,admin_email,action,entity_type,entity_id,ip_address,request_method,request_path,status_code,created_at\n");
    
    // Write CSV data
    rows.forEach(row => {
      const safe = val => (val === null || val === undefined) ? "" : String(val).replace(/"/g, '""');
      
      res.write(`"${safe(row.id)}","${safe(row.admin_name)}","${safe(row.admin_email)}","${safe(row.action)}","${safe(row.entity_type)}","${safe(row.entity_id)}","${safe(row.ip_address)}","${safe(row.request_method)}","${safe(row.request_path)}","${safe(row.status_code)}","${safe(row.created_at)}"\n`);
    });
    
    res.end();
  } catch (error) {
    console.error('Error exporting activity logs:', error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to export CSV" 
    });
  }
});

// Get single activity log detail
router.get("/activity-logs/:id", validateId, handleValidationErrors, requireSuperAdmin, async (req, res) => {
  try {
    const logId = req.params.id;

    const [rows] = await pool.execute(
      `SELECT 
        al.*,
        u.name as admin_name,
        u.email as admin_email
       FROM admin_activity_logs al
       LEFT JOIN users u ON al.admin_id = u.id
       WHERE al.id = ?`,
      [logId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Activity log not found'
      });
    }

    res.json({
      success: true,
      data: rows[0]
    });

  } catch (error) {
    console.error('Error fetching activity log:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch activity log details'
    });
  }
});

// Get list of all admins for filter dropdown
router.get("/activity-logs/filters/admins", requireSuperAdmin, async (req, res) => {
  try {
    const [admins] = await pool.execute(`
      SELECT DISTINCT u.id, u.name, u.email
      FROM users u
      INNER JOIN admin_activity_logs al ON u.id = al.admin_id
      WHERE u.role = 'admin'
      ORDER BY u.name
    `);

    res.json({
      success: true,
      data: admins
    });
  } catch (error) {
    console.error('Error fetching admin list:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch admin list'
    });
  }
});

// Helper function to process notification delivery
async function processNotificationDelivery(notificationId, notificationData) {
  const {
    title,
    message,
    category,
    target_all_users,
    target_user_roles,
    target_specific_users,
    send_email,
    send_push
  } = notificationData;

  try {
    // Get target users (this part is correct)
    let targetUsers = [];

    if (target_all_users) {
      const [users] = await pool.execute(
        'SELECT id, name, email, role FROM users WHERE deleted_at IS NULL AND deactivated_at IS NULL'
      );
      targetUsers = users;
    } else if (target_user_roles && target_user_roles.length > 0) {
      const placeholders = target_user_roles.map(() => '?').join(',');
      const [users] = await pool.execute(
        `SELECT id, name, email, role FROM users 
         WHERE role IN (${placeholders}) AND deleted_at IS NULL AND deactivated_at IS NULL`,
        target_user_roles
      );
      targetUsers = users;
    } else if (target_specific_users && target_specific_users.length > 0) {
      const placeholders = target_specific_users.map(() => '?').join(',');
      const [users] = await pool.execute(
        `SELECT id, name, email, role FROM users 
         WHERE id IN (${placeholders}) AND deleted_at IS NULL AND deactivated_at IS NULL`,
        target_specific_users
      );
      targetUsers = users;
    }

    let emailSent = 0;
    let pushSent = 0;

    // Process each target user
    for (const user of targetUsers) {
      // Get user preferences
      const [preferences] = await pool.execute(
        'SELECT * FROM user_preferences WHERE user_id = ?',
        [user.id]
      );

      const userPrefs = preferences[0] || {
        notifications_email: true,
        notifications_push: true,
        marketing_emails: true,
        order_updates: true,
        promotional_offers: true
      };

      // FIXED: Check email conditions properly
      const userWantsEmail = userPrefs.notifications_email === true || userPrefs.notifications_email === 1;
      const userWantsCategoryEmail = getCategoryPreference(userPrefs, category);
      const shouldSendEmail = send_email && userWantsEmail && userWantsCategoryEmail;

      // FIXED: Check push conditions properly  
      const userWantsPush = userPrefs.notifications_push === true || userPrefs.notifications_push === 1;
      const shouldSendPush = send_push && userWantsPush;

      // FIXED: Skip user entirely if they don't want ANY notification
      if (!shouldSendEmail && !shouldSendPush) {
        continue;
      }

      // FIXED: Only create record if we're actually sending something
      await pool.execute(
        `INSERT INTO user_notifications (notification_id, user_id, email_sent, push_sent)
         VALUES (?, ?, FALSE, FALSE)`,
        [notificationId, user.id]
      );

      // FIXED: Send email only if ALL conditions are met
      if (shouldSendEmail) {
        try {
          await sendNotificationEmail(user.email, user.name, title, message, category);
          
          await pool.execute(
            `UPDATE user_notifications 
             SET email_sent = TRUE, email_sent_at = NOW() 
             WHERE notification_id = ? AND user_id = ?`,
            [notificationId, user.id]
          );
          
          emailSent++;
        } catch (emailError) {
          console.error(`Failed to send email to ${user.email}:`, emailError);
        }
      }

      // FIXED: Send push only if ALL conditions are met
      if (shouldSendPush) {
        try {
          await pool.execute(
            `UPDATE user_notifications 
             SET push_sent = TRUE, push_sent_at = NOW() 
             WHERE notification_id = ? AND user_id = ?`,
            [notificationId, user.id]
          );
          
          pushSent++;
        } catch (pushError) {
          console.error(`Failed to send push notification to user ${user.id}:`, pushError);
        }
      }
    }

    return {
      totalRecipients: targetUsers.length,
      emailSent,
      pushSent
    };

  } catch (error) {
    console.error('Error processing notification delivery:', error);
    throw error;
  }
}

// Helper function to check if user wants EMAIL notifications for this category
function getCategoryPreference(userPrefs, category) {
  // Each category maps to its specific preference setting
  switch (category) {
    case 'marketing_emails':
      return userPrefs.marketing_emails === true || userPrefs.marketing_emails === 1;
    case 'order_updates':
      return userPrefs.order_updates === true || userPrefs.order_updates === 1;
    case 'promotional_offers':
      return userPrefs.promotional_offers === true || userPrefs.promotional_offers === 1;
    case 'general':
      return true; // General notifications are always allowed if email notifications are enabled
    default:
      return true;
  }
}


// ADD THESE ROUTES TO YOUR admin-routes.js file

// ERROR MONITORING (Super Admin Only)

// Get error logs with filtering and pagination
router.get("/error-logs", validateErrorLogsQuery, handleValidationErrors, requireSuperAdmin, async (req, res) => {
  try {
    const {
      severity = 'all',
      error_type = 'all',
      resolved = 'all',
      user_id = 'all',
      limit = 50,
      offset = 0,
      sortBy = 'created_at',
      sortOrder = 'DESC',
      search = '',
      date_from = '',
      date_to = ''
    } = req.query;

    let query = `
      SELECT 
        el.id,
        el.error_type,
        el.error_message,
        el.severity,
        el.request_method,
        el.request_path,
        el.status_code,
        el.user_id,
        el.user_email,
        el.user_role,
        el.ip_address,
        el.resolved,
        el.resolved_at,
        el.created_at,
        u.name as user_name,
        ru.name as resolved_by_name
      FROM error_logs el
      LEFT JOIN users u ON el.user_id = u.id
      LEFT JOIN users ru ON el.resolved_by = ru.id
      WHERE 1=1
    `;
    const params = [];

    // Apply filters
    if (severity !== 'all') {
      query += ' AND el.severity = ?';
      params.push(severity);
    }

    if (error_type !== 'all') {
      query += ' AND el.error_type = ?';
      params.push(error_type);
    }

    if (resolved !== 'all') {
      const isResolved = resolved === 'true' || resolved === '1';
      query += ' AND el.resolved = ?';
      params.push(isResolved);
    }

    if (user_id !== 'all') {
      query += ' AND el.user_id = ?';
      params.push(user_id);
    }

    if (search) {
      query += ' AND (el.error_message LIKE ? OR el.error_type LIKE ? OR el.request_path LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (date_from) {
      query += ' AND el.created_at >= ?';
      params.push(date_from);
    }

    if (date_to) {
      query += ' AND el.created_at <= ?';
      params.push(date_to + ' 23:59:59');
    }

    // Add sorting
    const validSortColumns = ['created_at', 'severity', 'error_type', 'resolved'];
    const validSortOrder = ['ASC', 'DESC'];
    
    if (validSortColumns.includes(sortBy) && validSortOrder.includes(sortOrder.toUpperCase())) {
      query += ` ORDER BY el.${sortBy} ${sortOrder.toUpperCase()}`;
    } else {
      query += ' ORDER BY el.created_at DESC';
    }

    // Add pagination
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [errors] = await pool.execute(query, params);

    // Get total count for pagination
    let countQuery = `SELECT COUNT(*) as total FROM error_logs el WHERE 1=1`;
    const countParams = [];

    if (severity !== 'all') {
      countQuery += ' AND el.severity = ?';
      countParams.push(severity);
    }

    if (error_type !== 'all') {
      countQuery += ' AND el.error_type = ?';
      countParams.push(error_type);
    }

    if (resolved !== 'all') {
      const isResolved = resolved === 'true' || resolved === '1';
      countQuery += ' AND el.resolved = ?';
      countParams.push(isResolved);
    }

    if (user_id !== 'all') {
      countQuery += ' AND el.user_id = ?';
      countParams.push(user_id);
    }

    if (search) {
      countQuery += ' AND (el.error_message LIKE ? OR el.error_type LIKE ? OR el.request_path LIKE ?)';
      const searchTerm = `%${search}%`;
      countParams.push(searchTerm, searchTerm, searchTerm);
    }

    if (date_from) {
      countQuery += ' AND el.created_at >= ?';
      countParams.push(date_from);
    }

    if (date_to) {
      countQuery += ' AND el.created_at <= ?';
      countParams.push(date_to + ' 23:59:59');
    }

    const [countResult] = await pool.execute(countQuery, countParams);
    const total = countResult[0].total;

    res.json({
      success: true,
      data: {
        errors,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: parseInt(offset) + parseInt(limit) < total
        }
      }
    });

  } catch (error) {
    console.error('Error fetching error logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch error logs'
    });
  }
});

// Get error log statistics
router.get("/error-logs/statistics", requireSuperAdmin, async (req, res) => {
  try {
    // Overall stats
    const [overallStats] = await pool.execute(`
      SELECT 
        COUNT(*) as total_errors,
        COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_errors,
        COUNT(CASE WHEN severity = 'high' THEN 1 END) as high_errors,
        COUNT(CASE WHEN severity = 'medium' THEN 1 END) as medium_errors,
        COUNT(CASE WHEN severity = 'low' THEN 1 END) as low_errors,
        COUNT(CASE WHEN resolved = FALSE THEN 1 END) as unresolved_errors,
        COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 END) as errors_today,
        COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as errors_week
      FROM error_logs
    `);

    // Errors by type
    const [errorTypeStats] = await pool.execute(`
      SELECT 
        error_type,
        COUNT(*) as count,
        COUNT(CASE WHEN resolved = FALSE THEN 1 END) as unresolved
      FROM error_logs 
      GROUP BY error_type
      ORDER BY count DESC
      LIMIT 10
    `);

    // Errors by severity over time (last 7 days)
    const [timelineStats] = await pool.execute(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as total_errors,
        COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical,
        COUNT(CASE WHEN severity = 'high' THEN 1 END) as high,
        COUNT(CASE WHEN severity = 'medium' THEN 1 END) as medium,
        COUNT(CASE WHEN severity = 'low' THEN 1 END) as low
      FROM error_logs 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);

    // Most affected users
    const [affectedUsers] = await pool.execute(`
      SELECT 
        el.user_id,
        u.name as user_name,
        u.email as user_email,
        COUNT(*) as error_count,
        MAX(el.created_at) as last_error
      FROM error_logs el
      LEFT JOIN users u ON el.user_id = u.id
      WHERE el.user_id IS NOT NULL
      GROUP BY el.user_id, u.name, u.email
      ORDER BY error_count DESC
      LIMIT 10
    `);

    // Most common error paths
    const [pathStats] = await pool.execute(`
      SELECT 
        request_path,
        request_method,
        COUNT(*) as error_count,
        MAX(created_at) as last_occurrence
      FROM error_logs 
      WHERE request_path IS NOT NULL
      GROUP BY request_path, request_method
      ORDER BY error_count DESC
      LIMIT 10
    `);

    // Recent critical errors (last 24 hours)
    const [recentCritical] = await pool.execute(`
      SELECT 
        id,
        error_type,
        error_message,
        request_path,
        created_at
      FROM error_logs 
      WHERE severity = 'critical' 
        AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      ORDER BY created_at DESC
      LIMIT 5
    `);

    res.json({
      success: true,
      data: {
        overall: overallStats[0],
        byType: errorTypeStats,
        timeline: timelineStats,
        affectedUsers,
        errorPaths: pathStats,
        recentCritical
      }
    });

  } catch (error) {
    console.error('Error fetching error statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch error statistics'
    });
  }
});

// Export error logs as CSV
router.get("/error-logs/export", validateErrorLogsExport, handleValidationErrors, requireSuperAdmin, async (req, res) => {
  try {
    const {
      severity = 'all',
      error_type = 'all',
      resolved = 'all',
      search = '',
      date_from = '',
      date_to = ''
    } = req.query;

    let query = `
      SELECT 
        el.id,
        el.error_type,
        el.error_message,
        el.severity,
        el.request_method,
        el.request_path,
        el.status_code,
        el.user_email,
        el.user_role,
        el.ip_address,
        el.resolved,
        el.created_at,
        u.name as user_name
      FROM error_logs el
      LEFT JOIN users u ON el.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    // Apply same filters
    if (severity !== 'all') {
      query += ' AND el.severity = ?';
      params.push(severity);
    }

    if (error_type !== 'all') {
      query += ' AND el.error_type = ?';
      params.push(error_type);
    }

    if (resolved !== 'all') {
      const isResolved = resolved === 'true' || resolved === '1';
      query += ' AND el.resolved = ?';
      params.push(isResolved);
    }

    if (search) {
      query += ' AND (el.error_message LIKE ? OR el.error_type LIKE ? OR el.request_path LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (date_from) {
      query += ' AND el.created_at >= ?';
      params.push(date_from);
    }

    if (date_to) {
      query += ' AND el.created_at <= ?';
      params.push(date_to + ' 23:59:59');
    }

    query += ' ORDER BY el.created_at DESC';

    const [rows] = await pool.execute(query, params);

    // Set CSV headers
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=error-logs-${Date.now()}.csv`);

    // Write CSV headers
    res.write("id,error_type,error_message,severity,request_method,request_path,status_code,user_name,user_email,user_role,ip_address,resolved,created_at\n");
    
    // Write CSV data
    rows.forEach(row => {
      const safe = val => (val === null || val === undefined) ? "" : String(val).replace(/"/g, '""');
      const cleanMessage = safe(row.error_message).replace(/[\r\n]+/g, ' ').substring(0, 500);
      
      res.write(`"${safe(row.id)}","${safe(row.error_type)}","${cleanMessage}","${safe(row.severity)}","${safe(row.request_method)}","${safe(row.request_path)}","${safe(row.status_code)}","${safe(row.user_name)}","${safe(row.user_email)}","${safe(row.user_role)}","${safe(row.ip_address)}","${safe(row.resolved)}","${safe(row.created_at)}"\n`);
    });
    
    res.end();
  } catch (error) {
    console.error('Error exporting error logs:', error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to export CSV" 
    });
  }
});

// Get single error log details
router.get("/error-logs/:id", validateId, handleValidationErrors, requireSuperAdmin, async (req, res) => {
  try {
    const errorId = req.params.id;

    const [rows] = await pool.execute(
      `SELECT 
        el.*,
        u.name as user_name,
        u.email as user_email_full,
        ru.name as resolved_by_name,
        ru.email as resolved_by_email
       FROM error_logs el
       LEFT JOIN users u ON el.user_id = u.id
       LEFT JOIN users ru ON el.resolved_by = ru.id
       WHERE el.id = ?`,
      [errorId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Error log not found'
      });
    }

    res.json({
      success: true,
      data: rows[0]
    });

  } catch (error) {
    console.error('Error fetching error log:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch error log details'
    });
  }
});

// Mark error as resolved
router.put("/error-logs/:id/resolve", validateId, validateErrorResolve, handleValidationErrors, requireSuperAdmin, async (req, res) => {
  try {
    const errorId = req.params.id;
    const { resolution_notes } = req.body;
    const adminId = req.user.id;

    const [result] = await pool.execute(
      `UPDATE error_logs 
       SET resolved = TRUE, 
           resolved_at = NOW(), 
           resolved_by = ?,
           resolution_notes = ?
       WHERE id = ?`,
      [adminId, resolution_notes || null, errorId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Error log not found'
      });
    }

    res.json({
      success: true,
      message: 'Error marked as resolved'
    });

  } catch (error) {
    console.error('Error resolving error log:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resolve error log'
    });
  }
});

// Mark error as unresolved
router.put("/error-logs/:id/unresolve", validateId, handleValidationErrors, requireSuperAdmin, async (req, res) => {
  try {
    const errorId = req.params.id;

    const [result] = await pool.execute(
      `UPDATE error_logs 
       SET resolved = FALSE, 
           resolved_at = NULL, 
           resolved_by = NULL,
           resolution_notes = NULL
       WHERE id = ?`,
      [errorId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Error log not found'
      });
    }

    res.json({
      success: true,
      message: 'Error marked as unresolved'
    });

  } catch (error) {
    console.error('Error unresolving error log:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unresolve error log'
    });
  }
});

// Bulk resolve errors
router.post("/error-logs/bulk-resolve", validateBulkErrorResolve, handleValidationErrors, requireSuperAdmin, async (req, res) => {
  try {
    const { error_ids, resolution_notes } = req.body;
    const adminId = req.user.id;

    if (!error_ids || !Array.isArray(error_ids) || error_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid error IDs'
      });
    }

    const placeholders = error_ids.map(() => '?').join(',');
    const [result] = await pool.execute(
      `UPDATE error_logs 
       SET resolved = TRUE, 
           resolved_at = NOW(), 
           resolved_by = ?,
           resolution_notes = ?
       WHERE id IN (${placeholders})`,
      [adminId, resolution_notes || null, ...error_ids]
    );

    res.json({
      success: true,
      message: `${result.affectedRows} error(s) marked as resolved`
    });

  } catch (error) {
    console.error('Error bulk resolving errors:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk resolve errors'
    });
  }
});

// Delete error log
router.delete("/error-logs/:id", validateId, handleValidationErrors, requireSuperAdmin, async (req, res) => {
  try {
    const errorId = req.params.id;

    const [result] = await pool.execute(
      'DELETE FROM error_logs WHERE id = ?',
      [errorId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Error log not found'
      });
    }

    res.json({
      success: true,
      message: 'Error log deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting error log:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete error log'
    });
  }
});

// Bulk delete errors
router.post("/error-logs/bulk-delete", validateBulkErrorDelete, handleValidationErrors, requireSuperAdmin, async (req, res) => {
  try {
    const { error_ids } = req.body;

    if (!error_ids || !Array.isArray(error_ids) || error_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid error IDs'
      });
    }

    const placeholders = error_ids.map(() => '?').join(',');
    const [result] = await pool.execute(
      `DELETE FROM error_logs WHERE id IN (${placeholders})`,
      error_ids
    );

    res.json({
      success: true,
      message: `${result.affectedRows} error log(s) deleted successfully`
    });

  } catch (error) {
    console.error('Error bulk deleting errors:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk delete errors'
    });
  }
});

// Get unique error types for filter dropdown
router.get("/error-logs/filters/error-types", requireSuperAdmin, async (req, res) => {
  try {
    const [errorTypes] = await pool.execute(`
      SELECT DISTINCT error_type
      FROM error_logs
      ORDER BY error_type
    `);

    res.json({
      success: true,
      data: errorTypes.map(row => row.error_type)
    });
  } catch (error) {
    console.error('Error fetching error types:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch error types'
    });
  }
});



// ERROR MONITORING TEST LOGS

// Add to any admin route temporarily
router.get("/test-critical", requireSuperAdmin, async (req, res) => {
  const error = new Error("Database connection failed");
  error.name = "DatabaseError";
  await logError(error, { req }, 'critical');

  res.json({ test: 'done' });
});

router.get("/test-high", requireSuperAdmin, async (req, res) => {
  res.status(400)
  throw new Error("Bad request test");
});

router.get("/test-low", requireSuperAdmin, async (req, res) => {
  await logError(new Error("Minor issue"), { req }, 'low');
  res.json({ test: 'done' });
});

export default router;