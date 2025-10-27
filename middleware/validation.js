import { body, validationResult, param, query } from 'express-validator';
import { sanitize } from 'express-mongo-sanitize';

// Sanitize input to prevent NoSQL injection
export const sanitizeInput = sanitize();


// ======================
// AUTH VALIDATIONS
// ======================

export const validateRegister = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Name can only contain letters and spaces')
    .escape(),

  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail()
    .isLength({ max: 100 })
    .withMessage('Email is too long'),

  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),

  body('subscribe')
    .optional()
    .isBoolean()
    .withMessage('Subscribe must be true or false')
];

export const validateLogin = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  
  body('keepMeSignedIn')
    .optional()
    .isBoolean()
    .withMessage('Keep me signed in must be true or false')
];

export const validatePasswordChange = [
  body('oldPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  
  body('newPassword')
    .isLength({ min: 8, max: 128 })
    .withMessage('New password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+=\-\[\]{};:'",.<>\/\\|`~])[A-Za-z\d@$!%*?&#^()_+=\-\[\]{};:'",.<>\/\\|`~]{8,}$/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
    .custom((value, { req }) => {
      if (value === req.body.currentPassword) {
        throw new Error('New password must be different from current password');
      }
      return true;
    })
];

export const validatePasswordResetRequest = [
  body('email')
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address')
];

export const validatePasswordResetCode = [
  body('email')
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('code')
    .matches(/^[0-9]{6}$/)
    .withMessage('Code must be a 6-digit number')
];

export const validatePasswordReset = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  
  body('resetToken')
    .notEmpty()
    .withMessage('Reset token is required'),
  
  body('newPassword')
    .isLength({ min: 8, max: 128 })
    .withMessage('New password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+=\-\[\]{};:'",.<>\/\\|`~])[A-Za-z\d@$!%*?&#^()_+=\-\[\]{};:'",.<>\/\\|`~]{8,}$/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
];

export const validateResendVerification = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail()
    .isLength({ max: 100 })
    .withMessage('Email is too long')
];

export const validate2faVerify = [
  body('userId')
    .isInt({ min: 1 })
    .withMessage('User ID must be a number'),
  
  body('code')
    .trim()
    .isLength({ min: 6, max: 6 })
    .withMessage('Code must be 6 digits')
    .isNumeric()
    .withMessage('Code must contain only numbers'),
  
  body('keepMeSignedIn')
    .optional()
    .isBoolean()
    .withMessage('Keep me signed in must be true or false')
];

export const validate2faResend = [
  body('userId')
    .isInt({ min: 1 })
    .withMessage('Invalid user ID')
];


// ======================
// PROFILE VALIDATIONS
// ======================

export const validateProfile = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s\-'\.]+$/)
    .withMessage('Name can only contain letters, spaces, hyphens, apostrophes, and periods'),
  
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage('Email must not exceed 255 characters'),
  
  body('phone')
    .optional()
    .trim()
    .isLength({ min: 10, max: 20 })
    .withMessage('Phone number must be between 10 and 20 characters')
    .matches(/^[\+]?[0-9\s\-\(\)]+$/)
    .withMessage('Phone number can only contain digits, spaces, hyphens, parentheses, and optional + prefix'),
  
  body('country')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Country must be between 2 and 100 characters'),
  
  body('gender')
    .optional()
    .trim()
    .isIn(['Male', 'Female', 'Other'])
    .withMessage('Gender must be Male, Female, or Other')
];

export const validateProfilePhoto = [
  body('profile_image')
    .trim()
    .custom(value => {
      try {
        const url = new URL(value);
        if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
          throw new Error('URL must use https in production');
        }
        return true;
      } catch {
        throw new Error('Invalid URL');
      }
    })
    .withMessage('Profile image must be a valid URL')
];


// ======================
// ADDRESS VALIDATIONS
// ======================

