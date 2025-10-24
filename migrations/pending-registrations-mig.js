// migrations/pending-registrations-mig.js

import pool from "../main.js";

export const createPendingRegistrationsTable = async () => {
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS pending_registrations (
        id INT PRIMARY KEY AUTO_INCREMENT,
        email VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(50) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        subscribe BOOLEAN DEFAULT FALSE,
        verification_token VARCHAR(64) UNIQUE NOT NULL,
        verification_token_expires DATETIME NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_verification_token (verification_token),
        INDEX idx_token_expires (verification_token_expires)
      )
    `);
    console.log("✅ pending_registrations table created successfully");
  } catch (error) {
    console.error("❌ Error creating pending_registrations table:", error.message);
    throw error;
  }
};

export default createPendingRegistrationsTable;