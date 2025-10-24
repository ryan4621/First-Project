import pool from '../main.js';

export async function createSecurityQuestionsTable() {
  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS user_security_questions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        question_1 VARCHAR(500) NOT NULL,
        answer_1 VARCHAR(500) NOT NULL,
        question_2 VARCHAR(500) NOT NULL,
        answer_2 VARCHAR(500) NOT NULL,
        question_3 VARCHAR(500) NOT NULL,
        answer_3 VARCHAR(500) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_questions (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    await pool.execute(createTableQuery);
    // console.log('✅ user_security_questions table created successfully');
    
  } catch (error) {
    console.error('❌ Error creating user_security_questions table:', error);
    throw error;
  }
}

export async function dropSecurityQuestionsTable() {
  try {
    await pool.execute('DROP TABLE IF EXISTS user_security_questions');
    console.log('✅ user_security_questions table dropped successfully');
  } catch (error) {
    console.error('❌ Error dropping user_security_questions table:', error);
    throw error;
  }
}