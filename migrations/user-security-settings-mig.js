import pool from '../main.js';

export async function createUserSecuritySettingsTable() {
  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS user_security_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        two_factor_enabled BOOLEAN DEFAULT FALSE,
        two_factor_secret VARCHAR(255) NULL,
        backup_codes TEXT NULL,
        security_questions_enabled BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_security (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    await pool.execute(createTableQuery);
    // console.log('✅ user_security_settings table created successfully');
    
  } catch (error) {
    console.error('❌ Error creating user_security_settings table:', error);
    throw error;
  }
}

export async function dropUserSecuritySettingsTable() {
  try {
    await pool.execute('DROP TABLE IF EXISTS user_security_settings');
    console.log('✅ user_security_settings table dropped successfully');
  } catch (error) {
    console.error('❌ Error dropping user_security_settings table:', error);
    throw error;
  }
}