export const validateAddress = [
  body('full_name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s\-'\.]+$/)
    .withMessage('Full name can only contain letters, spaces, hyphens, apostrophes, and periods'),
  
  body('phone')
    .optional()
    .trim()
    .isLength({ min: 10, max: 20 })
    .withMessage('Phone number must be between 10 and 20 characters')
    .matches(/^[\+]?[0-9\s\-\(\)]+$/)
    .withMessage('Phone number can only contain digits, spaces, hyphens, parentheses, and optional + prefix'),
  
  body('street')
    .trim()
    .isLength({ min: 5, max: 255 })
    .withMessage('Street address must be between 5 and 255 characters')
    .matches(/^[a-zA-Z0-9\s\-\#\.\/,]+$/)
    .withMessage('Street address contains invalid characters'),
  
  body('city')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('City must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s\-'\.]+$/)
    .withMessage('City can only contain letters, spaces, hyphens, apostrophes, and periods'),
  
  body('state')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('State must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s\-'\.]+$/)
    .withMessage('State can only contain letters, spaces, hyphens, apostrophes, and periods'),
  
  body('postal_code')
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage('Postal code must be between 3 and 20 characters')
    .matches(/^[a-zA-Z0-9\s\-]+$/)
    .withMessage('Postal code can only contain letters, numbers, spaces, and hyphens'),
  
  body('country')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Country must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s\-'\.]+$/)
    .withMessage('Country can only contain letters, spaces, hyphens, apostrophes, and periods'),
  
  body('is_default')
    .optional()
    .isBoolean()
    .withMessage('is_default must be a boolean value')
];


// ======================
// PAYMENT VALIDATIONS
// ======================

export const validateSavePaymentMethod = [
  body('setupIntentId')
    .matches(/^seti_[a-zA-Z0-9]+$/)
    .withMessage('Invalid setup intent ID format'),
  
  body('isDefault')
    .optional()
    .isBoolean()
    .withMessage('isDefault must be a boolean')
];

export const validateCheckoutIntent = [
  body('shippingAddress')
    .notEmpty()
    .withMessage('Shipping address is required'),
  
  body('shippingAddress.name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Shipping name must be between 2 and 100 characters'),
  
  body('shippingAddress.street')
    .trim()
    .isLength({ min: 5, max: 255 })
    .withMessage('Shipping street must be between 5 and 255 characters'),
  
  body('shippingAddress.city')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Shipping city must be between 2 and 100 characters'),
  
  body('shippingAddress.postalCode')
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage('Postal code must be between 3 and 20 characters'),
  
  body('shippingAddress.country')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Country must be between 2 and 100 characters'),
  
  body('shippingAddress.state')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('State must not exceed 100 characters'),
  
  body('shippingAddress.phone')
    .optional()
    .trim()
    .matches(/^[\+]?[0-9\s\-\(\)]+$/)
    .withMessage('Phone number format is invalid'),
  
  body('shippingAddress.email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Email must be valid'),
  
  body('billingAddress')
    .optional(),
  
  body('saveAddress')
    .optional()
    .isBoolean()
    .withMessage('saveAddress must be a boolean'),
  
  body('paymentMethodId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Payment method ID must be a positive integer'),
  
  body('orderNotes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Order notes must not exceed 500 characters')
];

export const validateCheckoutConfirm = [
  body('paymentIntentId')
    .matches(/^pi_[a-zA-Z0-9]+$/)
    .withMessage('Invalid payment intent ID format')
];


// ======================
// ORDER VALIDATIONS
// ======================

export const validateOrderNumber = [
  param('orderNumber')
    .trim()
    .matches(/^ORD-\d{8}-\d{3}$/)
    .withMessage('Invalid order number format')
];

export const validateOrderCancel = [
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Reason must not exceed 200 characters'),
  
  body('reasonDescription')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason description must not exceed 500 characters')
];


// ======================
// REFUND VALIDATIONS
// ======================

export const validateRefundRequest = [
  body('orderId')
    .isInt({ min: 1 })
    .withMessage('Order ID must be a positive integer'),
  
  body('reason')
    .isIn(['requested_by_customer', 'duplicate', 'fraudulent', 'other'])
    .withMessage('Invalid refund reason'),
  
  body('reasonDescription')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason description must not exceed 500 characters'),
  
  body('refundType')
    .optional()
    .isIn(['full', 'partial'])
    .withMessage('Refund type must be full or partial'),
  
  body('amount')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be a positive number')
    .custom((value, { req }) => {
      if (req.body.refundType === 'partial' && !value) {
        throw new Error('Amount is required for partial refunds');
      }
      return true;
    })
];


