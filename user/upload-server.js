import express, { json, urlencoded, static as serveStatic } from 'express';
// import multer, { diskStorage, MulterError } from 'multer';
// import { v2 as cloudinary } from 'cloudinary';
import { unlink, existsSync, mkdirSync } from 'fs';
import { extname } from 'path';
import { promisify } from 'util';

import https from "https";
import fs from "fs";
import dotenv from "dotenv";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
// import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import  { upload } from "./multer-config.js"
import { v2 as cloudinary } from "cloudinary";

dotenv.config();

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// TLS options
const options = {
  key: fs.readFileSync(join(__dirname, "key.pem")),
  cert: fs.readFileSync(join(__dirname, "cert.pem")),
  allowHTTP1: true,
  minVersion: "TLSv1.2",
  ciphers: [
    "TLS_AES_256_GCM_SHA384",
    "TLS_CHACHA20_POLY1305_SHA256",
    "TLS_AES_128_GCM_SHA256",
    "ECDHE-ECDSA-AES256-GCM-SHA384",
    "!aNULL",
    "!eNULL",
    "!EXPORT",
    "!DES",
    "!RC4",
    "!3DES",
    "!MD5",
    "!PSK",
  ].join(":"),
  honorCipherOrder: true,
};

const app = express();
const unlinkAsync = promisify(unlink);

// Middleware
app.use(json());
app.use(urlencoded({ extended: true }));

app.use(cookieParser());
app.use(cors({
    origin: "http://127.0.0.1:5500",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
}));

app.use("/uploads", express.static("uploads"));

// Create uploads directory if it doesn't exist
// const uploadsDir = join(__dirname, 'uploads');
// if (!existsSync(uploadsDir)) {
//     mkdirSync(uploadsDir, { recursive: true });
// }

// // Configure Multer for local storage
// const storage = diskStorage({
//     destination: (req, file, cb) => {
//         cb(null, '/uploads'); // Local folder to store files
//     },
//     filename: (req, file, cb) => {
//         // Generate unique filename
//         const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
//         const extension = extname(file.originalname);
//         cb(null, `profile-${uniqueSuffix}${extension}`);
//     }
// });

// // File filter for images only
// const fileFilter = (req, file, cb) => {
//     const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    
//     if (allowedTypes.includes(file.mimetype)) {
//         cb(null, true);
//     } else {
//         cb(new Error('Invalid file type. Only JPEG, JPG and PNG are allowed.'), false);
//     }
// };

// // Multer configuration
// const upload = multer({
//     storage: storage,
//     limits: {
//         fileSize: 5 * 1024 * 1024 // 5MB limit
//     },
//     fileFilter: fileFilter
// });

// Helper function to upload to Cloudinary
const uploadToCloudinary = async (filePath, options = {}) => {
    try {
        const result = await cloudinary.uploader.upload(filePath, {
            folder: 'profile_photos', // Organize in folder
            transformation: [
                { width: 300, height: 300, crop: 'fill', gravity: 'face' }, // Resize and crop to face
                { quality: 'auto', fetch_format: 'auto' } // Optimize quality and format
            ],
            ...options
        });
        return result;
    } catch (error) {
        throw new Error(`Cloudinary upload failed: ${error.message}`);
    }
};

// Helper function to delete file from local storage
const deleteLocalFile = async (filePath) => {
    try {
        if (existsSync(filePath)) {
            await unlinkAsync(filePath);
        }
    } catch (error) {
        console.warn(`Failed to delete local file: ${filePath}`, error.message);
    }
};

// // Helper function to validate image dimensions (optional)
// const validateImageDimensions = (file) => {
//     return new Promise((resolve, reject) => {
//         const sharp = require('sharp'); // Optional: install sharp for image processing
        
//         sharp(file.path)
//             .metadata()
//             .then(metadata => {
//                 const { width, height } = metadata;
                
//                 // Check minimum dimensions
//                 if (width < 100 || height < 100) {
//                     reject(new Error('Image must be at least 100x100 pixels'));
//                     return;
//                 }
                
//                 // Check maximum dimensions
//                 if (width > 5000 || height > 5000) {
//                     reject(new Error('Image dimensions too large'));
//                     return;
//                 }
                
//                 resolve({ width, height });
//             })
//             .catch(reject);
//     });
// };

