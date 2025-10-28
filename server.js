import express from 'express';
// import https from "https";
// import jwt from 'jsonwebtoken';
import pool from './main.js'
import cookieParser from "cookie-parser";
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import adminRoutes from "./routes/admin-routes.js";
import userRoutes from './routes/user-routes.js';
import authRoutes from './routes/auth-routes.js';
import publicRoutes from './routes/public-routes.js';
import { errorHandler, notFoundHandler, checkUserStatus, logAdminActivity } from './middleware/auth.js';
import { corsHeaders, securityHeaders, generalRateLimit, authRateLimit, verificationResendRateLimit, strictRateLimit, addressRateLimit, contactRateLimit, doubleCsrfProtection, checkEnvVars, gracefulShutdown } from './middleware/security.js';
import { updateSessionActivity, guestSessionHandler, setupScheduledTasks } from './middleware/session.js';
import { ensureAddressesTable } from "./migrations/addresses-mig.js";
import { createUserPreferencesTable } from "./migrations/user-preferences-mig.js"
import { createUserSecuritySettingsTable } from './migrations/user-security-settings-mig.js';
import { createUserSessionsTable } from './migrations/user-sessions-mig.js';
import { createActivityLogsTable } from './migrations/activity-logs-mig.js';
import { createSecurityQuestionsTable } from './migrations/security-questions-mig.js';
import { runContactMigrations } from "./migrations/contact-submissions-mig.js";
import { runNotificationMigrations } from './migrations/notifications-mig.js';
import { createEcommerceTables } from "./migrations/ecommerce-tables-mig.js";
import { createAdminActivityLogsTable } from './migrations/admin-activity-logs-mig.js';
import { createPaymentMethodsTable } from "./migrations/payment-methods-mig.js";
import { createErrorLogsTable, setupErrorLogCleanup } from './migrations/error-logs-mig.js';
import { createPendingRegistrationsTable } from "./migrations/pending-registrations-mig.js";
import { addVerificationCooldownColumn } from './migrations/add-verification-cooldown.js';
import { add2faCooldownColumn } from './migrations/add-2fa-cooldown.js';

// Run migrations
await ensureAddressesTable();
await createUserPreferencesTable();
await createUserSecuritySettingsTable();
await createUserSessionsTable();
await createActivityLogsTable();
await createSecurityQuestionsTable();
await runContactMigrations();
await createEcommerceTables();
await runNotificationMigrations();
await createPaymentMethodsTable();
await createAdminActivityLogsTable();
await createErrorLogsTable();
await setupErrorLogCleanup();
await createPendingRegistrationsTable();
await addVerificationCooldownColumn();
await add2faCooldownColumn();

// Init Express
const app = express();

// HTTPS redirect
// app.use(httpsRedirect);

// Setup session cleanup scheduler
setupScheduledTasks();
checkEnvVars();

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Security middleware
app.use(corsHeaders);
app.use(securityHeaders);

app.set('trust proxy', 1); // trust first proxy

// Rate limits
app.use('/auth/resend-verification', verificationResendRateLimit);
app.use('/auth/me', generalRateLimit);
app.use('/api/change-password', authRateLimit);
app.use('/api/change-email', authRateLimit);
app.use('/api/checkout', strictRateLimit);
app.use('/api/orders', strictRateLimit);
app.use('/api/payment-methods', strictRateLimit);
app.use('/api/addresses', addressRateLimit);
app.use('/api/contact', contactRateLimit);
app.use('/admin/change-password', authRateLimit);
// app.use('/auth', authRateLimit);
app.use('/api/', generalRateLimit);


// Debug CSRF
// app.use((req, res, next) => {
//   if (req.path === '/auth/login' && req.method === 'POST') {
//     console.log('🔍 CSRF Debug for login:');
//     console.log('Cookies:', req.cookies);
//     console.log('CSRF Token from header:', req.headers['x-csrf-token']);
//     console.log('Session ID:', req.cookies.sessionId);
//     console.log('Auth Token:', req.cookies.authToken);
//   }
//   next();
// });

app.use(guestSessionHandler);

// CSRF protection 
app.use(doubleCsrfProtection);

// Session and auth middleware
app.use(checkUserStatus);
app.use(logAdminActivity);
app.use(updateSessionActivity);

// Static files
const __dirname = dirname(fileURLToPath(import.meta.url));
app.use('/frontend', express.static(path.join(__dirname, 'frontend')));
app.use('/user', express.static(path.join(__dirname, 'user')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Root route for health checks / homepage
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'frontend', 'farfetch.html')));

// Optional: favicon route to stop repeated 404s
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Routes
app.use('/admin', adminRoutes);
app.use('/api', userRoutes);
app.use('/auth', authRoutes);
app.use('/api', publicRoutes);

// Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
// const server = https.createServer(tlsOptions, app)
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`HTTPS Express server running on port ${PORT}`);
});

gracefulShutdown(server, pool);   