// ======================
// CART VALIDATIONS
// ======================

export const validateAddToCart = [
  body('productId')
    .isInt({ min: 1 })
    .withMessage('Product ID must be a positive integer'),
  
  body('quantity')
    .optional()
    .isInt({ min: 1, max: 999 })
    .withMessage('Quantity must be between 1 and 999'),
  
  body('size')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Size must not exceed 20 characters')
];

export const validateCartUpdate = [
  body('quantity')
    .isInt({ min: 1, max: 999 })
    .withMessage('Quantity must be between 1 and 999')
];

export const validateCartMerge = [
  body('sessionId')
    .trim()
    .isLength({ min: 10, max: 100 })
    .withMessage('Session ID must be between 10 and 100 characters')
];


// ======================
// NOTIFICATION VALIDATIONS
// ======================

export const validateBulkNotifications = [
  body('notificationIds')
    .isArray({ min: 1, max: 100 })
    .withMessage('notificationIds must be an array with 1-100 items'),
  
  body('notificationIds.*')
    .isInt({ min: 1 })
    .withMessage('Each notification ID must be a positive integer')
];


// ======================
// CONTACT VALIDATIONS
// ======================

export const validateContact = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s\-'\.]+$/)
    .withMessage('Name can only contain letters, spaces, hyphens, apostrophes, and periods'),
  
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  
  body('subject')
    .trim()
    .isIn(['general', 'account', 'product', 'technical', 'billing', 'feedback', 'other'])
    .withMessage('Please select a valid subject category'),
  
  body('message')
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Message must be between 10 and 2000 characters')
];


// ======================
// 2FA VALIDATIONS
// ======================

export const validate2FAToggle = [
  body('enable')
    .isBoolean()
    .withMessage('Enable parameter must be a boolean'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];


// ======================
// SECURITY QUESTIONS VALIDATIONS
// ======================

export const validateSecurityQuestions = [
  body('question1')
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Question 1 must be between 2 and 200 characters'),
  
  body('answer1')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Answer 1 must be between 1 and 100 characters'),
  
  body('question2')
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Question 2 must be between 2 and 200 characters'),
  
  body('answer2')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Answer 2 must be between 1 and 100 characters'),
  
  body('question3')
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Question 3 must be between 2 and 200 characters'),
  
  body('answer3')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Answer 3 must be between 1 and 100 characters')
];


// ======================
// USER PREFERENCES VALIDATIONS
// ======================

export const validatePreferences = [
  body('notifications_email')
    .optional()
    .isBoolean()
    .withMessage('notifications_email must be a boolean'),
  
  body('notifications_sms')
    .optional()
    .isBoolean()
    .withMessage('notifications_sms must be a boolean'),
  
  body('notifications_push')
    .optional()
    .isBoolean()
    .withMessage('notifications_push must be a boolean'),
  
  body('marketing_emails')
    .optional()
    .isBoolean()
    .withMessage('marketing_emails must be a boolean'),
  
  body('order_updates')
    .optional()
    .isBoolean()
    .withMessage('order_updates must be a boolean'),
  
  body('promotional_offers')
    .optional()
    .isBoolean()
    .withMessage('promotional_offers must be a boolean'),
  
  body('language')
    .optional()
    .isIn(['en', 'es', 'fr'])
    .withMessage('language must be en, es, or fr'),
  
  body('currency')
    .optional()
    .isIn(['USD', 'EUR', 'GBP'])
    .withMessage('currency must be USD, EUR, or GBP'),
  
  body('profile_visibility')
    .optional()
    .isIn(['public', 'private'])
    .withMessage('profile_visibility must be public or private'),
  
  body('show_online_status')
    .optional()
    .isBoolean()
    .withMessage('show_online_status must be a boolean'),
  
  body('allow_search_engines')
    .optional()
    .isBoolean()
    .withMessage('allow_search_engines must be a boolean')
];


// ======================
// ACCOUNT VALIDATIONS
// ======================

export const validateAccountDeactivation = [
  body('password')
    .notEmpty()
    .withMessage('Password is required for account deactivation')
];

export const validateAccountDelete = [
  body('password')
    .notEmpty()
    .withMessage('Password is required for account deletion')
];


// ======================
// ID VALIDATIONS
// ======================

export const validateId = [
  param(['id', 'sessionId', 'refundId', 'itemId'])
    .optional()
    .isInt({ min: 1 })
    .withMessage('ID must be a positive integer')
];




// ======================
// ADMIN USER MANAGEMENT VALIDATIONS
// ======================

export const validateAdminUsersQuery = [
  query('q')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search query must not exceed 100 characters'),
  
  query('role')
    .optional({ checkFalsy: true })
    .isIn(['user', 'admin', 'super_admin'])
    .withMessage('Role must be user, admin, or super_admin'),
  
  query('sort')
    .optional()
    .isIn(['created_asc', 'created_desc'])
    .withMessage('Sort must be created_asc or created_desc')
];

export const validateAdminUsersExport = [
    query('q')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Search query must not exceed 100 characters'),
    
    query('role')
      .optional({ checkFalsy: true })
      .isIn(['user', 'admin', 'super_admin'])
      .withMessage('Role must be user, admin, or super_admin'),
    
    query('sort')
      .optional()
      .isIn(['created_asc', 'created_desc'])
      .withMessage('Sort must be created_asc or created_desc')
];

export const validateAdminUserUpdate = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage('Email must not exceed 255 characters'),
  
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s\-'\.]+$/)
    .withMessage('Name can only contain letters, spaces, hyphens, apostrophes, and periods'),
  
  body('role')
    .isIn(['user', 'admin', 'super_admin'])
    .withMessage('Role must be user, admin, or super_admin')
];

