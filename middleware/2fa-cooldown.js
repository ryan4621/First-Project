import pool from "../main.js";

export async function check2faCooldown(req, res, next) {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // Check last 2FA code sent time
    const [results] = await pool.execute(
      `SELECT last_2fa_code_sent 
       FROM user_security_settings 
       WHERE user_id = ?`,
      [userId]
    );

    if (results.length === 0) {
      // No security settings yet, allow
      return next();
    }

    const lastSent = results[0].last_2fa_code_sent;
    
    if (lastSent) {
      const now = new Date();
      const cooldownPeriod = 60 * 1000; // 60 seconds
      const timeSinceLastSent = now - new Date(lastSent);
      
      if (timeSinceLastSent < cooldownPeriod) {
        const remainingSeconds = Math.ceil((cooldownPeriod - timeSinceLastSent) / 1000);
        return res.status(429).json({ 
          message: 'Please wait before requesting another 2FA code',
          remainingSeconds,
          cooldownSeconds: 60
        });
      }
    }

    next();
  } catch (error) {
    console.error('2FA cooldown check error:', error);
    next(error);
  }
}

export async function update2faTimestamp(userId) {
  try {
    await pool.execute(
      `UPDATE user_security_settings 
       SET last_2fa_code_sent = NOW() 
       WHERE user_id = ?`,
      [userId]
    );
  } catch (error) {
    console.error('Error updating 2FA timestamp:', error);
    throw error;
  }
}