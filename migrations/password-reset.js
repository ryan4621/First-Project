import pool from "../main.js";

export async function passwordResetTable() {
    try {
  
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS password_resets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        reset_code VARCHAR(6) NOT NULL,
        expires_at DATETIME NOT NULL,
        used TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user (user_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);
      
    } catch (error) {
      console.error('❌ Error creating password reset table:', error);
      throw error;
    }
  }