export const validateUserStatus = [
  body('action')
    .isIn(['activate', 'deactivate', 'suspend'])
    .withMessage('Action must be activate, deactivate, or suspend')
];

export const validateAdminSendEmail = [
  body('subject')
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Subject must be between 3 and 200 characters'),
  
  body('message')
    .trim()
    .isLength({ min: 10, max: 5000 })
    .withMessage('Message must be between 10 and 5000 characters')
];


// ======================
// ADMIN REFUND VALIDATIONS
// ======================

export const validateAdminRefundsQuery = [
  query('status')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Status must not exceed 50 characters'),
];

export const validateRefundProcess = [
  body('approve')
    .isBoolean()
    .withMessage('Approve must be a boolean value')
];

export const validatePartialRefund = [
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be a positive number'),
  
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Reason must not exceed 200 characters')
];


// ======================
// ADMIN PRODUCT VALIDATIONS
// ======================

export const validateProductId = [
  param('id')
    .matches(/^\d{8}$/)
    .withMessage('Product ID must be an 8-digit number')
];

export const validateProduct = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 255 })
    .withMessage('Product name must be between 2 and 255 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Description must not exceed 5000 characters'),
  
  body('price')
    .isFloat({ min: 0 })
    .withMessage('Price must be a non-negative number'),
  
  body('stock')
    .isInt({ min: 0 })
    .withMessage('Stock must be a non-negative integer'),
  
  body('image_url')
    .optional()
    .trim()
    .custom(value => {
      try {
        const url = new URL(value);
        if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
          throw new Error('URL must use https in production');
        }
        return true;
      } catch {
        throw new Error('Invalid URL');
      }
    })
    .withMessage('Image URL must be a valid URL')
];


// ======================
// ADMIN CONTACT/SUPPORT VALIDATIONS
// ======================

export const validateAdminContactQuery = [
  query('status')
    .optional()
    .isIn(['all', 'pending', 'in_progress', 'resolved', 'closed'])
    .withMessage('Status must be all, pending, in_progress, resolved, or closed'),
  
  query('subject')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Subject must not exceed 100 characters'),
  
  query('priority')
    .optional()
    .isIn(['all', 'low', 'normal', 'high', 'urgent'])
    .withMessage('Priority must be all, low, normal, high, or urgent'),
  
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search query must not exceed 100 characters'),
  
  query('sortBy')
    .optional()
    .isIn(['created_at', 'updated_at', 'priority', 'status', 'subject'])
    .withMessage('sortBy must be created_at, updated_at, priority, status, or subject'),
  
  query('sortOrder')
    .optional()
    .isIn(['ASC', 'DESC'])
    .withMessage('sortOrder must be ASC or DESC')
];

