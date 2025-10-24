// migrations/ecommerce-tables-mig.js

import pool from '../main.js';

export async function createEcommerceTables() {
  try {
    // console.log('Creating e-commerce tables...');

    // Create carts table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS carts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        session_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_session_id (session_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Create cart_items table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS cart_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        cart_id INT NOT NULL,
        product_id VARCHAR(8) NOT NULL,
        quantity INT NOT NULL DEFAULT 1,
        price DECIMAL(10, 2) NOT NULL,
        size VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_cart_id (cart_id),
        INDEX idx_product_id (product_id),
        FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
        UNIQUE KEY unique_cart_product_size (cart_id, product_id, size)
      )
    `);

    // Create orders table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_number VARCHAR(20) UNIQUE NOT NULL,
        user_id INT,
        email VARCHAR(255) NOT NULL,
        status ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded') DEFAULT 'pending',
        payment_status ENUM('pending', 'paid', 'failed', 'refunded', 'partially_refunded') DEFAULT 'pending',
        payment_method ENUM('stripe', 'paypal') NOT NULL,
        payment_intent_id VARCHAR(255),
        subtotal DECIMAL(10, 2) NOT NULL,
        shipping_cost DECIMAL(10, 2) DEFAULT 0.00,
        tax_amount DECIMAL(10, 2) DEFAULT 0.00,
        total DECIMAL(10, 2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'USD',
        
        -- Shipping Address
        shipping_name VARCHAR(255) NOT NULL,
        shipping_phone VARCHAR(20),
        shipping_street VARCHAR(500) NOT NULL,
        shipping_city VARCHAR(100) NOT NULL,
        shipping_state VARCHAR(100),
        shipping_postal_code VARCHAR(20) NOT NULL,
        shipping_country VARCHAR(100) NOT NULL,
        
        -- Billing Address (optional, defaults to shipping)
        billing_name VARCHAR(255),
        billing_phone VARCHAR(20),
        billing_street VARCHAR(500),
        billing_city VARCHAR(100),
        billing_state VARCHAR(100),
        billing_postal_code VARCHAR(20),
        billing_country VARCHAR(100),
        
        notes TEXT,
        shipped_at TIMESTAMP NULL,
        delivered_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_user_id (user_id),
        INDEX idx_order_number (order_number),
        INDEX idx_status (status),
        INDEX idx_payment_status (payment_status),
        INDEX idx_payment_intent (payment_intent_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // Create order_items table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        product_id VARCHAR(8) NOT NULL,
        product_name VARCHAR(255) NOT NULL,
        product_brand VARCHAR(255),
        product_description TEXT,
        quantity INT NOT NULL,
        unit_price DECIMAL(10, 2) NOT NULL,
        total_price DECIMAL(10, 2) NOT NULL,
        size VARCHAR(20),
        image_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        INDEX idx_order_id (order_id),
        INDEX idx_product_id (product_id),
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      )
    `);

    // Create payments table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        stripe_payment_intent_id VARCHAR(255) UNIQUE,
        stripe_charge_id VARCHAR(255),
        amount DECIMAL(10, 2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'USD',
        status ENUM('pending', 'succeeded', 'failed', 'canceled') DEFAULT 'pending',
        payment_method VARCHAR(50),
        failure_reason TEXT,
        receipt_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_order_id (order_id),
        INDEX idx_stripe_intent (stripe_payment_intent_id),
        INDEX idx_status (status),
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      )
    `);

    // Create refunds table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS refunds (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        payment_id INT,
        stripe_refund_id VARCHAR(255) UNIQUE,
        amount DECIMAL(10, 2) NOT NULL,
        reason ENUM('requested_by_customer', 'duplicate', 'fraudulent', 'other') DEFAULT 'requested_by_customer',
        reason_description TEXT,
        status ENUM('pending', 'succeeded', 'failed', 'canceled') DEFAULT 'pending',
        refund_type ENUM('full', 'partial') DEFAULT 'full',
        processed_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_order_id (order_id),
        INDEX idx_payment_id (payment_id),
        INDEX idx_stripe_refund (stripe_refund_id),
        INDEX idx_status (status),
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL,
        FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // Create shipping_tracking table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS shipping_tracking (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        tracking_number VARCHAR(255),
        carrier VARCHAR(100),
        status VARCHAR(50) DEFAULT 'in_transit',
        estimated_delivery DATE,
        tracking_url VARCHAR(500),
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        INDEX idx_order_id (order_id),
        INDEX idx_tracking_number (tracking_number),
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      )
    `);

    // console.log('✅ E-commerce tables created successfully');
  } catch (error) {
    console.error('❌ Error creating e-commerce tables:', error);
    throw error;
  }
}

// Helper function to generate order numbers
export function generateOrderNumber() {
  const timestamp = Date.now().toString();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `ORD-${timestamp.slice(-8)}-${random}`;
}