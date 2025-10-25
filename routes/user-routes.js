//user-routes.js

import express from "express";
import pool from "../main.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { requireAuth } from "../middleware/auth.js";
import Stripe from "stripe";
import { countries } from "countries-list";
import crypto from "crypto";
import { generateOrderNumber } from "../migrations/ecommerce-tables-mig.js";
import {
	sendContactConfirmationEmail,
	sendContactNotificationToAdmin,
	sendPasswordResetEmail,
	sendPasswordResetConfirmation,
	sendVerificationEmail,
} from "../services/email-service.js";
import {
	validatePreferences,
	validatePasswordChange,
	validatePasswordResetRequest,
	validatePasswordResetCode,
	validatePasswordReset,
	validateProfile,
	validateProfilePhoto,
	validateAddress,
	validateCheckoutIntent,
	validateCheckoutConfirm,
	validateSavePaymentMethod,
	validateContact,
	validateAddToCart,
	validateCartUpdate,
	validateCartMerge,
	validate2FAToggle,
	validateSecurityQuestions,
	validateAccountDeactivation,
	validateAccountDelete,
	validateRefundRequest,
	validateId,
	validateBulkNotifications,
	validateOrderNumber,
	validateOrderCancel,
	handleValidationErrors,
} from "../middleware/validation.js";

const router = express.Router();
dotenv.config();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// SETTINGS

// Get user preferences
router.get("/preferences", requireAuth, async (req, res) => {
	try {
		const userId = req.user.id;

		// Get user preferences or create default if doesn't exist
		let [preferences] = await pool.execute(
			`SELECT * FROM user_preferences WHERE user_id = ?`,
			[userId]
		);

		// If no preferences exist, create default ones
		if (preferences.length === 0) {
			await pool.execute(`INSERT INTO user_preferences (user_id) VALUES (?)`, [
				userId,
			]);

			// Fetch the newly created preferences
			[preferences] = await pool.execute(
				`SELECT * FROM user_preferences WHERE user_id = ?`,
				[userId]
			);
		}

		res.json({ preferences: preferences[0] });
	} catch (err) {
		console.error(err);
		res.status(500).json({ message: "Failed to fetch preferences" });
	}
});