export const validateAdminContactExport = [
    query('status')
      .optional()
      .isIn(['all', 'pending', 'in_progress', 'resolved', 'closed'])
      .withMessage('Status must be all, pending, in_progress, resolved, or closed'),
    
    query('subject')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Subject must not exceed 100 characters'),
    
    query('priority')
      .optional()
      .isIn(['all', 'low', 'normal', 'high', 'urgent'])
      .withMessage('Priority must be all, low, normal, high, or urgent'),
    
    query('search')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Search query must not exceed 100 characters'),
];

export const validateContactSubmissionUpdate = [
  body('status')
    .optional()
    .isIn(['pending', 'in_progress', 'resolved', 'closed'])
    .withMessage('Status must be pending, in_progress, resolved, or closed'),
  
  body('admin_notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Admin notes must not exceed 1000 characters'),
  
  body('priority')
    .optional()
    .isIn(['low', 'normal', 'high', 'urgent'])
    .withMessage('Priority must be low, normal, high, or urgent')
];


// =======================
// ADMIN ORDER VALIDATIONS
// =======================

export const validateAdminOrdersQuery = [
  query('status')
    .optional()
    .isIn(['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'])
    .withMessage('Invalid order status'),
  
  query('paymentStatus')
    .optional()
    .isIn(['pending', 'paid', 'failed', 'refunded', 'partially_refunded'])
    .withMessage('Invalid payment status'),
];

export const validateOrderStatus = [
  body('status')
    .isIn(['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'])
    .withMessage('Invalid order status')
];


// ======================
// ADMIN NOTIFICATION VALIDATIONS
// ======================

export const validateAdminNotificationsQuery = [
  query('status')
    .optional()
    .isIn(['all', 'draft', 'sending', 'sent', 'failed'])
    .withMessage('Status must be all, draft, sending, sent, or failed'),
  
  query('category')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Category must not exceed 50 characters'),
  
  query('sortBy')
    .optional()
    .isIn(['created_at', 'sent_at', 'status', 'category', 'total_recipients'])
    .withMessage('sortBy must be created_at, sent_at, status, category, or total_recipients'),
  
  query('sortOrder')
    .optional()
    .isIn(['ASC', 'DESC'])
    .withMessage('sortOrder must be ASC or DESC')
];

export const validateAdminNotification = [
  body('title')
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3 and 200 characters'),
  
  body('message')
    .trim()
    .isLength({ min: 10, max: 5000 })
    .withMessage('Message must be between 10 and 5000 characters'),
  
  body('category')
    .isIn(['marketing_emails', 'order_updates', 'promotional_offers', 'general'])
    .withMessage('Invalid category'),
  
  body('target_all_users')
    .optional()
    .isBoolean()
    .withMessage('target_all_users must be a boolean'),
  
  body('target_user_roles')
    .optional()
    .isArray()
    .withMessage('target_user_roles must be an array'),
  
  body('target_user_roles.*')
    .optional()
    .isIn(['user', 'admin', 'super_admin'])
    .withMessage('Each role must be user, admin, or super_admin'),
  
  body('target_specific_users')
    .optional()
    .isArray()
    .withMessage('target_specific_users must be an array'),
  
  body('target_specific_users.*')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Each user ID must be a positive integer'),
  
  body('send_email')
    .optional()
    .isBoolean()
    .withMessage('send_email must be a boolean'),
  
  body('send_push')
    .optional()
    .isBoolean()
    .withMessage('send_push must be a boolean')
];


// ======================
// ADMIN ACTIVITY LOGS VALIDATIONS
// ======================

export const validateActivityLogsQuery = [
  query('admin_id')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Admin ID must not exceed 50 characters'),
  
  query('action')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Action must not exceed 100 characters'),
  
  query('entity_type')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Entity type must not exceed 100 characters'),
  
  query('sortBy')
    .optional()
    .isIn(['created_at', 'action', 'admin_name', 'entity_type'])
    .withMessage('sortBy must be created_at, action, admin_name, or entity_type'),
  
  query('sortOrder')
    .optional()
    .isIn(['ASC', 'DESC'])
    .withMessage('sortOrder must be ASC or DESC'),
  
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search query must not exceed 100 characters'),
  
  query('date_from')
    .optional({ values: 'falsy' })
    .isISO8601()
    .withMessage('date_from must be a valid date'),
  
  query('date_to')
    .optional({ values: 'falsy' })
    .isISO8601()
    .withMessage('date_to must be a valid date')
];

