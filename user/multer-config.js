// import multer from "multer";
// import path from "path";

// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, "uploads/"); // Save locally in uploads/
//   },
//   filename: (req, file, cb) => {
//     const ext = path.extname(file.originalname);
//     cb(null, file.fieldname + "-" + Date.now() + ext);
//   }
// });

// const fileFilter = (req, file, cb) => {
//   if (file.mimetype.startsWith("image/")) cb(null, true);
//   else cb(new Error("Only images allowed!"), false);
// };

// export const upload = multer({ storage, fileFilter });




// import multer from "multer";
// import path from "path";
// import fs from "fs";

// // Create uploads directory if it doesn't exist
// const uploadsDir = path.join(process.cwd(), "uploads");
// if (!fs.existsSync(uploadsDir)) {
//   fs.mkdirSync(uploadsDir, { recursive: true });
// }

// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, "uploads/"); // Save locally in uploads/
//   },
//   filename: (req, file, cb) => {
//     // Generate unique filename based on upload type
//     const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
//     const ext = path.extname(file.originalname);
    
//     // Different filename patterns based on field name
//     if (file.fieldname === 'productImage') {
//       cb(null, `product-${uniqueSuffix}${ext}`);
//     } else {
//       // Default to profile for backwards compatibility
//       cb(null, `profile-${uniqueSuffix}${ext}`);
//     }
//   }
// });

// // File filter for images
// const fileFilter = (req, file, cb) => {
//   const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
//   if (allowedTypes.includes(file.mimetype)) {
//     cb(null, true);
//   } else {
//     cb(new Error('Invalid file type. Only JPEG, JPG, PNG, and WebP are allowed.'), false);
//   }
// };

// export const upload = multer({
//   storage,
//   fileFilter,
//   limits: {
//     fileSize: 5 * 1024 * 1024, // 5MB limit
//     files: 1 // Only one file at a time
//   }
// });