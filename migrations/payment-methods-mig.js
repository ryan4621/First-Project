// migrations/payment-methods-mig.js

import pool from '../main.js';

export async function createPaymentMethodsTable() {
  try {
    // console.log('Creating payment_methods table...');

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS payment_methods (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        stripe_payment_method_id VARCHAR(255) NOT NULL,
        type ENUM('card') DEFAULT 'card',
        card_brand VARCHAR(50),
        card_last4 VARCHAR(4),
        card_exp_month INT,
        card_exp_year INT,
        card_fingerprint VARCHAR(255),
        is_default BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_user_id (user_id),
        INDEX idx_stripe_pm_id (stripe_payment_method_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_stripe_pm (stripe_payment_method_id)
      )
    `);

    // console.log('✅ Payment_methods table created successfully');
  } catch (error) {
    console.error('❌ Error creating payment_methods table:', error);
    throw error;
  }
}