export const validateActivityLogsExport = [
    query('admin_id')
      .optional()
      .trim()
      .isLength({ max: 50 })
      .withMessage('Admin ID must not exceed 50 characters'),
    
    query('action')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Action must not exceed 100 characters'),
    
    query('entity_type')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Entity type must not exceed 100 characters'),
    
    query('search')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Search query must not exceed 100 characters'),
    
    query('date_from')
      .optional({ values: 'falsy' })
      .isISO8601()
      .withMessage('date_from must be a valid date'),
    
    query('date_to')
      .optional({ values: 'falsy' })
      .isISO8601()
      .withMessage('date_to must be a valid date')
];


// ======================
// ADMIN ERROR LOGS VALIDATIONS
// ======================

export const validateErrorLogsQuery = [
  query('severity')
    .optional()
    .isIn(['all', 'critical', 'high', 'medium', 'low'])
    .withMessage('Severity must be all, critical, high, medium, or low'),
  
  query('error_type')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Error type must not exceed 100 characters'),
  
  query('resolved')
    .optional()
    .isIn(['all', 'true', 'false', '1', '0'])
    .withMessage('Resolved must be all, true, or false'),
  
  query('user_id')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('User ID must not exceed 50 characters'),
  
  query('sortBy')
    .optional()
    .isIn(['created_at', 'severity', 'error_type', 'resolved'])
    .withMessage('sortBy must be created_at, severity, error_type, or resolved'),
  
  query('sortOrder')
    .optional()
    .isIn(['ASC', 'DESC'])
    .withMessage('sortOrder must be ASC or DESC'),
  
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search query must not exceed 100 characters'),
  
  query('date_from')
    .optional({ values: 'falsy' })
    .isISO8601()
    .withMessage('date_from must be a valid date'),
  
  query('date_to')
    .optional({ values: 'falsy' })
    .isISO8601()
    .withMessage('date_to must be a valid date')
];

export const validateErrorLogsExport = [
  query('severity')
    .optional()
    .isIn(['all', 'critical', 'high', 'medium', 'low'])
    .withMessage('Severity must be all, critical, high, medium, or low'),
  
  query('error_type')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Error type must not exceed 100 characters'),
  
  query('resolved')
    .optional()
    .isIn(['all', 'true', 'false', '1', '0'])
    .withMessage('Resolved must be all, true, or false'),
  
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search query must not exceed 100 characters'),
  
  query('date_from')
    .optional({ values: 'falsy' })
    .isISO8601()
    .withMessage('date_from must be a valid date'),
  
  query('date_to')
    .optional({ values: 'falsy' })
    .isISO8601()
    .withMessage('date_to must be a valid date')
];

export const validateErrorResolve = [
  body('resolution_notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Resolution notes must not exceed 1000 characters')
];

export const validateBulkErrorResolve = [
  body('error_ids')
    .isArray({ min: 1, max: 100 })
    .withMessage('error_ids must be an array with 1-100 items'),
  
  body('error_ids.*')
    .isInt({ min: 1 })
    .withMessage('Each error ID must be a positive integer'),
  
  body('resolution_notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Resolution notes must not exceed 1000 characters')
];

export const validateBulkErrorDelete = [
  body('error_ids')
    .isArray({ min: 1, max: 100 })
    .withMessage('error_ids must be an array with 1-100 items'),
  
  body('error_ids.*')
    .isInt({ min: 1 })
    .withMessage('Each error ID must be a positive integer')
];


// ======================
// VALIDATION ERROR HANDLER
// ======================

export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg,
        value: err.value
      }))
    });
  }
  next();
};


export const validatePagination = (req, res, next) => {
  let { page, limit } = req.query;

  page = parseInt(page, 10);
  limit = parseInt(limit, 10);

  if (isNaN(page) || page < 1) page = 1;
  if (isNaN(limit) || limit < 1) limit = 10;
  if (limit > 100) limit = 100;

  req.pagination = {
    page,
    limit,
    offset: (page - 1) * limit
  };

  next();
};