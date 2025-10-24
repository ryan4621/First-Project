import pool from '../main.js';

export async function createUserPreferencesTable() {
  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS user_preferences (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        
        -- Notification Settings
        notifications_email BOOLEAN DEFAULT TRUE,
        notifications_sms BOOLEAN DEFAULT FALSE,
        notifications_push BOOLEAN DEFAULT TRUE,
        marketing_emails BOOLEAN DEFAULT TRUE,
        order_updates BOOLEAN DEFAULT TRUE,
        promotional_offers BOOLEAN DEFAULT TRUE,
        
        -- Language & Currency (en/es/fr, USD/EUR/GBP)
        language ENUM('en', 'es', 'fr') DEFAULT 'en',
        currency ENUM('USD', 'EUR', 'GBP') DEFAULT 'USD',
        
        -- Privacy Settings
        profile_visibility ENUM('public', 'private') DEFAULT 'public',
        show_online_status BOOLEAN DEFAULT TRUE,
        allow_search_engines BOOLEAN DEFAULT TRUE,
        
        -- Timestamps
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        -- Foreign key and constraints
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_preferences (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    await pool.execute(createTableQuery);
    // console.log('✅ user_preferences table created successfully');
    
  } catch (error) {
    console.error('❌ Error creating user_preferences table:', error);
    throw error;
  }
}

export async function dropUserPreferencesTable() {
  try {
    await pool.execute('DROP TABLE IF EXISTS user_preferences');
    console.log('✅ user_preferences table dropped successfully');
  } catch (error) {
    console.error('❌ Error dropping user_preferences table:', error);
    throw error;
  }
}