// Main upload route
app.post('/api/upload-profile-photo', upload.single('profilePhoto'), async (req, res) => {
    let localFilePath = null;
    
    try {
        // Check if file was uploaded
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }
        
        localFilePath = req.file.path;
        console.log('File uploaded locally:', localFilePath);
        
        // Optional: Validate image dimensions
        // Uncomment if you have sharp installed
        /*
        try {
            const dimensions = await validateImageDimensions(req.file);
            console.log('Image dimensions:', dimensions);
        } catch (dimensionError) {
            await deleteLocalFile(localFilePath);
            return res.status(400).json({
                success: false,
                message: dimensionError.message
            });
        }
        */
        
        // Upload to Cloudinary
        const cloudinaryResult = await uploadToCloudinary(localFilePath, {
            public_id: `profile_${Date.now()}`, // Unique public ID
            resource_type: 'image'
        });
        
        console.log('File uploaded to Cloudinary:', cloudinaryResult.secure_url);
        
        // Optional: Delete local file after successful Cloudinary upload
        // Comment out this line if you want to keep local copies
        await deleteLocalFile(localFilePath);
        
        // Success response
        res.status(200).json({
            success: true,
            message: 'Profile photo uploaded successfully',
            photoUrl: cloudinaryResult.secure_url,
            data: {
                // Cloudinary URLs
                photoUrl: cloudinaryResult.secure_url,
                thumbnailUrl: cloudinaryResult.secure_url, // Same URL with transformations
                publicId: cloudinaryResult.public_id,
                
                // Local file info (if you keep local files)
                localPath: req.file.filename,
                localUrl: `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`,
                
                // File metadata
                originalName: req.file.originalname,
                fileSize: req.file.size,
                mimeType: req.file.mimetype,
                uploadedAt: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('Upload error:', error);
        
        // Clean up local file if error occurred
        if (localFilePath) {
            await deleteLocalFile(localFilePath);
        }
        
        // Send error response
        res.status(500).json({
            success: false,
            message: error.message || 'Upload failed',
            error: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// // Route to get current profile photo (optional)
// app.get('/api/profile-photo/:userId', async (req, res) => {
//     try {
//         const { userId } = req.params;
        
//         // This is where you'd typically fetch from your database
//         // For now, returning a placeholder response
//         res.json({
//             success: true,
//             data: {
//                 photoUrl: null, // Get from database
//                 thumbnailUrl: null,
//                 uploadedAt: null
//             }
//         });
//     } catch (error) {
//         res.status(500).json({
//             success: false,
//             message: 'Failed to fetch profile photo'
//         });
//     }
// });

// // Route to delete profile photo
// app.delete('/api/profile-photo/:publicId', async (req, res) => {
//     try {
//         const { publicId } = req.params;
        
//         // Delete from Cloudinary
//         const result = await cloudinary.uploader.destroy(publicId);
        
//         if (result.result === 'ok') {
//             res.json({
//                 success: true,
//                 message: 'Profile photo deleted successfully'
//             });
//         } else {
//             res.status(400).json({
//                 success: false,
//                 message: 'Failed to delete photo from Cloudinary'
//             });
//         }
//     } catch (error) {
//         res.status(500).json({
//             success: false,
//             message: 'Delete operation failed'
//         });
//     }
// });

// // Error handling middleware
// app.use((error, req, res, next) => {
//     if (error instanceof MulterError) {
//         if (error.code === 'LIMIT_FILE_SIZE') {
//             return res.status(400).json({
//                 success: false,
//                 message: 'File too large. Maximum size is 5MB.'
//             });
//         }
//         if (error.code === 'LIMIT_FILE_COUNT') {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Too many files. Only one file allowed.'
//             });
//         }
//         if (error.code === 'LIMIT_UNEXPECTED_FILE') {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Unexpected field name. Use "profilePhoto".'
//             });
//         }
//     }
    
//     if (error.message.includes('Invalid file type')) {
//         return res.status(400).json({
//             success: false,
//             message: error.message
//         });
//     }
    
//     res.status(500).json({
//         success: false,
//         message: 'Server error occurred'
//     });
// });

// // Health check route
// app.get('/api/health', (req, res) => {
//     res.json({
//         success: true,
//         message: 'Server is running',
//         timestamp: new Date().toISOString()
//     });
// });

const server = https.createServer(options, app);

server.listen(3000, () => {
    console.log("HTTPS Express server running on port 3000");
});

// const PORT = process.env.PORT || 3000;

// app.listen(PORT, () => {
//     console.log(`Server running on port ${PORT}`);
//     console.log('Upload endpoints available:');
//     console.log(`- POST /api/upload-profile-photo`);
//     console.log(`- GET /api/profile-photo/:userId`);
//     console.log(`- DELETE /api/profile-photo/:publicId`);
// });

// export default app;