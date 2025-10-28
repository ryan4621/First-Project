import pool from '../main.js';

export async function add2faCooldownColumn() {
  try {
    // Check if column already exists
    const [columns] = await pool.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'user_security_settings' 
      AND COLUMN_NAME = 'last_2fa_code_sent'
    `);

    if (columns.length === 0) {
      await pool.execute(`
        ALTER TABLE user_security_settings 
        ADD COLUMN last_2fa_code_sent TIMESTAMP NULL AFTER two_factor_code_expires
      `);
      console.log('✅ Added last_2fa_code_sent column to user_security_settings');
    }
  } catch (error) {
    console.error('❌ Error adding last_2fa_code_sent column:', error);
    throw error;
  }
}