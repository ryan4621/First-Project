// migrations/error-logs-mig.js

import pool from "../main.js";

export async function createErrorLogsTable() {
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS error_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        error_type VARCHAR(100) NOT NULL,
        error_message TEXT NOT NULL,
        stack_trace TEXT,
        severity ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
        
        -- Request context
        request_method VARCHAR(10),
        request_path VARCHAR(500),
        request_body JSON,
        request_query JSON,
        request_params JSON,
        
        -- User context
        user_id INT NULL,
        user_email VARCHAR(255),
        user_role VARCHAR(50),
        
        -- Technical details
        ip_address VARCHAR(45),
        user_agent TEXT,
        status_code INT,
        
        -- Additional context
        additional_data JSON,
        
        -- Resolution tracking
        resolved BOOLEAN DEFAULT FALSE,
        resolved_at DATETIME NULL,
        resolved_by INT NULL,
        resolution_notes TEXT,
        
        -- Metadata
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        
        INDEX idx_error_type (error_type),
        INDEX idx_severity (severity),
        INDEX idx_user_id (user_id),
        INDEX idx_created_at (created_at),
        INDEX idx_resolved (resolved),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // console.log("✅ error_logs table created successfully");
    return true;
  } catch (error) {
    console.error("❌ Error creating error_logs table:", error);
    throw error;
  }
}

export async function setupErrorLogCleanup() {
  try {
    // Use query() instead of execute() for CREATE EVENT (not supported in prepared statements)
    const connection = await pool.getConnection();
    
    try {
      await connection.query(`
        CREATE EVENT IF NOT EXISTS cleanup_old_error_logs
        ON SCHEDULE EVERY 1 DAY
        DO
          DELETE FROM error_logs 
          WHERE created_at < DATE_SUB(NOW(), INTERVAL 60 DAY)
      `);

      console.log("✅ Error logs cleanup event created (60-day retention)");
      
      // Check if event scheduler is enabled
      const [scheduler] = await connection.query("SHOW VARIABLES LIKE 'event_scheduler'");
      if (scheduler[0]?.Value === 'OFF') {
        console.log("⚠️  Event Scheduler is OFF. Enable it with: SET GLOBAL event_scheduler = ON;");
      }
      
      return true;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("❌ Error creating cleanup event:", error.message);
    // Don't throw - event scheduler might not be enabled
    console.log("⚠️  Note: Make sure MySQL Event Scheduler is enabled with: SET GLOBAL event_scheduler = ON;");
    console.log("⚠️  Alternative: You can manually delete old errors or create the event directly in MySQL console");
  }
}