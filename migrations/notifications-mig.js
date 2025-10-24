// migrations/notifications-mig.js
import pool from '../main.js';

// Create notifications table for storing notification templates/campaigns
export const createNotificationsTable = async () => {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      category ENUM(
        'marketing_emails',
        'order_updates', 
        'promotional_offers',
        'general'
      ) NOT NULL DEFAULT 'general',
      
      -- Targeting options
      target_all_users BOOLEAN DEFAULT TRUE,
      target_user_roles JSON DEFAULT NULL, -- ['user', 'admin'] array
      target_specific_users JSON DEFAULT NULL, -- [1, 2, 3] user IDs array
      
      -- Channel settings
      send_email BOOLEAN DEFAULT TRUE,
      send_push BOOLEAN DEFAULT TRUE,
      
      -- Scheduling
      scheduled_for TIMESTAMP NULL,
      sent_at TIMESTAMP NULL,
      
      -- Status and metadata
      status ENUM('draft', 'scheduled', 'sending', 'sent', 'cancelled') DEFAULT 'draft',
      total_recipients INT DEFAULT 0,
      email_sent_count INT DEFAULT 0,
      push_sent_count INT DEFAULT 0,
      
      -- Admin info
      created_by_admin_id INT NOT NULL,
      
      -- Timestamps
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      -- Indexes for performance
      INDEX idx_notifications_category (category),
      INDEX idx_notifications_status (status),
      INDEX idx_notifications_scheduled (scheduled_for),
      INDEX idx_notifications_created_at (created_at)
      
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  try {
    await pool.execute(createTableQuery);
    // console.log('✅ Notifications table created successfully');
  } catch (error) {
    console.error('❌ Error creating notifications table:', error);
    throw error;
  }
};

// Create user_notifications table for tracking individual user notification delivery
export const createUserNotificationsTable = async () => {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS user_notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      notification_id INT NOT NULL,
      user_id INT NOT NULL,
      
      -- Delivery tracking
      email_sent BOOLEAN DEFAULT FALSE,
      email_sent_at TIMESTAMP NULL,
      email_opened BOOLEAN DEFAULT FALSE,
      email_opened_at TIMESTAMP NULL,
      
      push_sent BOOLEAN DEFAULT FALSE,
      push_sent_at TIMESTAMP NULL,
      push_read BOOLEAN DEFAULT FALSE,
      push_read_at TIMESTAMP NULL,
      
      -- User interaction
      is_read BOOLEAN DEFAULT FALSE,
      read_at TIMESTAMP NULL,
      is_deleted BOOLEAN DEFAULT FALSE,
      deleted_at TIMESTAMP NULL,
      
      -- Timestamps
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      -- Foreign key constraints
      FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      
      -- Ensure unique notification per user
      UNIQUE KEY unique_user_notification (notification_id, user_id),
      
      -- Indexes for performance
      INDEX idx_user_notifications_user_id (user_id),
      INDEX idx_user_notifications_read (is_read),
      INDEX idx_user_notifications_deleted (is_deleted),
      INDEX idx_user_notifications_created_at (created_at)
      
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  try {
    await pool.execute(createTableQuery);
    // console.log('✅ User notifications table created successfully');
  } catch (error) {
    console.error('❌ Error creating user_notifications table:', error);
    throw error;
  }
};

// Create notification templates table for reusable templates
export const createNotificationTemplatesTable = async () => {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS notification_templates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      category ENUM(
        'marketing_emails',
        'order_updates',
        'promotional_offers', 
        'general'
      ) NOT NULL,
      
      -- Template content
      subject_template VARCHAR(500) NOT NULL,
      message_template TEXT NOT NULL,
      email_html_template TEXT NULL,
      
      -- Template variables (JSON array of variable names)
      template_variables JSON DEFAULT NULL, -- ['user_name', 'product_name', etc.]
      
      -- Status
      is_active BOOLEAN DEFAULT TRUE,
      
      -- Admin info
      created_by_admin_id INT NOT NULL,
      
      -- Timestamps
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      -- Indexes
      INDEX idx_templates_category (category),
      INDEX idx_templates_active (is_active)
      
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  try {
    await pool.execute(createTableQuery);
    // console.log('✅ Notification templates table created successfully');
  } catch (error) {
    console.error('❌ Error creating notification_templates table:', error);
    throw error;
  }
};

// Helper function to get notification statistics
export const getNotificationStatistics = async () => {
  try {
    // Overall stats
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
        AVG(email_sent_count) as avg_email_opens
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

    return {
      overall: overallStats[0],
      byCategory: categoryStats,
      recentActivity,
      engagement: engagementStats[0]
    };
  } catch (error) {
    console.error('❌ Error getting notification statistics:', error);
    throw error;
  }
};

// Helper function to clean up old notifications
export const cleanupOldNotifications = async (daysToKeep = 90) => {
  try {
    const [result] = await pool.execute(`
      DELETE FROM user_notifications 
      WHERE is_deleted = TRUE 
      AND deleted_at < DATE_SUB(NOW(), INTERVAL ? DAY)
    `, [daysToKeep]);

    console.log(`🧹 Cleaned up ${result.affectedRows} old deleted user notifications`);
    return result.affectedRows;
  } catch (error) {
    console.error('❌ Error cleaning up old notifications:', error);
    throw error;
  }
};

// Migration runner
export const runNotificationMigrations = async () => {
  // console.log('🚀 Running notification system migrations...');
  
  try {
    await createNotificationsTable();
    await createUserNotificationsTable();
    await createNotificationTemplatesTable();
    // console.log('✅ All notification migrations completed successfully');
  } catch (error) {
    console.error('❌ Notification migration failed:', error);
    process.exit(1);
  }
};