// Update user preferences
router.put(
	"/preferences",
	validatePreferences,
	handleValidationErrors,
	requireAuth,
	async (req, res) => {
		try {
			const userId = req.user.id;

			const {
				notifications_email,
				notifications_sms,
				notifications_push,
				marketing_emails,
				order_updates,
				promotional_offers,
				language,
				currency,
				profile_visibility,
				show_online_status,
				allow_search_engines,
			} = req.body;

			// Validate enum values
			const validLanguages = ["en", "es", "fr"];
			const validCurrencies = ["USD", "EUR", "GBP"];
			const validVisibility = ["public", "private"];

			if (language && !validLanguages.includes(language)) {
				return res.status(400).json({ message: "Invalid language" });
			}
			if (currency && !validCurrencies.includes(currency)) {
				return res.status(400).json({ message: "Invalid currency" });
			}
			if (profile_visibility && !validVisibility.includes(profile_visibility)) {
				return res.status(400).json({ message: "Invalid profile visibility" });
			}

			// Check if preferences exist
			const [existing] = await pool.execute(
				`SELECT id FROM user_preferences WHERE user_id = ?`,
				[userId]
			);

			if (existing.length === 0) {
				// Create new preferences
				await pool.execute(
					`INSERT INTO user_preferences (
            user_id, notifications_email, notifications_sms, notifications_push,
            marketing_emails, order_updates, promotional_offers, language, currency,
            profile_visibility, show_online_status, allow_search_engines
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
					[
						userId,
						notifications_email !== undefined ? notifications_email : true,
						notifications_sms !== undefined ? notifications_sms : false,
						notifications_push !== undefined ? notifications_push : true,
						marketing_emails !== undefined ? marketing_emails : true,
						order_updates !== undefined ? order_updates : true,
						promotional_offers !== undefined ? promotional_offers : true,
						language || "en",
						currency || "USD",
						profile_visibility || "public",
						show_online_status !== undefined ? show_online_status : true,
						allow_search_engines !== undefined ? allow_search_engines : true,
					]
				);
			} else {
				// Update existing preferences - only update provided fields
				const updates = [];
				const values = [];

				if (notifications_email !== undefined) {
					updates.push("notifications_email = ?");
					values.push(notifications_email);
				}
				if (notifications_sms !== undefined) {
					updates.push("notifications_sms = ?");
					values.push(notifications_sms);
				}
				if (notifications_push !== undefined) {
					updates.push("notifications_push = ?");
					values.push(notifications_push);
				}
				if (marketing_emails !== undefined) {
					updates.push("marketing_emails = ?");
					values.push(marketing_emails);
				}
				if (order_updates !== undefined) {
					updates.push("order_updates = ?");
					values.push(order_updates);
				}
				if (promotional_offers !== undefined) {
					updates.push("promotional_offers = ?");
					values.push(promotional_offers);
				}
				if (language !== undefined) {
					updates.push("language = ?");
					values.push(language);
				}
				if (currency !== undefined) {
					updates.push("currency = ?");
					values.push(currency);
				}
				if (profile_visibility !== undefined) {
					updates.push("profile_visibility = ?");
					values.push(profile_visibility);
				}
				if (show_online_status !== undefined) {
					updates.push("show_online_status = ?");
					values.push(show_online_status);
				}
				if (allow_search_engines !== undefined) {
					updates.push("allow_search_engines = ?");
					values.push(allow_search_engines);
				}

				if (updates.length > 0) {
					values.push(userId);
					await pool.execute(
						`UPDATE user_preferences SET ${updates.join(
							", "
						)}, updated_at = NOW() WHERE user_id = ?`,
						values
					);
				}
			}

			// Fetch updated preferences to return
			const [updatedPrefs] = await pool.execute(
				`SELECT * FROM user_preferences WHERE user_id = ?`,
				[userId]
			);

			res.json({
				message: "Preferences updated successfully",
				preferences: updatedPrefs[0],
			});

			// After preferences update, add:
			await logUserActivity(
				userId,
				"profile_update",
				"Account preferences updated",
				req
			);
		} catch (err) {
			console.error(err);
			res.status(500).json({ message: "Failed to update preferences" });
		}
	}
);

// Reset preferences to default
router.post("/preferences/reset", requireAuth, async (req, res) => {
	try {
		const userId = req.user.id;

		// Delete existing preferences (will be recreated with defaults on next GET)
		await pool.execute(`DELETE FROM user_preferences WHERE user_id = ?`, [
			userId,
		]);

		// Create new default preferences
		await pool.execute(`INSERT INTO user_preferences (user_id) VALUES (?)`, [
			userId,
		]);

		// Fetch the new default preferences
		const [preferences] = await pool.execute(
			`SELECT * FROM user_preferences WHERE user_id = ?`,
			[userId]
		);

		res.json({
			message: "Preferences reset to defaults successfully",
			preferences: preferences[0],
		});
		// After preferences update, add:
		await logUserActivity(
			userId,
			"profile_update",
			"Account preferences reset to default",
			req
		);
	} catch (err) {
		console.error(err);
		res.status(500).json({ message: "Failed to reset preferences" });
	}
});

// Change password for regular users
router.post(
	"/change-password",
	validatePasswordChange,
	handleValidationErrors,
	requireAuth,
	async (req, res) => {
		try {
			const userId = req.user.id;

			const { oldPassword, newPassword } = req.body;
			if (!oldPassword || !newPassword) {
				return res
					.status(400)
					.json({ message: "Both old and new password are required" });
			}

			// Fetch current password
			const [rows] = await pool.execute(
				"SELECT password FROM users WHERE id = ?",
				[userId]
			);
			if (rows.length === 0)
				return res.status(404).json({ message: "User not found" });

			const user = rows[0];
			const match = await bcrypt.compare(oldPassword, user.password);
			if (!match)
				return res.status(401).json({ message: "Old password is incorrect" });

			// Hash new password
			const hashedPassword = await bcrypt.hash(newPassword, 10);

			await pool.execute("UPDATE users SET password = ? WHERE id = ?", [
				hashedPassword,
				userId,
			]);

			// Delete ALL sessions (log out everywhere)
			await pool.execute("DELETE FROM user_sessions WHERE user_id = ?", [
				userId,
			]);

			// Clear cookie immediately
			res.clearCookie("authToken", {
				httpOnly: true,
				secure: true,
				sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'none',
			});

			res.json({ message: "Password updated successfully" });

			// After password update, add:
			await logUserActivity(
				userId,
				"password_change",
				"Password changed successfully",
				req
			);
		} catch (err) {
			console.error(err);
			res.status(500).json({ message: "Failed to update password" });
		}
	}
);

// Password Reset: Request reset code
router.post(
	"/password-reset/request",
	validatePasswordResetRequest,
	handleValidationErrors,
	async (req, res) => {
		try {
			const { email } = req.body;

			if (!email) {
				return res.status(400).json({ message: "Email is required" });
			}

			// Check if user exists
			const [users] = await pool.execute(
				"SELECT id, email, name FROM users WHERE email = ?",
				[email]
			);

			if (users.length === 0) {
				// Don't reveal if email exists or not (security best practice)
				return res.json({
					message: "If that email exists, a reset code has been sent",
				});
			}

			const user = users[0];

			// Generate 6-digit code
			const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
			const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

			// Store reset code in database
			await pool.execute(
				`INSERT INTO password_resets (user_id, reset_code, expires_at) 
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE reset_code = ?, expires_at = ?, used = 0`,
				[user.id, resetCode, expiresAt, resetCode, expiresAt]
			);

			// Send email with reset code
			await sendPasswordResetEmail(user.email, user.name, resetCode);

			res.json({ message: "Reset code sent to your email" });
		} catch (err) {
			console.error(err);
			res
				.status(500)
				.json({ message: "Failed to process password reset request" });
		}
	}
);

// Password Reset: Verify code
router.post(
	"/password-reset/verify",
	validatePasswordResetCode,
	handleValidationErrors,
	async (req, res) => {
		try {
			const { email, code } = req.body;

			if (!email || !code) {
				return res.status(400).json({ message: "Email and code are required" });
			}

			// Get user and reset code
			const [results] = await pool.execute(
				`SELECT pr.*, u.id as user_id 
         FROM password_resets pr
         JOIN users u ON pr.user_id = u.id
         WHERE u.email = ? AND pr.reset_code = ? AND pr.used = 0 AND pr.expires_at > NOW()`,
				[email, code]
			);

			if (results.length === 0) {
				return res
					.status(400)
					.json({ message: "Invalid or expired reset code" });
			}

			// Generate a temporary reset token
			const resetToken = jwt.sign(
				{ userId: results[0].user_id, purpose: "password-reset" },
				process.env.JWT_SECRET,
				{ expiresIn: "15m" }
			);

			res.json({ message: "Code verified", resetToken });
		} catch (err) {
			console.error(err);
			res.status(500).json({ message: "Failed to verify reset code" });
		}
	}
);

// Password Reset: Reset password
router.post(
	"/password-reset/reset",
	validatePasswordReset,
	handleValidationErrors,
	async (req, res) => {
		try {
			const { email, resetToken, newPassword } = req.body;

			if (!email || !resetToken || !newPassword) {
				return res.status(400).json({ message: "All fields are required" });
			}

			// Verify reset token
			let decoded;
			try {
				decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
				if (decoded.purpose !== "password-reset") {
					throw new Error("Invalid token purpose");
				}
			} catch (err) {
				return res
					.status(400)
					.json({ message: "Invalid or expired reset token" });
			}

			const userId = decoded.userId;

			// Get user info for email
			const [users] = await pool.execute(
				"SELECT email, name FROM users WHERE id = ?",
				[userId]
			);

			if (users.length === 0) {
				return res.status(404).json({ message: "User not found" });
			}

			const user = users[0];

			// Hash new password
			const hashedPassword = await bcrypt.hash(newPassword, 10);

			// Update password
			await pool.execute("UPDATE users SET password = ? WHERE id = ?", [
				hashedPassword,
				userId,
			]);

			// Delete ALL sessions to force user to login with new password
			await pool.execute("DELETE FROM user_sessions WHERE user_id = ?", [
				userId,
			]);

			// Mark reset code as used
			await pool.execute(
				"UPDATE password_resets SET used = 1 WHERE user_id = ?",
				[userId]
			);

			// Send confirmation email
			await sendPasswordResetConfirmation(user.email, user.name);

			// Log activity
			await logUserActivity(
				userId,
				"password_change",
				"Password reset via forgot password",
				null
			);

			res.json({ message: "Password reset successfully" });
		} catch (err) {
			console.error(err);
			res.status(500).json({ message: "Failed to reset password" });
		}
	}
);

// Get user's 2FA status
router.get("/2fa/status", requireAuth, async (req, res) => {
	try {
		const userId = req.user.id;

		let [rows] = await pool.execute(
			"SELECT two_factor_enabled FROM user_security_settings WHERE user_id = ?",
			[userId]
		);

		// If no security settings exist, create defaults
		if (rows.length === 0) {
			await pool.execute(
				"INSERT INTO user_security_settings (user_id) VALUES (?)",
				[userId]
			);

			[rows] = await pool.execute(
				"SELECT two_factor_enabled FROM user_security_settings WHERE user_id = ?",
				[userId]
			);
		}

		res.json({
			enabled: Boolean(rows[0].two_factor_enabled),
			message: "2FA status retrieved",
		});
	} catch (err) {
		console.error(err);
		res.status(500).json({ message: "Failed to get 2FA status" });
	}
});

// Enable/Disable 2FA with password verification
router.post(
	"/2fa/toggle",
	validate2FAToggle,
	handleValidationErrors,
	requireAuth,
	async (req, res) => {
		try {
			const userId = req.user.id;

			const { enable, password } = req.body;

			if (typeof enable !== "boolean") {
				return res
					.status(400)
					.json({ message: "Enable parameter must be boolean" });
			}

			if (!password) {
				return res.status(400).json({ message: "Password is required" });
			}

			// Verify password
			const [userRows] = await pool.execute(
				"SELECT password, email, email_verified FROM users WHERE id = ?",
				[userId]
			);

			if (userRows.length === 0) {
				return res.status(404).json({ message: "User not found" });
			}

			const user = userRows[0];

			// Check password
			const passwordMatch = await bcrypt.compare(password, user.password);
			if (!passwordMatch) {
				return res.status(401).json({ message: "Incorrect password" });
			}

			// If enabling 2FA, check if email is verified
			if (enable && !user.email_verified) {
				return res.status(400).json({
					message: "Please verify your email address before enabling 2FA",
					emailVerified: false,
				});
			}

			// Check if security settings exist
			const [existing] = await pool.execute(
				"SELECT id FROM user_security_settings WHERE user_id = ?",
				[userId]
			);

			if (existing.length === 0) {
				// Create new security settings
				await pool.execute(
					"INSERT INTO user_security_settings (user_id, two_factor_enabled) VALUES (?, ?)",
					[userId, enable ? 1 : 0]
				);
			} else {
				// Update existing settings
				await pool.execute(
					"UPDATE user_security_settings SET two_factor_enabled = ? WHERE user_id = ?",
					[enable ? 1 : 0, userId]
				);
			}

			res.json({
				message: `2FA ${enable ? "enabled" : "disabled"} successfully`,
				enabled: enable,
			});

			// Log activity
			await logUserActivity(
				userId,
				enable ? "2fa_enabled" : "2fa_disabled",
				`Two-factor authentication ${enable ? "enabled" : "disabled"}`,
				req
			);
		} catch (err) {
			console.error(err);
			res.status(500).json({ message: "Failed to toggle 2FA" });
		}
	}
);

// Get user's active sessions
router.get("/sessions", requireAuth, async (req, res) => {
	try {
		const userId = req.user.id;

		const [rows] = await pool.execute(
			`SELECT id, device_info, ip_address, location, is_current, created_at, last_active, expires_at
         FROM user_sessions 
         WHERE user_id = ? AND (expires_at IS NULL OR expires_at > NOW())
         ORDER BY is_current DESC, last_active DESC`,
			[userId]
		);

		res.json({ sessions: rows });
	} catch (err) {
		console.error(err);
		res.status(500).json({ message: "Failed to fetch sessions" });
	}
});

// Terminate a specific session
router.delete(
	"/sessions/:sessionId",
	validateId,
	handleValidationErrors,
	requireAuth,
	async (req, res) => {
		try {
			const userId = req.user.id;
			const sessionId = req.params.sessionId;

			// Check if session belongs to user
			const [existing] = await pool.execute(
				"SELECT id, is_current FROM user_sessions WHERE id = ? AND user_id = ?",
				[sessionId, userId]
			);

			if (existing.length === 0) {
				return res.status(404).json({ message: "Session not found" });
			}

			if (existing[0].is_current) {
				return res
					.status(400)
					.json({ message: "Cannot terminate current session" });
			}

			await pool.execute(
				"DELETE FROM user_sessions WHERE id = ? AND user_id = ?",
				[sessionId, userId]
			);

			res.json({ message: "Session terminated successfully" });

			// In DELETE /sessions/:sessionId, after successful termination:
			await logUserActivity(
				userId,
				"session_terminated",
				"Login session terminated",
				req
			);
		} catch (err) {
			console.error(err);
			res.status(500).json({ message: "Failed to terminate session" });
		}
	}
);

// Terminate all other sessions (except current)
router.post("/sessions/terminate-all", requireAuth, async (req, res) => {
	try {
		const userId = req.user.id;

		await pool.execute(
			"DELETE FROM user_sessions WHERE user_id = ? AND is_current = FALSE",
			[userId]
		);

		res.json({ message: "All other sessions terminated successfully" });

		// In POST /sessions/terminate-all, after successful termination:
		await logUserActivity(
			userId,
			"session_terminated",
			"All other sessions terminated",
			req
		);
	} catch (err) {
		console.error(err);
		res.status(500).json({ message: "Failed to terminate sessions" });
	}
});

// Helper function to parse user agent
function parseUserAgent(userAgent) {
	const ua = userAgent.toLowerCase();

	// Detect browser
	let browser = "Unknown";
	if (ua.includes("chrome") && !ua.includes("edg")) browser = "Chrome";
	else if (ua.includes("firefox")) browser = "Firefox";
	else if (ua.includes("safari") && !ua.includes("chrome")) browser = "Safari";
	else if (ua.includes("edg")) browser = "Edge";
	else if (ua.includes("opera")) browser = "Opera";

	// Detect OS
	let os = "Unknown";
	if (ua.includes("windows")) os = "Windows";
	else if (ua.includes("mac")) os = "macOS";
	else if (ua.includes("linux")) os = "Linux";
	else if (ua.includes("android")) os = "Android";
	else if (ua.includes("iphone") || ua.includes("ipad")) os = "iOS";

	return `${browser} on ${os}`;
}

// Helper function to log user activity
export async function logUserActivity(
	userId,
	activityType,
	description,
	req = null
) {
	try {
		const ipAddress = req
			? req.ip || req.connection.remoteAddress || req.headers["x-forwarded-for"]
			: null;
		const deviceInfo = req
			? parseUserAgent(req.headers["user-agent"] || "Unknown Device")
			: null;

		await pool.execute(
			`INSERT INTO activity_logs (user_id, activity_type, description, ip_address, device_info)
         VALUES (?, ?, ?, ?, ?)`,
			[userId, activityType, description, ipAddress, deviceInfo]
		);
	} catch (error) {
		console.error("Failed to log activity:", error);
	}
}

// Get user's activity logs
router.get("/activity-logs", requireAuth, async (req, res) => {
	try {
		const userId = req.user.id;

		const limit = Number(req.query.limit) || 10;
		const offset = Number(req.query.offset) || 0;

		const [rows] = await pool.execute(
			`SELECT activity_type, description, ip_address, device_info, created_at
         FROM activity_logs 
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
			[userId, limit, offset]
		);

		res.json({ activities: rows });
	} catch (err) {
		console.error(err);
		res.status(500).json({ message: "Failed to fetch activity logs" });
	}
});

// Get security questions status
router.get("/security-questions/status", requireAuth, async (req, res) => {
	try {
		const userId = req.user.id;

		const [rows] = await pool.execute(
			"SELECT id FROM user_security_questions WHERE user_id = ?",
			[userId]
		);

		res.json({
			hasQuestions: rows.length > 0,
			message: "Security questions status retrieved",
		});
	} catch (err) {
		console.error(err);
		res
			.status(500)
			.json({ message: "Failed to get security questions status" });
	}
});

// Set up security questions
router.post(
	"/security-questions",
	validateSecurityQuestions,
	handleValidationErrors,
	requireAuth,
	async (req, res) => {
		try {
			const userId = req.user.id;

			const { question1, answer1, question2, answer2, question3, answer3 } =
				req.body;

			// Validate all fields are provided
			if (
				!question1 ||
				!answer1 ||
				!question2 ||
				!answer2 ||
				!question3 ||
				!answer3
			) {
				return res
					.status(400)
					.json({ message: "All questions and answers are required" });
			}

			// Hash the answers for security
			const hashedAnswer1 = await bcrypt.hash(answer1.toLowerCase().trim(), 10);
			const hashedAnswer2 = await bcrypt.hash(answer2.toLowerCase().trim(), 10);
			const hashedAnswer3 = await bcrypt.hash(answer3.toLowerCase().trim(), 10);

			// Check if questions already exist
			const [existing] = await pool.execute(
				"SELECT id FROM user_security_questions WHERE user_id = ?",
				[userId]
			);

			if (existing.length > 0) {
				// Update existing questions
				await pool.execute(
					`UPDATE user_security_questions 
           SET question_1 = ?, answer_1 = ?, question_2 = ?, answer_2 = ?, question_3 = ?, answer_3 = ?
           WHERE user_id = ?`,
					[
						question1,
						hashedAnswer1,
						question2,
						hashedAnswer2,
						question3,
						hashedAnswer3,
						userId,
					]
				);
			} else {
				// Insert new questions
				await pool.execute(
					`INSERT INTO user_security_questions (user_id, question_1, answer_1, question_2, answer_2, question_3, answer_3)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
					[
						userId,
						question1,
						hashedAnswer1,
						question2,
						hashedAnswer2,
						question3,
						hashedAnswer3,
					]
				);
			}

			await logUserActivity(
				userId,
				"profile_update",
				"Security questions updated",
				req
			);

			res.json({ message: "Security questions saved successfully" });
		} catch (err) {
			console.error(err);
			res.status(500).json({ message: "Failed to save security questions" });
		}
	}
);

// Deactivate account (requires admin reactivation)
router.post(
	"/account/deactivate",
	validateAccountDeactivation,
	handleValidationErrors,
	requireAuth,
	async (req, res) => {
		try {
			const userId = req.user.id;

			const { password } = req.body;
			if (!password) {
				return res
					.status(400)
					.json({ message: "Password confirmation required" });
			}

			// Verify password before deactivation
			const [rows] = await pool.execute(
				"SELECT password FROM users WHERE id = ?",
				[userId]
			);
			if (rows.length === 0)
				return res.status(404).json({ message: "User not found" });

			const match = await bcrypt.compare(password, rows[0].password);
			if (!match)
				return res.status(401).json({ message: "Incorrect password" });

			// Set deactivation timestamp
			await pool.execute(
				"UPDATE users SET deactivated_at = NOW() WHERE id = ?",
				[userId]
			);

			// Terminate all user sessions
			await pool.execute("DELETE FROM user_sessions WHERE user_id = ?", [
				userId,
			]);

			await logUserActivity(
				userId,
				"profile_update",
				"Account deactivated by user",
				req
			);

			// Clear the auth cookie
			res.clearCookie("authToken", {
				httpOnly: true,
				secure: true,
				sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'none',
			});

			res.json({ message: "Account deactivated successfully" });
		} catch (err) {
			console.error(err);
			res.status(500).json({ message: "Failed to deactivate account" });
		}
	}
);

// Delete account (soft delete - scheduled for deletion)
router.post(
	"/account/delete",
	validateAccountDelete,
	handleValidationErrors,
	requireAuth,
	async (req, res) => {
		try {
			const userId = req.user.id;

			const { password } = req.body;
			if (!password) {
				return res
					.status(400)
					.json({ message: "Password confirmation required" });
			}

			// Verify password before deletion
			const [rows] = await pool.execute(
				"SELECT password FROM users WHERE id = ?",
				[userId]
			);
			if (rows.length === 0)
				return res.status(404).json({ message: "User not found" });

			const match = await bcrypt.compare(password, rows[0].password);
			if (!match)
				return res.status(401).json({ message: "Incorrect password" });

			// Mark account as scheduled for deletion (soft delete)
			await pool.execute("UPDATE users SET deleted_at = NOW() WHERE id = ?", [
				userId,
			]);

			// Terminate all user sessions
			await pool.execute("DELETE FROM user_sessions WHERE user_id = ?", [
				userId,
			]);

			await logUserActivity(
				userId,
				"profile_update",
				"Account scheduled for deletion by user",
				req
			);

			// Clear the auth cookie
			res.clearCookie("authToken", {
				httpOnly: true,
				secure: true,
				sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'none',
			});

			res.json({ message: "Account deleted successfully" });
		} catch (err) {
			console.error(err);
			res.status(500).json({ message: "Failed to delete account" });
		}
	}
);

// REFUNDS

// POST /api/refunds/request - Request a refund
router.post(
	"/refunds/request",
	validateRefundRequest,
	handleValidationErrors,
	requireAuth,
	async (req, res) => {
		try {
			const userId = req.user.id;

			const {
				orderId,
				reason,
				reasonDescription,
				refundType = "full",
				amount,
			} = req.body;

			if (!orderId || !reason) {
				return res
					.status(400)
					.json({ message: "Order ID and reason are required" });
			}

			// Validate refund type
			const validRefundTypes = ["full", "partial"];
			if (!validRefundTypes.includes(refundType)) {
				return res.status(400).json({ message: "Invalid refund type" });
			}

			// Validate reason
			const validReasons = [
				"requested_by_customer",
				"duplicate",
				"fraudulent",
				"other",
			];
			if (!validReasons.includes(reason)) {
				return res.status(400).json({ message: "Invalid refund reason" });
			}

			// Get order details
			const [orders] = await pool.execute(
				`
        SELECT 
          id, order_number, user_id, status, payment_status, total, payment_intent_id,
          created_at
        FROM orders 
        WHERE id = ? AND user_id = ?
      `,
				[orderId, userId]
			);

			if (orders.length === 0) {
				return res.status(404).json({ message: "Order not found" });
			}

			const order = orders[0];

			// Check if order is eligible for refund
			if (order.payment_status !== "paid") {
				return res.status(400).json({
					message: "Order is not eligible for refund",
					reason: "Payment not completed or already refunded",
				});
			}

			// Check if order is too old (e.g., more than 30 days)
			const orderAge = Date.now() - new Date(order.created_at).getTime();
			const maxRefundAge = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

			if (orderAge > maxRefundAge && reason === "requested_by_customer") {
				return res.status(400).json({
					message: "Refund request period has expired",
					maxDays: 30,
				});
			}

			// Check if refund already exists
			const [existingRefunds] = await pool.execute(
				'SELECT id, status FROM refunds WHERE order_id = ? AND status IN ("pending", "succeeded")',
				[orderId]
			);

			if (existingRefunds.length > 0) {
				return res.status(400).json({
					message: "Refund request already exists for this order",
					status: existingRefunds[0].status,
				});
			}

			// Calculate refund amount
			let refundAmount = parseFloat(order.total);
			if (refundType === "partial") {
				if (!amount || amount <= 0 || amount > refundAmount) {
					return res.status(400).json({
						message: "Invalid partial refund amount",
						maxAmount: refundAmount,
					});
				}
				refundAmount = parseFloat(amount);
			}

			// Create refund request
			const [refundResult] = await pool.execute(
				`
        INSERT INTO refunds (
          order_id, amount, reason, reason_description, status, refund_type
        ) VALUES (?, ?, ?, ?, 'pending', ?)
      `,
				[orderId, refundAmount, reason, reasonDescription || null, refundType]
			);

			res.status(201).json({
				message: "Refund request submitted successfully",
				refundId: refundResult.insertId,
				amount: refundAmount,
				status: "pending",
				orderNumber: order.order_number,
			});
		} catch (error) {
			console.error("Request refund error:", error);
			res.status(500).json({ message: "Failed to submit refund request" });
		}
	}
);

// GET /api/refunds - Get user's refund history
router.get("/refunds", requireAuth, async (req, res) => {
	try {
		const userId = req.user.id;

		const [refunds] = await pool.execute(
			`
        SELECT 
          r.id, r.order_id, r.amount, r.reason, r.reason_description,
          r.status, r.refund_type, r.created_at, r.updated_at,
          o.order_number, o.total as order_total
        FROM refunds r
        JOIN orders o ON r.order_id = o.id
        WHERE o.user_id = ?
        ORDER BY r.created_at DESC
      `,
			[userId]
		);

		res.json({ refunds });
	} catch (error) {
		console.error("Get refunds error:", error);
		res.status(500).json({ message: "Failed to fetch refunds" });
	}
});

// GET /api/refunds/:refundId - Get specific refund details
router.get(
	"/refunds/:refundId",
	validateId,
	handleValidationErrors,
	requireAuth,
	async (req, res) => {
		try {
			const userId = req.user.id;
			const { refundId } = req.params;

			const [refunds] = await pool.execute(
				`
        SELECT 
          r.id, r.order_id, r.amount, r.reason, r.reason_description,
          r.status, r.refund_type, r.stripe_refund_id, r.created_at, r.updated_at,
          o.order_number, o.user_id, o.total as order_total, o.payment_intent_id
        FROM refunds r
        JOIN orders o ON r.order_id = o.id
        WHERE r.id = ?
      `,
				[refundId]
			);

			if (refunds.length === 0) {
				return res.status(404).json({ message: "Refund not found" });
			}

			const refund = refunds[0];

			// Verify refund belongs to user
			if (refund.user_id !== userId) {
				return res
					.status(403)
					.json({ message: "Unauthorized access to refund" });
			}

			res.json({ refund });
		} catch (error) {
			console.error("Get refund details error:", error);
			res.status(500).json({ message: "Failed to fetch refund details" });
		}
	}
);

// PROFILE

// Update user profile
router.put(
	"/profile",
	validateProfile,
	handleValidationErrors,
	requireAuth,
	async (req, res) => {
		try {
			const userId = req.user.id;

			const { name, email, phone, country, gender } = req.body;

			// Get current user data to check if email changed
			const [currentUser] = await pool.execute(
				"SELECT email FROM users WHERE id = ?",
				[userId]
			);

			const emailChanged = currentUser[0].email !== email;

			// If email changed, set email_verified to FALSE and generate new verification token
			if (emailChanged) {
				const verificationToken = crypto.randomBytes(32).toString("hex");
				const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

				await pool.execute(
					"UPDATE users SET name = ?, email = ?, phone = ?, gender = ?, country = ?, email_verified = FALSE, verification_token = ?, verification_token_expires = ? WHERE id = ?",
					[
						name,
						email,
						phone,
						gender,
						country,
						verificationToken,
						tokenExpires,
						userId,
					]
				);

				// Send verification email
				const verificationUrl = `${process.env.WEBSITE_URL}/auth/verify-email?token=${verificationToken}`;
				await sendVerificationEmail(email, name, verificationUrl);
			} else {
				// Email didn't change, normal update
				await pool.execute(
					`UPDATE users 
           SET name = ?, email = ?, phone = ?, country = ?, gender = ? 
           WHERE id = ?`,
					[name, email, phone || null, country || null, gender || null, userId]
				);
			}

			// Fetch updated user data to return
			const [updatedUser] = await pool.execute(
				"SELECT id, name, email, phone, country, gender, email_verified FROM users WHERE id = ?",
				[userId]
			);

			res.json({
				message: emailChanged
					? "Profile updated. Please verify your new email address."
					: "Profile updated successfully",
				user: updatedUser[0],
				emailChanged: emailChanged,
			});

			// After the profile update query, add:
			await logUserActivity(
				userId,
				"profile_update",
				emailChanged
					? "Profile and email updated, verification required"
					: "Profile information updated",
				req
			);
		} catch (err) {
			console.error(err);
			res.status(500).json({ message: "Failed to update profile" });
		}
	}
);

// Get logged-in user's profile
router.get("/profile", requireAuth, async (req, res) => {
	try {
		const userId = req.user.id;

		const [rows] = await pool.execute(
			`SELECT id, name, email, phone, country, gender, role, subscribe, created_at, email_verified
         FROM users
         WHERE id = ?`,
			[userId]
		);

		if (rows.length === 0) {
			return res.status(404).json({ message: "User not found" });
		}

		res.json({ user: rows[0] });
	} catch (err) {
		console.error(err);
		res.status(500).json({ message: "Failed to fetch profile" });
	}
});

// Get user by ID
router.get(
	"/users/:id",
	validateId,
	handleValidationErrors,
	requireAuth,
	async (req, res) => {
		try {
			if (req.user.id != req.params.id) return res.sendStatus(403);

			const [rows] = await pool.execute(
				"SELECT id, name, email, phone, gender, country FROM users WHERE id = ?",
				[req.params.id]
			);

			if (rows.length === 0) return res.sendStatus(404);

			res.json(rows[0]);
		} catch (err) {
			console.error(err);
			res.sendStatus(500);
		}
	}
);

router.get("/countries", (req, res) => {
	const countryList = Object.values(countries).map((c) => c.name);
	res.json(countryList);
});

// Update profile photo endpoint using ImageKit
router.put(
	"/update-profile-photo",
	validateProfilePhoto,
	handleValidationErrors,
	requireAuth,
	async (req, res) => {
		try {
			const userId = req.user.id;

			// Get image URL from request body
			const { profile_image } = req.body;
			if (!profile_image) {
				return res
					.status(400)
					.json({ message: "Profile image URL is required" });
			}

			// Update user's profile image in database
			const [result] = await pool.execute(
				"UPDATE users SET profile_image = ? WHERE id = ?",
				[profile_image, userId]
			);

			if (result.affectedRows === 0) {
				return res.status(404).json({ message: "User not found" });
			}

			res.status(200).json({
				success: true,
				message: "Profile photo updated successfully",
				profile_image: profile_image,
			});
		} catch (err) {
			console.error("Profile photo update error:", err);
			res.status(500).json({
				success: false,
				message: "Failed to update profile photo",
			});
		}
	}
);

// Delete profile picture
router.delete("/delete-profile-photo", requireAuth, async (req, res) => {
	try {
		const userId = req.user.id;

		// Remove profile image from database
		const [result] = await pool.execute(
			"UPDATE users SET profile_image = NULL WHERE id = ?",
			[userId]
		);

		if (result.affectedRows === 0) {
			return res.status(404).json({ message: "User not found" });
		}

		res.json({
			success: true,
			message: "Profile picture deleted successfully",
		});
	} catch (err) {
		console.error("Delete profile photo error:", err);
		res.status(500).json({
			success: false,
			message: "Failed to delete profile picture",
		});
	}
});

// CHECKOUT / PAYMENT

// POST /api/checkout/create-intent - Create payment intent
router.post(
	"/checkout/create-intent",
	validateCheckoutIntent,
	handleValidationErrors,
	requireAuth,
	async (req, res) => {
		try {
			const {
				shippingAddress,
				billingAddress,
				saveAddress = false,
				paymentMethodId,
				orderNotes,
			} = req.body;

			// Validate shipping address
			if (
				!shippingAddress ||
				!shippingAddress.name ||
				!shippingAddress.street ||
				!shippingAddress.city ||
				!shippingAddress.postalCode ||
				!shippingAddress.country
			) {
				return res
					.status(400)
					.json({ message: "Complete shipping address is required" });
			}

			// Get user's cart
			const [carts] = await pool.execute(
				"SELECT id FROM carts WHERE user_id = ?",
				[req.user.id]
			);

			if (carts.length === 0) {
				return res.status(400).json({ message: "Cart not found" });
			}

			const cartId = carts[0].id;

			// Get cart items with product details
			const [items] = await pool.execute(
				`
      SELECT 
        ci.product_id,
        ci.quantity,
        ci.price,
        ci.size,
        p.name,
        p.description,
        p.image_url,
        p.stock
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.product_id
      WHERE ci.cart_id = ?
    `,
				[cartId]
			);

			if (items.length === 0) {
				return res.status(400).json({ message: "Cart is empty" });
			}

			// Validate stock availability
			for (const item of items) {
				if (item.quantity > item.stock) {
					return res.status(400).json({
						message: `Insufficient stock for ${item.name}`,
						availableStock: item.stock,
						requestedQuantity: item.quantity,
					});
				}
			}

			// Calculate totals
			const subtotal = items.reduce(
				(sum, item) => sum + parseFloat(item.price) * item.quantity,
				0
			);
			const shipping = subtotal > 100 ? 0 : 24; // Free shipping over $100
			const tax = subtotal * 0.08; // 8% tax rate (adjust based on location)
			const total = subtotal + shipping + tax;

			// Generate order number
			const orderNumber = generateOrderNumber();

			// Create order in database first
			const [orderResult] = await pool.execute(
				`
      INSERT INTO orders (
        order_number, user_id, email, status, payment_status, payment_method,
        subtotal, shipping_cost, tax_amount, total, currency,
        shipping_name, shipping_phone, shipping_street, shipping_city, 
        shipping_state, shipping_postal_code, shipping_country,
        billing_name, billing_phone, billing_street, billing_city,
        billing_state, billing_postal_code, billing_country,
        notes
      ) VALUES (?, ?, ?, 'pending', 'pending', 'stripe', ?, ?, ?, ?, 'USD', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
				[
					orderNumber,
					req.user.id,
					shippingAddress.email || "",
					subtotal,
					shipping,
					tax,
					total,
					shippingAddress.name,
					shippingAddress.phone || null,
					shippingAddress.street,
					shippingAddress.city,
					shippingAddress.state || null,
					shippingAddress.postalCode,
					shippingAddress.country,
					billingAddress?.name || shippingAddress.name,
					billingAddress?.phone || shippingAddress.phone || null,
					billingAddress?.street || shippingAddress.street,
					billingAddress?.city || shippingAddress.city,
					billingAddress?.state || shippingAddress.state || null,
					billingAddress?.postalCode || shippingAddress.postalCode,
					billingAddress?.country || shippingAddress.country,
					orderNotes || null,
				]
			);

			const orderId = orderResult.insertId;

			// Add order items
			for (const item of items) {
				await pool.execute(
					`
        INSERT INTO order_items (
          order_id, product_id, product_name, product_brand, product_description,
          quantity, unit_price, total_price, size, image_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
					[
						orderId,
						item.product_id,
						item.name,
						"Brand Name", // You might want to add brand to products table
						item.description,
						item.quantity,
						item.price,
						parseFloat(item.price) * item.quantity,
						item.size,
						item.image_url,
					]
				);
			}

			// Check if using existing payment method
			let existingPaymentMethod = null;
			let stripeCustomerId = null;

			if (paymentMethodId) {
				const [pmRows] = await pool.execute(
					"SELECT stripe_payment_method_id FROM payment_methods WHERE id = ? AND user_id = ?",
					[paymentMethodId, req.user.id]
				);

				if (pmRows.length > 0) {
					existingPaymentMethod = pmRows[0].stripe_payment_method_id;

					// Get the user's Stripe customer ID
					const [userRows] = await pool.execute(
						"SELECT stripe_customer_id FROM users WHERE id = ?",
						[req.user.id]
					);

					if (userRows.length > 0 && userRows[0].stripe_customer_id) {
						stripeCustomerId = userRows[0].stripe_customer_id;
					}
				}
			}

			// Create Stripe PaymentIntent
			const paymentIntentOptions = {
				amount: Math.round(total * 100),
				currency: "usd",
				metadata: {
					orderId: orderId.toString(),
					orderNumber: orderNumber,
					userId: req.user.id.toString(),
				},
				shipping: {
					name: shippingAddress.name,
					phone: shippingAddress.phone,
					address: {
						line1: shippingAddress.street,
						city: shippingAddress.city,
						state: shippingAddress.state,
						postal_code: shippingAddress.postalCode,
						country: shippingAddress.country,
					},
				},
			};

			// If using existing payment method, include customer and payment method
			if (existingPaymentMethod && stripeCustomerId) {
				paymentIntentOptions.customer = stripeCustomerId;
				paymentIntentOptions.payment_method = existingPaymentMethod;
			}

			const paymentIntent = await stripe.paymentIntents.create(
				paymentIntentOptions
			);

			// Update order with payment intent ID
			await pool.execute(
				"UPDATE orders SET payment_intent_id = ? WHERE id = ?",
				[paymentIntent.id, orderId]
			);

			// Create payment record
			await pool.execute(
				`
      INSERT INTO payments (order_id, stripe_payment_intent_id, amount, currency, status)
      VALUES (?, ?, ?, 'USD', 'pending')
    `,
				[orderId, paymentIntent.id, total]
			);

			// Optionally save address if requested
			if (saveAddress) {
				// Check if address already exists
				const [existingAddress] = await pool.execute(
					"SELECT id FROM addresses WHERE user_id = ? AND street = ? AND city = ? AND postal_code = ?",
					[
						req.user.id,
						shippingAddress.street,
						shippingAddress.city,
						shippingAddress.postalCode,
					]
				);

				if (existingAddress.length === 0) {
					await pool.execute(
						`
          INSERT INTO addresses (
            user_id, full_name, phone, street, city, state, postal_code, country, is_default
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
        `,
						[
							req.user.id,
							shippingAddress.name,
							shippingAddress.phone,
							shippingAddress.street,
							shippingAddress.city,
							shippingAddress.state,
							shippingAddress.postalCode,
							shippingAddress.country,
						]
					);
				}
			}

			res.json({
				clientSecret: paymentIntent.client_secret,
				orderId: orderId,
				orderNumber: orderNumber,
				total: total,
				publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
			});
		} catch (error) {
			console.error("Create payment intent error:", error);
			res.status(500).json({ message: "Failed to create payment intent" });
		}
	}
);

// POST /api/checkout/confirm - Confirm payment after successful Stripe payment
router.post(
	"/checkout/confirm",
	validateCheckoutConfirm,
	handleValidationErrors,
	requireAuth,
	async (req, res) => {
		try {
			const { paymentIntentId } = req.body;

			if (!paymentIntentId) {
				return res
					.status(400)
					.json({ message: "Payment intent ID is required" });
			}

			// Verify payment with Stripe
			const paymentIntent = await stripe.paymentIntents.retrieve(
				paymentIntentId
			);

			if (paymentIntent.status !== "succeeded") {
				return res.status(400).json({
					message: "Payment not completed",
					status: paymentIntent.status,
				});
			}

			// Get order from database
			const [orders] = await pool.execute(
				"SELECT id, order_number, user_id FROM orders WHERE payment_intent_id = ?",
				[paymentIntentId]
			);

			if (orders.length === 0) {
				return res.status(404).json({ message: "Order not found" });
			}

			const order = orders[0];

			// Verify order belongs to user
			if (order.user_id !== req.user.id) {
				return res
					.status(403)
					.json({ message: "Unauthorized access to order" });
			}

			// Update order and payment status
			await pool.execute(
				'UPDATE orders SET status = "processing", payment_status = "paid" WHERE id = ?',
				[order.id]
			);

			await pool.execute(
				'UPDATE payments SET status = "succeeded", stripe_charge_id = ? WHERE stripe_payment_intent_id = ?',
				[paymentIntent.latest_charge, paymentIntentId]
			);

			// Clear user's cart
			const [carts] = await pool.execute(
				"SELECT id FROM carts WHERE user_id = ?",
				[req.user.id]
			);

			if (carts.length > 0) {
				await pool.execute("DELETE FROM cart_items WHERE cart_id = ?", [
					carts[0].id,
				]);
			}

			// Update product stock
			const [orderItems] = await pool.execute(
				"SELECT product_id, quantity FROM order_items WHERE order_id = ?",
				[order.id]
			);

			for (const item of orderItems) {
				await pool.execute(
					"UPDATE products SET stock = stock - ? WHERE product_id = ?",
					[item.quantity, item.product_id]
				);
			}

			res.json({
				message: "Payment confirmed successfully",
				orderId: order.id,
				orderNumber: order.order_number,
				status: "processing",
			});
		} catch (error) {
			console.error("Confirm payment error:", error);
			res.status(500).json({ message: "Failed to confirm payment" });
		}
	}
);

router.get("/checkout/payment-methods", requireAuth, async (req, res) => {
	try {
		const userId = req.user.id;

		const [rows] = await pool.execute(
			`SELECT id, stripe_payment_method_id, type, card_brand, card_last4, 
              card_exp_month, card_exp_year, is_default
       FROM payment_methods 
       WHERE user_id = ? 
       ORDER BY is_default DESC, created_at DESC`,
			[userId]
		);

		res.json({
			paymentMethods: rows,
			hasPaymentMethods: rows.length > 0,
		});
	} catch (err) {
		console.error(err);
		res.status(500).json({ message: "Failed to fetch payment methods" });
	}
});

// Stripe webhook handler
router.post(
	"/webhooks/stripe",
	express.raw({ type: "application/json" }),
	async (req, res) => {
		const sig = req.headers["stripe-signature"];
		let event;

		try {
			event = stripe.webhooks.constructEvent(
				req.body,
				sig,
				process.env.STRIPE_WEBHOOK_SECRET
			);
		} catch (err) {
			console.error("Webhook signature verification failed:", err.message);
			return res.status(400).send(`Webhook Error`);
		}

		try {
			switch (event.type) {
				case "payment_intent.succeeded":
					const paymentIntent = event.data.object;
					await handlePaymentSucceeded(paymentIntent);
					break;

				case "payment_intent.payment_failed":
					const failedPayment = event.data.object;
					await handlePaymentFailed(failedPayment);
					break;

				case "charge.dispute.created":
					const dispute = event.data.object;
					await handleChargeDispute(dispute);
					break;

				default:
					console.log(`Unhandled event type ${event.type}`);
			}

			res.json({ received: true });
		} catch (error) {
			console.error("Webhook processing error:", error);
			res.status(500).json({ error: "Webhook processing failed" });
		}
	}
);

// Helper functions for webhook handling
async function handlePaymentSucceeded(paymentIntent) {
	try {
		const [orders] = await pool.execute(
			"SELECT id FROM orders WHERE payment_intent_id = ?",
			[paymentIntent.id]
		);

		if (orders.length > 0) {
			await pool.execute(
				'UPDATE orders SET payment_status = "paid", status = "processing" WHERE id = ?',
				[orders[0].id]
			);

			await pool.execute(
				'UPDATE payments SET status = "succeeded", receipt_url = ? WHERE stripe_payment_intent_id = ?',
				[paymentIntent.charges?.data[0]?.receipt_url || null, paymentIntent.id]
			);
		}
	} catch (error) {
		console.error("Handle payment succeeded error:", error);
	}
}

async function handlePaymentFailed(paymentIntent) {
	try {
		const [orders] = await pool.execute(
			"SELECT id FROM orders WHERE payment_intent_id = ?",
			[paymentIntent.id]
		);

		if (orders.length > 0) {
			await pool.execute(
				'UPDATE orders SET payment_status = "failed" WHERE id = ?',
				[orders[0].id]
			);

			await pool.execute(
				'UPDATE payments SET status = "failed", failure_reason = ? WHERE stripe_payment_intent_id = ?',
				[
					paymentIntent.last_payment_error?.message || "Payment failed",
					paymentIntent.id,
				]
			);
		}
	} catch (error) {
		console.error("Handle payment failed error:", error);
	}
}

async function handleChargeDispute(dispute) {
	try {
		// Log dispute for manual review
		console.log("Charge dispute created:", dispute.id);
		// You might want to send an email notification to admins here
	} catch (error) {
		console.error("Handle charge dispute error:", error);
	}
}

// PAYMENT METHODS

// GET /api/payment-methods - Get user's saved payment methods
router.get("/payment-methods", requireAuth, async (req, res) => {
	try {
		const [paymentMethods] = await pool.execute(
			`SELECT id, stripe_payment_method_id, type, card_brand, card_last4, 
              card_exp_month, card_exp_year, is_default, created_at
       FROM payment_methods 
       WHERE user_id = ? 
       ORDER BY is_default DESC, created_at DESC`,
			[req.user.id]
		);

		res.json({ paymentMethods });
	} catch (error) {
		console.error("Get payment methods error:", error);
		res.status(500).json({ message: "Failed to fetch payment methods" });
	}
});

// POST /api/payment-methods/setup-intent - Create setup intent for adding new payment method
router.post("/payment-methods/setup-intent", requireAuth, async (req, res) => {
	try {
		// Get or create Stripe customer
		let customerId;

		// First check if user already has a customer ID stored
		const [userRows] = await pool.execute(
			"SELECT stripe_customer_id FROM users WHERE id = ?",
			[req.user.id]
		);

		if (userRows[0]?.stripe_customer_id) {
			customerId = userRows[0].stripe_customer_id;
		} else {
			// Create new Stripe customer
			const [userDetails] = await pool.execute(
				"SELECT name, email FROM users WHERE id = ?",
				[req.user.id]
			);

			const customer = await stripe.customers.create({
				name: userDetails[0].name,
				email: userDetails[0].email,
				metadata: { user_id: req.user.id.toString() },
			});

			customerId = customer.id;

			// Save customer ID to database
			await pool.execute(
				"UPDATE users SET stripe_customer_id = ? WHERE id = ?",
				[customerId, req.user.id]
			);
		}

		// Create setup intent
		const setupIntent = await stripe.setupIntents.create({
			customer: customerId,
			payment_method_types: ["card"],
			usage: "off_session",
		});

		res.json({
			clientSecret: setupIntent.client_secret,
			customerId: customerId,
		});
	} catch (error) {
		console.error("Setup intent creation error:", error);
		res.status(500).json({ message: "Failed to create setup intent" });
	}
});

// POST /api/payment-methods - Save payment method after setup
router.post(
	"/payment-methods",
	validateSavePaymentMethod,
	handleValidationErrors,
	requireAuth,
	async (req, res) => {
		try {
			const { setupIntentId, isDefault = false } = req.body;

			if (!setupIntentId) {
				return res.status(400).json({ message: "Setup intent ID required" });
			}

			// Retrieve setup intent from Stripe
			const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);

			if (setupIntent.status !== "succeeded") {
				return res.status(400).json({ message: "Setup intent not completed" });
			}

			const paymentMethod = await stripe.paymentMethods.retrieve(
				setupIntent.payment_method
			);

			// If setting as default, unset existing default
			if (isDefault) {
				await pool.execute(
					"UPDATE payment_methods SET is_default = 0 WHERE user_id = ?",
					[req.user.id]
				);
			}

			// Save to database
			await pool.execute(
				`INSERT INTO payment_methods (
        user_id, stripe_payment_method_id, type, card_brand, card_last4,
        card_exp_month, card_exp_year, card_fingerprint, is_default
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				[
					req.user.id,
					paymentMethod.id,
					paymentMethod.type,
					paymentMethod.card.brand,
					paymentMethod.card.last4,
					paymentMethod.card.exp_month,
					paymentMethod.card.exp_year,
					paymentMethod.card.fingerprint,
					isDefault ? 1 : 0,
				]
			);

			res.status(201).json({
				message: "Payment method saved successfully",
				paymentMethod: {
					id: paymentMethod.id,
					type: paymentMethod.type,
					card: {
						brand: paymentMethod.card.brand,
						last4: paymentMethod.card.last4,
						exp_month: paymentMethod.card.exp_month,
						exp_year: paymentMethod.card.exp_year,
					},
					is_default: isDefault,
				},
			});
		} catch (error) {
			console.error("Save payment method error:", error);
			res.status(500).json({ message: "Failed to save payment method" });
		}
	}
);

// DELETE /api/payment-methods/:id - Delete payment method
router.delete(
	"/payment-methods/:id",
	validateId,
	handleValidationErrors,
	requireAuth,
	async (req, res) => {
		try {
			const { id } = req.params;

			// Get payment method details
			const [pmRows] = await pool.execute(
				"SELECT stripe_payment_method_id, is_default FROM payment_methods WHERE id = ? AND user_id = ?",
				[id, req.user.id]
			);

			if (pmRows.length === 0) {
				return res.status(404).json({ message: "Payment method not found" });
			}

			const { stripe_payment_method_id, is_default } = pmRows[0];

			// Detach from Stripe
			await stripe.paymentMethods.detach(stripe_payment_method_id);

			// Delete from database
			await pool.execute(
				"DELETE FROM payment_methods WHERE id = ? AND user_id = ?",
				[id, req.user.id]
			);

			// If deleted method was default, set another as default
			if (is_default) {
				await pool.execute(
					"UPDATE payment_methods SET is_default = 1 WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
					[req.user.id]
				);
			}

			res.json({ message: "Payment method deleted successfully" });
		} catch (error) {
			console.error("Delete payment method error:", error);
			res.status(500).json({ message: "Failed to delete payment method" });
		}
	}
);

// POST /api/payment-methods/:id/default - Set payment method as default
router.post(
	"/payment-methods/:id/default",
	validateId,
	handleValidationErrors,
	requireAuth,
	async (req, res) => {
		try {
			const { id } = req.params;

			// Verify payment method belongs to user
			const [pmRows] = await pool.execute(
				"SELECT id FROM payment_methods WHERE id = ? AND user_id = ?",
				[id, req.user.id]
			);

			if (pmRows.length === 0) {
				return res.status(404).json({ message: "Payment method not found" });
			}

			// Unset existing default and set new default
			await pool.execute(
				"UPDATE payment_methods SET is_default = 0 WHERE user_id = ?",
				[req.user.id]
			);

			await pool.execute(
				"UPDATE payment_methods SET is_default = 1 WHERE id = ? AND user_id = ?",
				[id, req.user.id]
			);

			res.json({ message: "Default payment method updated" });
		} catch (error) {
			console.error("Set default payment method error:", error);
			res
				.status(500)
				.json({ message: "Failed to update default payment method" });
		}
	}
);

// ORDERS

// GET /api/orders - Get user's orders
router.get("/orders", requireAuth, async (req, res) => {
	try {
		const { status, limit = 10, offset = 0 } = req.query;

		let query = `SELECT 
        id, order_number, status, payment_status, payment_method,
        subtotal, shipping_cost, tax_amount, total, currency,
        shipping_name, shipping_street, shipping_city, shipping_state,
        shipping_postal_code, shipping_country,
        created_at, updated_at
       FROM orders 
       WHERE user_id = ?`;

		const params = [req.user.id];

		if (status) {
			query += ` AND status = ?`;
			params.push(status);
		}

		query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
		const limitNum = Number(limit) || 10;
		const offsetNum = Number(offset) || 0;
		params.push(limitNum, offsetNum);

		const [orders] = await pool.execute(query, params);

		// Get total count for pagination
		let countQuery = "SELECT COUNT(*) as total FROM orders WHERE user_id = ?";
		const countParams = [req.user.id];

		if (status) {
			countQuery += " AND status = ?";
			countParams.push(status);
		}

		const [countResult] = await pool.execute(countQuery, countParams);

		res.json({
			orders,
			total: countResult[0].total,
			limit: parseInt(limit),
			offset: parseInt(offset),
		});
	} catch (error) {
		console.error("Get orders error:", error);
		res.status(500).json({ message: "Failed to fetch orders" });
	}
});

// GET /api/orders/:orderNumber - Get single order details
router.get(
	"/orders/:orderNumber",
	validateOrderNumber,
	handleValidationErrors,
	requireAuth,
	async (req, res) => {
		try {
			const { orderNumber } = req.params;

			// Get order
			const [orders] = await pool.execute(
				`SELECT * FROM orders WHERE order_number = ? AND user_id = ?`,
				[orderNumber, req.user.id]
			);

			if (orders.length === 0) {
				return res.status(404).json({ message: "Order not found" });
			}

			const order = orders[0];

			// Get order items
			const [items] = await pool.execute(
				`SELECT * FROM order_items WHERE order_id = ?`,
				[order.id]
			);

			// Get payment info
			const [payments] = await pool.execute(
				`SELECT status, receipt_url, created_at FROM payments WHERE order_id = ?`,
				[order.id]
			);

			// Get refund info if exists
			const [refunds] = await pool.execute(
				`SELECT * FROM refunds WHERE order_id = ? ORDER BY created_at DESC LIMIT 1`,
				[order.id]
			);

			res.json({
				order,
				items,
				payment: payments[0] || null,
				refund: refunds[0] || null,
			});
		} catch (error) {
			console.error("Get order details error:", error);
			res.status(500).json({ message: "Failed to fetch order details" });
		}
	}
);

// POST /api/orders/:orderNumber/cancel - Request order cancellation/refund
router.post(
	"/orders/:orderNumber/cancel",
	validateOrderCancel,
	handleValidationErrors,
	requireAuth,
	async (req, res) => {
		try {
			const { orderNumber } = req.params;
			const { reason, reasonDescription } = req.body;

			// Get order
			const [orders] = await pool.execute(
				`SELECT id, payment_status, status, payment_intent_id, total 
       FROM orders 
       WHERE order_number = ? AND user_id = ?`,
				[orderNumber, req.user.id]
			);

			if (orders.length === 0) {
				return res.status(404).json({ message: "Order not found" });
			}

			const order = orders[0];

			// Check if order can be cancelled
			if (
				order.status === "delivered" ||
				order.status === "cancelled" ||
				order.status === "refunded"
			) {
				return res
					.status(400)
					.json({ message: "Order cannot be cancelled at this stage" });
			}

			if (order.payment_status !== "paid") {
				return res
					.status(400)
					.json({ message: "Only paid orders can be refunded" });
			}

			// Check if refund already exists
			const [existingRefunds] = await pool.execute(
				`SELECT id FROM refunds WHERE order_id = ? AND status != 'failed'`,
				[order.id]
			);

			if (existingRefunds.length > 0) {
				return res
					.status(400)
					.json({ message: "Refund request already exists for this order" });
			}

			// Create refund request
			await pool.execute(
				`INSERT INTO refunds (order_id, amount, reason, reason_description, status, refund_type)
       VALUES (?, ?, ?, ?, 'pending', 'full')`,
				[
					order.id,
					order.total,
					reason || "requested_by_customer",
					reasonDescription || null,
				]
			);

			// Update order status
			await pool.execute(
				`UPDATE orders SET status = 'cancelled' WHERE id = ?`,
				[order.id]
			);

			res.json({ message: "Cancellation request submitted successfully" });
		} catch (error) {
			console.error("Cancel order error:", error);
			res
				.status(500)
				.json({ message: "Failed to process cancellation request" });
		}
	}
);

// NOTIFICATIONS

// Get user's notifications with filtering and pagination
router.get("/notifications", requireAuth, async (req, res) => {
	try {
		const userId = req.user.id;
		const {
			status = "all",
			category = "all",
			limit = 10,
			offset = 0,
			sortBy = "created_at",
			sortOrder = "DESC",
		} = req.query;

		let query = `
        SELECT un.id, un.is_read, un.read_at, un.created_at,
               n.title, n.message, n.category
        FROM user_notifications un
        JOIN notifications n ON un.notification_id = n.id
        WHERE un.user_id = ? AND un.is_deleted = FALSE
      `;
		const params = [userId];

		// Apply filters
		if (status === "unread") {
			query += " AND un.is_read = FALSE";
		} else if (status === "read") {
			query += " AND un.is_read = TRUE";
		}

		if (category !== "all") {
			query += " AND n.category = ?";
			params.push(category);
		}

		// Add sorting
		const validSortColumns = ["created_at", "read_at"];
		const validSortOrder = ["ASC", "DESC"];

		if (
			validSortColumns.includes(sortBy) &&
			validSortOrder.includes(sortOrder.toUpperCase())
		) {
			query += ` ORDER BY un.${sortBy} ${sortOrder.toUpperCase()}`;
		} else {
			query += " ORDER BY un.created_at DESC";
		}

		// Add pagination
		query += " LIMIT ? OFFSET ?";
		const limitNum = Number(limit) || 10;
		const offsetNum = Number(offset) || 0;
		params.push(limitNum, offsetNum);

		const [notifications] = await pool.execute(query, params);

		// Get total count for pagination
		let countQuery = `
        SELECT COUNT(*) as total 
        FROM user_notifications un
        JOIN notifications n ON un.notification_id = n.id
        WHERE un.user_id = ? AND un.is_deleted = FALSE
      `;
		const countParams = [userId];

		if (status === "unread") {
			countQuery += " AND un.is_read = FALSE";
		} else if (status === "read") {
			countQuery += " AND un.is_read = TRUE";
		}

		if (category !== "all") {
			countQuery += " AND n.category = ?";
			countParams.push(category);
		}

		const [countResult] = await pool.execute(countQuery, countParams);
		const total = countResult[0].total;

		// Get statistics
		const [statsResult] = await pool.execute(
			`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN is_read = FALSE THEN 1 END) as unread,
          COUNT(CASE WHEN is_read = TRUE THEN 1 END) as \`read\`
        FROM user_notifications 
        WHERE user_id = ? AND is_deleted = FALSE
      `,
			[userId]
		);

		res.json({
			success: true,
			data: {
				notifications,
				pagination: {
					total,
					limit: parseInt(limit),
					offset: parseInt(offset),
					hasMore: parseInt(offset) + parseInt(limit) < total,
				},
				stats: statsResult[0],
			},
		});
	} catch (error) {
		console.error("Error fetching user notifications:", error);
		res.status(500).json({
			success: false,
			message: "Failed to fetch notifications",
		});
	}
});

// Mark single notification as read
router.post(
	"/notifications/:id/read",
	validateId,
	handleValidationErrors,
	requireAuth,
	async (req, res) => {
		try {
			const userId = req.user.id;
			const notificationId = req.params.id;

			// Check if notification belongs to user
			const [existing] = await pool.execute(
				"SELECT id FROM user_notifications WHERE id = ? AND user_id = ?",
				[notificationId, userId]
			);

			if (existing.length === 0) {
				return res.status(404).json({
					success: false,
					message: "Notification not found",
				});
			}

			// Mark as read
			await pool.execute(
				"UPDATE user_notifications SET is_read = TRUE, read_at = NOW() WHERE id = ? AND user_id = ?",
				[notificationId, userId]
			);

			res.json({
				success: true,
				message: "Notification marked as read",
			});
		} catch (error) {
			console.error("Error marking notification as read:", error);
			res.status(500).json({
				success: false,
				message: "Failed to mark notification as read",
			});
		}
	}
);

// Delete single notification (soft delete)
router.delete(
	"/notifications/:id",
	validateId,
	handleValidationErrors,
	requireAuth,
	async (req, res) => {
		try {
			const userId = req.user.id;
			const notificationId = req.params.id;

			// Check if notification belongs to user
			const [existing] = await pool.execute(
				"SELECT id FROM user_notifications WHERE id = ? AND user_id = ?",
				[notificationId, userId]
			);

			if (existing.length === 0) {
				return res.status(404).json({
					success: false,
					message: "Notification not found",
				});
			}

			// Soft delete
			await pool.execute(
				"UPDATE user_notifications SET is_deleted = TRUE, deleted_at = NOW() WHERE id = ? AND user_id = ?",
				[notificationId, userId]
			);

			res.json({
				success: true,
				message: "Notification deleted",
			});
		} catch (error) {
			console.error("Error deleting notification:", error);
			res.status(500).json({
				success: false,
				message: "Failed to delete notification",
			});
		}
	}
);

// Mark all notifications as read
router.post("/notifications/mark-all-read", requireAuth, async (req, res) => {
	try {
		const userId = req.user.id;

		const [result] = await pool.execute(
			"UPDATE user_notifications SET is_read = TRUE, read_at = NOW() WHERE user_id = ? AND is_read = FALSE AND is_deleted = FALSE",
			[userId]
		);

		res.json({
			success: true,
			message: `${result.affectedRows} notifications marked as read`,
		});
	} catch (error) {
		console.error("Error marking all notifications as read:", error);
		res.status(500).json({
			success: false,
			message: "Failed to mark all notifications as read",
		});
	}
});

// Bulk mark notifications as read
router.post(
	"/notifications/bulk-read",
	validateBulkNotifications,
	handleValidationErrors,
	requireAuth,
	async (req, res) => {
		try {
			const userId = req.user.id;
			const { notificationIds } = req.body;

			if (
				!notificationIds ||
				!Array.isArray(notificationIds) ||
				notificationIds.length === 0
			) {
				return res.status(400).json({
					success: false,
					message: "Invalid notification IDs",
				});
			}

			// Verify all notifications belong to the user
			const placeholders = notificationIds.map(() => "?").join(",");
			const [owned] = await pool.execute(
				`SELECT id FROM user_notifications WHERE id IN (${placeholders}) AND user_id = ?`,
				[...notificationIds, userId]
			);

			if (owned.length !== notificationIds.length) {
				return res.status(403).json({
					success: false,
					message: "Some notifications do not belong to you",
				});
			}

			// Mark as read
			const [result] = await pool.execute(
				`UPDATE user_notifications SET is_read = TRUE, read_at = NOW() 
         WHERE id IN (${placeholders}) AND user_id = ?`,
				[...notificationIds, userId]
			);

			res.json({
				success: true,
				message: `${result.affectedRows} notifications marked as read`,
			});
		} catch (error) {
			console.error("Error bulk marking notifications as read:", error);
			res.status(500).json({
				success: false,
				message: "Failed to mark notifications as read",
			});
		}
	}
);

// Bulk delete notifications
router.post(
	"/notifications/bulk-delete",
	validateBulkNotifications,
	handleValidationErrors,
	requireAuth,
	async (req, res) => {
		try {
			const userId = req.user.id;
			const { notificationIds } = req.body;

			if (
				!notificationIds ||
				!Array.isArray(notificationIds) ||
				notificationIds.length === 0
			) {
				return res.status(400).json({
					success: false,
					message: "Invalid notification IDs",
				});
			}

			// Verify all notifications belong to the user
			const placeholders = notificationIds.map(() => "?").join(",");
			const [owned] = await pool.execute(
				`SELECT id FROM user_notifications WHERE id IN (${placeholders}) AND user_id = ?`,
				[...notificationIds, userId]
			);

			if (owned.length !== notificationIds.length) {
				return res.status(403).json({
					success: false,
					message: "Some notifications do not belong to you",
				});
			}

			// Soft delete
			const [result] = await pool.execute(
				`UPDATE user_notifications SET is_deleted = TRUE, deleted_at = NOW() 
            WHERE id IN (${placeholders}) AND user_id = ?`,
				[...notificationIds, userId]
			);

			res.json({
				success: true,
				message: `${result.affectedRows} notifications deleted`,
			});
		} catch (error) {
			console.error("Error bulk deleting notifications:", error);
			res.status(500).json({
				success: false,
				message: "Failed to delete notifications",
			});
		}
	}
);

// Get notification count for badge/indicator (useful for showing unread count in header)
router.get("/notifications/count", requireAuth, async (req, res) => {
	try {
		const userId = req.user.id;

		const [result] = await pool.execute(
			`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN is_read = FALSE THEN 1 END) as unread
        FROM user_notifications 
        WHERE user_id = ? AND is_deleted = FALSE
      `,
			[userId]
		);

		res.json({
			success: true,
			data: result[0],
		});
	} catch (error) {
		console.error("Error fetching notification count:", error);
		res.status(500).json({
			success: false,
			message: "Failed to fetch notification count",
		});
	}
});

// CONTACT / SUPPORT

// Helper function to determine priority based on subject and message content
const determinePriority = (subject, message) => {
	const urgentKeywords = [
		"urgent",
		"emergency",
		"asap",
		"immediately",
		"critical",
		"broken",
		"not working",
	];
	const messageText = message.toLowerCase();

	if (
		subject === "billing" ||
		urgentKeywords.some((keyword) => messageText.includes(keyword))
	) {
		return "high";
	}

	if (subject === "technical" || subject === "account") {
		return "normal";
	}

	return "low";
};

// Submit contact form
router.post(
	"/contact",
	requireAuth,
	validateContact,
	handleValidationErrors,
	async (req, res) => {
		try {
			const { name, email, subject, message } = req.body;
			const userId = req.user.id;
			const priority = determinePriority(subject, message);

			// Insert contact submission
			const [result] = await pool.execute(
				`INSERT INTO contact_submissions (user_id, name, email, subject, message, priority)
         VALUES (?, ?, ?, ?, ?, ?)`,
				[userId, name, email, subject, message, priority]
			);

			const submissionId = result.insertId;

			// Get user info if logged in (for better email context)
			let userInfo = null;
			if (userId) {
				const [userRows] = await pool.execute(
					"SELECT name as full_name, email as user_email FROM users WHERE id = ?",
					[userId]
				);
				userInfo = userRows[0] || null;
			}

			// Send emails
			try {
				await sendContactConfirmationEmail(
					email,
					name,
					submissionId,
					subject,
					message,
					priority
				);
				await sendContactNotificationToAdmin(
					submissionId,
					name,
					email,
					subject,
					message,
					priority,
					userInfo
				);
			} catch (emailError) {
				console.error("Email sending failed:", emailError);
				// Don't fail the request if emails fail
			}

			res.status(201).json({
				success: true,
				message:
					"Your message has been sent successfully. We will respond within 24 hours.",
				data: {
					submissionId,
					priority,
					estimatedResponse: priority === "high" ? "4-8 hours" : "12-24 hours",
				},
			});

			// Log activity if user is logged in
			if (userId) {
				try {
					await pool.execute(
						`INSERT INTO activity_logs (user_id, activity_type, description, ip_address, device_info)
             VALUES (?, ?, ?, ?, ?)`,
						[
							userId,
							"contact_submission",
							`Contact form submitted: ${subject}`,
							req.ip || req.connection.remoteAddress,
							req.headers["user-agent"] || "Unknown Device",
						]
					);
				} catch (logError) {
					console.error("Failed to log contact activity:", logError);
				}
			}
		} catch (error) {
			console.error("Contact form submission error:", error);
			res.status(500).json({
				success: false,
				message: "Failed to submit your message. Please try again later.",
			});
		}
	}
);

// CART user-routes.js

// Middleware to get cart (for both authenticated and guest users)
async function getOrCreateCart(req, res, next) {
	try {
		let cartId;
		const token = req.cookies.authToken;

		if (token) {
			// Authenticated user
			try {
				const decoded = jwt.verify(token, process.env.JWT_SECRET);
				req.userId = decoded.id;

				// Get or create user cart
				let [carts] = await pool.execute(
					"SELECT id FROM carts WHERE user_id = ?",
					[req.userId]
				);

				if (carts.length === 0) {
					const [result] = await pool.execute(
						"INSERT INTO carts (user_id) VALUES (?)",
						[req.userId]
					);
					cartId = result.insertId;
				} else {
					cartId = carts[0].id;
				}
			} catch (err) {
				// Invalid token, treat as guest
				req.userId = null;
			}
		}

		if (!req.userId) {
			// Guest user - use sessionId from guestSessionHandler
			req.sessionId =
				req.sessionId ||
				"sess_" +
					Math.random().toString(36).substr(2, 9) +
					Date.now().toString(36);

			let [carts] = await pool.execute(
				"SELECT id FROM carts WHERE session_id = ?",
				[req.sessionId]
			);

			if (carts.length === 0) {
				const [result] = await pool.execute(
					"INSERT INTO carts (session_id) VALUES (?)",
					[req.sessionId]
				);
				cartId = result.insertId;
			} else {
				cartId = carts[0].id;
			}
		}

		req.cartId = cartId;
		next();
	} catch (error) {
		console.error("Cart middleware error:", error);
		res.status(500).json({ message: "Cart initialization failed" });
	}
}

// GET /api/cart - Get cart items
router.get("/cart", getOrCreateCart, async (req, res) => {
	try {
		const [items] = await pool.execute(
			`
      SELECT 
        ci.id,
        ci.product_id,
        ci.quantity,
        ci.price,
        ci.size,
        p.name,
        p.description,
        p.image_url,
        p.stock
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.product_id
      WHERE ci.cart_id = ?
      ORDER BY ci.created_at ASC
    `,
			[req.cartId]
		);

		// Calculate totals
		const subtotal = items.reduce(
			(sum, item) => sum + parseFloat(item.price) * item.quantity,
			0
		);
		const shipping = subtotal > 100 ? 0 : 24; // Free shipping over $100
		const total = subtotal + shipping;

		res.json({
			cartId: req.cartId,
			sessionId: req.sessionId,
			items,
			summary: {
				itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
				subtotal: parseFloat(subtotal.toFixed(2)),
				shipping: parseFloat(shipping.toFixed(2)),
				total: parseFloat(total.toFixed(2)),
			},
		});
	} catch (error) {
		console.error("Get cart error:", error);
		res.status(500).json({ message: "Failed to fetch cart" });
	}
});

// POST /api/cart/add - Add item to cart
router.post(
	"/cart/add",
	validateAddToCart,
	handleValidationErrors,
	getOrCreateCart,
	async (req, res) => {
		try {
			const { productId, quantity = 1, size } = req.body;

			if (!productId) {
				return res.status(400).json({ message: "Product ID is required" });
			}

			// Validate product exists and get current price
			const [products] = await pool.execute(
				"SELECT product_id, name, price, stock FROM products WHERE product_id = ?",
				[productId]
			);

			if (products.length === 0) {
				return res.status(404).json({ message: "Product not found" });
			}

			const product = products[0];

			// Check stock
			if (quantity > product.stock) {
				return res.status(400).json({
					message: "Insufficient stock",
					availableStock: product.stock,
				});
			}

			// Check if item already exists in cart
			const [existing] = await pool.execute(
				"SELECT id, quantity FROM cart_items WHERE cart_id = ? AND product_id = ? AND size = ?",
				[req.cartId, productId, size || null]
			);

			if (existing.length > 0) {
				// Update quantity
				const newQuantity = existing[0].quantity + quantity;

				if (newQuantity > product.stock) {
					return res.status(400).json({
						message: "Cannot add more items. Insufficient stock",
						availableStock: product.stock,
						currentInCart: existing[0].quantity,
					});
				}

				await pool.execute(
					"UPDATE cart_items SET quantity = ?, updated_at = NOW() WHERE id = ?",
					[newQuantity, existing[0].id]
				);
			} else {
				// Add new item
				await pool.execute(
					"INSERT INTO cart_items (cart_id, product_id, quantity, price, size) VALUES (?, ?, ?, ?, ?)",
					[req.cartId, productId, quantity, product.price, size || null]
				);
			}

			// Return updated cart
			const [items] = await pool.execute(
				`
      SELECT 
        ci.id,
        ci.product_id,
        ci.quantity,
        ci.price,
        ci.size,
        p.name,
        p.description,
        p.image_url
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.product_id
      WHERE ci.cart_id = ?
      ORDER BY ci.updated_at DESC
    `,
				[req.cartId]
			);

			const subtotal = items.reduce(
				(sum, item) => sum + parseFloat(item.price) * item.quantity,
				0
			);
			const shipping = subtotal > 100 ? 0 : 24;
			const total = subtotal + shipping;

			res.status(201).json({
				message: "Item added to cart",
				items,
				summary: {
					itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
					subtotal: parseFloat(subtotal.toFixed(2)),
					shipping: parseFloat(shipping.toFixed(2)),
					total: parseFloat(total.toFixed(2)),
				},
			});
		} catch (error) {
			console.error("Add to cart error:", error);
			res.status(500).json({ message: "Failed to add item to cart" });
		}
	}
);

// PUT /api/cart/update/:itemId - Update cart item quantity
router.put(
	"/cart/update/:itemId",
	validateId,
	validateCartUpdate,
	handleValidationErrors,
	getOrCreateCart,
	async (req, res) => {
		try {
			const { itemId } = req.params;
			const { quantity } = req.body;

			if (!quantity || quantity < 1) {
				return res.status(400).json({ message: "Quantity must be at least 1" });
			}

			// Verify item belongs to user's cart
			const [items] = await pool.execute(
				`
      SELECT ci.id, ci.product_id, p.stock
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.product_id
      WHERE ci.id = ? AND ci.cart_id = ?
    `,
				[itemId, req.cartId]
			);

			if (items.length === 0) {
				return res.status(404).json({ message: "Cart item not found" });
			}

			const item = items[0];

			// Check stock
			if (quantity > item.stock) {
				return res.status(400).json({
					message: "Insufficient stock",
					availableStock: item.stock,
				});
			}

			await pool.execute(
				"UPDATE cart_items SET quantity = ?, updated_at = NOW() WHERE id = ?",
				[quantity, itemId]
			);

			res.json({ message: "Cart updated successfully" });
		} catch (error) {
			console.error("Update cart error:", error);
			res.status(500).json({ message: "Failed to update cart" });
		}
	}
);

// DELETE /api/cart/remove/:itemId - Remove item from cart
router.delete(
	"/cart/remove/:itemId",
	validateId,
	handleValidationErrors,
	getOrCreateCart,
	async (req, res) => {
		try {
			const { itemId } = req.params;

			// Verify item belongs to user's cart and remove it
			const [result] = await pool.execute(
				"DELETE FROM cart_items WHERE id = ? AND cart_id = ?",
				[itemId, req.cartId]
			);

			if (result.affectedRows === 0) {
				return res.status(404).json({ message: "Cart item not found" });
			}

			res.json({ message: "Item removed from cart" });
		} catch (error) {
			console.error("Remove from cart error:", error);
			res.status(500).json({ message: "Failed to remove item" });
		}
	}
);

// DELETE /api/cart/clear - Clear entire cart
router.delete("/cart/clear", getOrCreateCart, async (req, res) => {
	try {
		await pool.execute("DELETE FROM cart_items WHERE cart_id = ?", [
			req.cartId,
		]);
		res.json({ message: "Cart cleared successfully" });
	} catch (error) {
		console.error("Clear cart error:", error);
		res.status(500).json({ message: "Failed to clear cart" });
	}
});

// POST /api/cart/merge - Merge guest cart with user cart (when user logs in)
router.post(
	"/cart/merge",
	validateCartMerge,
	handleValidationErrors,
	requireAuth,
	async (req, res) => {
		try {
			const { sessionId } = req.body;

			if (!sessionId) {
				return res.status(400).json({ message: "Session ID required" });
			}

			const userId = req.user.id;

			// Get or create user cart
			let [userCarts] = await pool.execute(
				"SELECT id FROM carts WHERE user_id = ?",
				[userId]
			);

			let userCartId;
			if (userCarts.length === 0) {
				const [result] = await pool.execute(
					"INSERT INTO carts (user_id) VALUES (?)",
					[userId]
				);
				userCartId = result.insertId;
			} else {
				userCartId = userCarts[0].id;
			}

			// Get session cart
			const [sessionCarts] = await pool.execute(
				"SELECT id FROM carts WHERE session_id = ?",
				[sessionId]
			);

			if (sessionCarts.length === 0) {
				return res.json({ message: "No session cart to merge" });
			}

			const sessionCartId = sessionCarts[0].id;

			// Get session cart items
			const [sessionItems] = await pool.execute(
				"SELECT product_id, quantity, price, size FROM cart_items WHERE cart_id = ?",
				[sessionCartId]
			);

			// Merge items into user cart
			for (const item of sessionItems) {
				const [existing] = await pool.execute(
					"SELECT id, quantity FROM cart_items WHERE cart_id = ? AND product_id = ? AND size = ?",
					[userCartId, item.product_id, item.size]
				);

				if (existing.length > 0) {
					// Update quantity
					await pool.execute(
						"UPDATE cart_items SET quantity = quantity + ?, updated_at = NOW() WHERE id = ?",
						[item.quantity, existing[0].id]
					);
				} else {
					// Add new item
					await pool.execute(
						"INSERT INTO cart_items (cart_id, product_id, quantity, price, size) VALUES (?, ?, ?, ?, ?)",
						[userCartId, item.product_id, item.quantity, item.price, item.size]
					);
				}
			}

			// Delete session cart
			await pool.execute("DELETE FROM carts WHERE id = ?", [sessionCartId]);

			res.json({ message: "Carts merged successfully" });
		} catch (error) {
			console.error("Cart merge error:", error);
			res.status(500).json({ message: "Failed to merge carts" });
		}
	}
);

// ADDRESSES

// Get user's addresses
router.get("/addresses", requireAuth, async (req, res) => {
	try {
		const userId = req.user.id;

		const [rows] = await pool.execute(
			`SELECT id, full_name, phone, street, city, state, postal_code, country, is_default, created_at, updated_at
        FROM addresses 
        WHERE user_id = ? 
        ORDER BY is_default DESC, created_at DESC`,
			[userId]
		);

		res.json({ addresses: rows });
	} catch (err) {
		console.error(err);
		res.status(500).json({ message: "Failed to fetch addresses" });
	}
});

// Create new address
router.post(
	"/addresses",
	validateAddress,
	handleValidationErrors,
	requireAuth,
	async (req, res) => {
		try {
			const userId = req.user.id;

			const {
				full_name,
				phone,
				street,
				city,
				state,
				postal_code,
				country,
				is_default,
			} = req.body;

			// Validate required fields
			if (!full_name || !street || !city || !postal_code || !country) {
				return res.status(400).json({ message: "Missing required fields" });
			}

			// If setting as default, unset any existing default
			if (is_default) {
				await pool.execute(
					"UPDATE addresses SET is_default = 0 WHERE user_id = ?",
					[userId]
				);
			}

			const [result] = await pool.execute(
				`INSERT INTO addresses (user_id, full_name, phone, street, city, state, postal_code, country, is_default)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				[
					userId,
					full_name,
					phone || null,
					street,
					city,
					state || null,
					postal_code,
					country,
					is_default ? 1 : 0,
				]
			);

			res.status(201).json({
				message: "Address created successfully",
				address: {
					id: result.insertId,
					...req.body,
					is_default: is_default ? 1 : 0,
				},
			});
		} catch (err) {
			console.error(err);
			res.status(500).json({ message: "Failed to create address" });
		}
	}
);

// Update address
router.put(
	"/addresses/:id",
	validateId,
	validateAddress,
	handleValidationErrors,
	requireAuth,
	async (req, res) => {
		try {
			const userId = req.user.id;
			const addressId = req.params.id;

			const {
				full_name,
				phone,
				street,
				city,
				state,
				postal_code,
				country,
				is_default,
			} = req.body;

			// Validate required fields
			if (!full_name || !street || !city || !postal_code || !country) {
				return res.status(400).json({ message: "Missing required fields" });
			}

			// Check if address belongs to user
			const [existing] = await pool.execute(
				"SELECT id FROM addresses WHERE id = ? AND user_id = ?",
				[addressId, userId]
			);

			if (existing.length === 0) {
				return res.status(404).json({ message: "Address not found" });
			}

			// If setting as default, unset any existing default
			if (is_default) {
				await pool.execute(
					"UPDATE addresses SET is_default = 0 WHERE user_id = ? AND id != ?",
					[userId, addressId]
				);
			}

			await pool.execute(
				`UPDATE addresses 
         SET full_name = ?, phone = ?, street = ?, city = ?, state = ?, postal_code = ?, country = ?, is_default = ?
         WHERE id = ? AND user_id = ?`,
				[
					full_name,
					phone || null,
					street,
					city,
					state || null,
					postal_code,
					country,
					is_default ? 1 : 0,
					addressId,
					userId,
				]
			);

			res.json({ message: "Address updated successfully" });
		} catch (err) {
			console.error(err);
			res.status(500).json({ message: "Failed to update address" });
		}
	}
);

// Delete address
router.delete(
	"/addresses/:id",
	validateId,
	handleValidationErrors,
	requireAuth,
	async (req, res) => {
		try {
			const userId = req.user.id;
			const addressId = req.params.id;

			// Check if address belongs to user and if it's default
			const [existing] = await pool.execute(
				"SELECT id, is_default FROM addresses WHERE id = ? AND user_id = ?",
				[addressId, userId]
			);

			if (existing.length === 0) {
				return res.status(404).json({ message: "Address not found" });
			}

			const wasDefault = existing[0].is_default === 1;

			// Delete the address
			await pool.execute("DELETE FROM addresses WHERE id = ? AND user_id = ?", [
				addressId,
				userId,
			]);

			// If deleted address was default, set another address as default
			if (wasDefault) {
				await pool.execute(
					"UPDATE addresses SET is_default = 1 WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
					[userId]
				);
			}

			res.json({ message: "Address deleted successfully" });
		} catch (err) {
			console.error(err);
			res.status(500).json({ message: "Failed to delete address" });
		}
	}
);

// Set address as default
router.post(
	"/addresses/:id/default",
	validateId,
	handleValidationErrors,
	requireAuth,
	async (req, res) => {
		try {
			const userId = req.user.id;
			const addressId = req.params.id;

			// Check if address belongs to user
			const [existing] = await pool.execute(
				"SELECT id FROM addresses WHERE id = ? AND user_id = ?",
				[addressId, userId]
			);

			if (existing.length === 0) {
				return res.status(404).json({ message: "Address not found" });
			}

			await pool.execute(
				"UPDATE addresses SET is_default = 0 WHERE user_id = ? AND id != ?",
				[userId, addressId]
			);
			await pool.execute("UPDATE addresses SET is_default = 1 WHERE id = ?", [
				addressId,
			]);

			res.json({ message: "Address set as default successfully" });
		} catch (err) {
			console.error(err);
			res.status(500).json({ message: "Failed to set default address" });
		}
	}
);

// Get addresses for checkout
router.get("/checkout/addresses", requireAuth, async (req, res) => {
	try {
		const userId = req.user.id;

		const [rows] = await pool.execute(
			`SELECT id, full_name, phone, street, city, state, postal_code, country, is_default
         FROM addresses 
         WHERE user_id = ? 
         ORDER BY is_default DESC, created_at DESC`,
			[userId]
		);

		res.json({
			addresses: rows,
			hasAddresses: rows.length > 0,
		});
	} catch (err) {
		console.error(err);
		res.status(500).json({ message: "Failed to fetch addresses" });
	}
});

export default router;
