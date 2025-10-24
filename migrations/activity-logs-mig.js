import pool from '../main.js';

export async function createActivityLogsTable() {
  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS activity_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        activity_type ENUM('login', 'logout', 'password_change', 'profile_update', '2fa_enabled', '2fa_disabled', 'session_terminated') NOT NULL,
        description TEXT NOT NULL,
        ip_address VARCHAR(45) NULL,
        device_info VARCHAR(500) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_activity (user_id),
        INDEX idx_activity_type (activity_type),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    await pool.execute(createTableQuery);
    // console.log('✅ activity_logs table created successfully');
    
  } catch (error) {
    console.error('❌ Error creating activity_logs table:', error);
    throw error;
  }
}

export async function dropActivityLogsTable() {
  try {
    await pool.execute('DROP TABLE IF EXISTS activity_logs');
    console.log('✅ activity_logs table dropped successfully');
  } catch (error) {
    console.error('❌ Error dropping activity_logs table:', error);
    throw error;
  }
}