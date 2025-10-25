// public-routes.js

import pool from "../main.js";
import express from "express"
import ImageKit from "imagekit";
// import jwt from "jsonwebtoken"; 
import rateLimit from 'express-rate-limit';
// import { doubleCsrfProtection } from '../middleware/security.js';

const router = express.Router();

// --- Initialize ImageKit ---
const imagekit = new ImageKit({
    publicKey: process.env.IMAGEKIT_PUBLIC,
    privateKey: process.env.IMAGEKIT_PRIVATE,
    urlEndpoint: process.env.IMAGEKIT_URL,
});

const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10 // 10 upload tokens per hour
});
  
// --- Endpoint: Get signed upload token ---
router.get("/upload-signature", uploadLimiter, (req, res) => {
    try {
        const authParams = imagekit.getAuthenticationParameters();
        console.log("Auth params:", authParams); // ✅ ADD THIS

        res.json(authParams);
    } catch (error) {
        console.error("ImageKit signature error:", error);
        res.status(500).json({ message: "Failed to generate upload signature" });
    }
});

router.get("/products", async (req, res) => {
    // No requireAdmin - this is public!
    try {
        const [rows] = await pool.execute(
        "SELECT product_id, name, description, price, stock, image_url FROM products WHERE stock > 0"
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database error" });
    }
});

// router.get("/check-auth", async (req, res) => {
//   const token = req.cookies.authToken;
  
//   if (!token) {
//     return res.json({ isAuthenticated: false });
//   }

//   try {
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     return res.json({
//       isAuthenticated: true,
//       role: decoded.role || null
//     });
//   } catch {
//     return res.json({ isAuthenticated: false });
//   }
// });

// CSRF token endpoint
router.get('/csrf-token', (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
});

export default router;