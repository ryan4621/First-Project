// migrations/contact-submissions-mig.js
import pool from '../main.js';

export const createContactSubmissionsTable = async () => {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS contact_submissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NULL,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(255) NOT NULL,
      subject ENUM(
        'general',
        'account', 
        'product',
        'technical',
        'billing',
        'feedback',
        'other'
      ) NOT NULL DEFAULT 'general',
      message TEXT NOT NULL,
      status ENUM('pending', 'in_progress', 'resolved', 'closed') NOT NULL DEFAULT 'pending',
      priority ENUM('low', 'normal', 'high', 'urgent') NOT NULL DEFAULT 'normal',
      admin_notes TEXT NULL,
      responded_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      -- Foreign key constraint
      CONSTRAINT fk_contact_user_id 
        FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
        
      -- Indexes for better query performance
      INDEX idx_contact_user_id (user_id),
      INDEX idx_contact_status (status),
      INDEX idx_contact_subject (subject),
      INDEX idx_contact_created_at (created_at),
      INDEX idx_contact_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  try {
    await pool.execute(createTableQuery);
    // console.log('✅ Contact submissions table created/verified successfully');
  } catch (error) {
    console.error('❌ Error creating contact submissions table:', error);
    throw error;
  }
};

export const addContactSubmissionsIndexes = async () => {
  const queries = [
    // Composite index for admin filtering
    `CREATE INDEX IF NOT EXISTS idx_contact_status_priority 
     ON contact_submissions (status, priority)`,
    
    // Index for searching by date range
    `CREATE INDEX IF NOT EXISTS idx_contact_date_status 
     ON contact_submissions (created_at, status)`,
     
    // Full-text search index for message content (optional)
    // `ALTER TABLE contact_submissions 
    //  ADD FULLTEXT(message, admin_notes) 
    //  -- Only if not exists check needed here`
  ];

  try {
    for (const query of queries) {
      try {
        await pool.execute(query);
      } catch (error) {
        // Ignore "already exists" errors
        if (!error.message.includes('already exists') && !error.message.includes('Duplicate')) {
          throw error;
        }
      }
    }
    // console.log('✅ Contact submissions indexes added successfully');
  } catch (error) {
    console.error('❌ Error adding contact submissions indexes:', error);
    throw error;
  }
};

// Helper function to get contact statistics (useful for admin dashboard)
export const getContactStatistics = async () => {
  try {
    const [statusStats] = await pool.execute(`
      SELECT 
        status,
        COUNT(*) as count,
        AVG(TIMESTAMPDIFF(HOUR, created_at, 
          CASE 
            WHEN responded_at IS NOT NULL THEN responded_at 
            ELSE NOW() 
          END)) as avg_response_time_hours
      FROM contact_submissions 
      GROUP BY status
    `);

    const [subjectStats] = await pool.execute(`
      SELECT 
        subject,
        COUNT(*) as count,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_count
      FROM contact_submissions 
      GROUP BY subject
      ORDER BY count DESC
    `);

    const [dailyStats] = await pool.execute(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as submissions
      FROM contact_submissions 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);

    return {
      byStatus: statusStats,
      bySubject: subjectStats,
      dailySubmissions: dailyStats
    };
  } catch (error) {
    console.error('❌ Error getting contact statistics:', error);
    throw error;
  }
};

// Migration runner (call this in your server.js)
export const runContactMigrations = async () => {
  // console.log('🚀 Running contact submissions migrations...');
  
  try {
    await createContactSubmissionsTable();
    await addContactSubmissionsIndexes();
    // console.log('✅ All contact migrations completed successfully');
  } catch (error) {
    console.error('❌ Contact migration failed:', error);
    process.exit(1);
  }
};