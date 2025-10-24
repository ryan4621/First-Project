import pool from "../main.js";

export const ensureAddressesTable = async () => {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS addresses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      full_name VARCHAR(100) NOT NULL,
      phone VARCHAR(32) NULL,
      street VARCHAR(255) NOT NULL,
      city VARCHAR(100) NOT NULL,
      state VARCHAR(100) NULL,
      postal_code VARCHAR(20) NOT NULL,
      country VARCHAR(100) NOT NULL,
      is_default TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_addresses_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
};

// Optionally allow running this file directly to perform migration
if (process.argv[1]?.endsWith("addresses-mig.js")) {
  (async () => {
    try {
      await ensureAddressesTable();
      console.log("Addresses table is ready.");
      process.exit(0);
    } catch (err) {
      console.error("Migration failed:", err);
      process.exit(1);
    }
  })();
}