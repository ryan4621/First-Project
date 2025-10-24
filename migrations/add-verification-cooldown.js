import pool from "../main.js";

export async function addVerificationCooldownColumn() {
  try {
    // Check if column already exists
    const [columns] = await pool.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'users' 
      AND COLUMN_NAME = 'last_verification_sent'
    `);

    if (columns.length === 0) {
      await pool.execute(`
        ALTER TABLE users 
        ADD COLUMN last_verification_sent DATETIME DEFAULT NULL 
        AFTER email_verified
      `);
      console.log('✅ Added last_verification_sent column to users table');
    } else {
      console.log('✅ last_verification_sent column already exists');
    }
  } catch (error) {
    console.error('❌ Error adding verification cooldown column:', error);
    throw error;
  }
}