const express = require('express');
const path = require('path');
const i18next = require('i18next');
const Backend = require('i18next-fs-backend');
const i18nextMiddleware = require('i18next-http-middleware');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');
const connectDB = require('./config/db'); // Adjusted path to db.js
const cors = require('cors');
require('dotenv').config();


// i18next configuration for localization
i18next
  .use(Backend)
  .use(i18nextMiddleware.LanguageDetector)
  .init({
    fallbackLng: 'en',
    preload: ['en', 'nl'],
    backend: {
      loadPath: __dirname + '/locales/{{lng}}/translation.json',
    },
    detection: {
      order: ['querystring', 'cookie', 'header'],
      caches: ['cookie'],
    },
  });



connectDB();

mongoose.connection.on('connected', () => {
  console.log('Mongoose connected');
});
mongoose.connection.on('disconnected', () => {
  console.log('Mongoose disconnected');
});


const app = express();

const allowedOrigins = 
[
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:3001',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'https://evenlyo.web.app',
  'https://staging-evenlyo-vendor.web.app',
  'https://evenlyo-admin.web.app/'
];

// Trust first proxy for Heroku (needed for secure cookies)
app.set('trust proxy', 1);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, postman, swagger ui)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
}))


// Capture raw body for Stripe webhook verification on the webhook route.
app.use(express.json({
  verify: (req, res, buf) => {
    try {
      if (req.originalUrl && req.originalUrl.startsWith('/api/payments/webhook')) {
        // store raw buffer for stripe webhook signature verification
        req.rawBody = buf;
      }
    } catch (err) {
      // nothing special; continue without rawBody
    }
  }
}));
app.use(cookieParser());
app.use(i18nextMiddleware.handle(i18next));

// Serve static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Session configuration

// Session configuration with dynamic domain
app.use((req, res, next) => {
  let domain;
  if (req.hostname === 'evenlyo.web.app') {
    domain = 'evenlyo.web.app';
  } else if (req.hostname === 'staging-evenlyo-vendor.web.app') {
    domain = 'staging-evenlyo-vendor.web.app';
  } else if (req.hostname === 'evenlyo-admin.web.app') {
    domain = 'evenlyo-admin.web.app';
  }
  session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      collectionName: 'sessions',
      ttl: 24 * 60 * 60 // 1 day
    }),
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      domain: domain,
      path: '/',
    },
    name: 'evenlyo.sid'
  })(req, res, next);
});

// Auth routes
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Category routes
const categoryRoutes = require('./routes/client/categories');
app.use('/api/categories', categoryRoutes);

// Listing routes
const listingRoutes = require('./routes/client/listings');
app.use('/api/listings', listingRoutes);

// Subcategory routes
const subCategoryRoutes = require('./routes/client/subcategories');
app.use('/api/subcategories', subCategoryRoutes);

// Booking routes
const bookingRoutes = require('./routes/client/bookings');
app.use('/api/booking', bookingRoutes);

// Cart routes
const cartRoutes = require('./routes/client/cart');
app.use('/api/cart', cartRoutes);

// Plan routes
const planRoutes = require('./routes/client/plans');
app.use('/api/plans', planRoutes);

// Blog routes
const blogRoutes = require('./routes/client/blogs');
app.use('/api/blogs', blogRoutes);

// Settings routes
const settingsRoutes = require('./routes/settings');
app.use('/api/settings', settingsRoutes);

// Support routes
const supportRoutes = require('./routes/client/support');
app.use('/api/support', supportRoutes);

// Notification routes
const notificationRoutes = require('./routes/notifications');
app.use('/api/notifications', notificationRoutes);

const vendorRoutes = require('./routes/client/vendors');
app.use('/api/vendor', vendorRoutes);

// Root endpoint with translation
app.get('/', (req, res) => {
  res.send(req.t('ok'));
});


/// for test

// Debug endpoint to check session 
app.get('/api/debug/session', (req, res) => {
  res.json({
    sessionExists: !!req.session,
    sessionID: req.sessionID,
    sessionData: req.session,
    cookies: req.cookies,
    user: req.session?.user || null
  });
});

// VENDOR SIDE

// Vendor dashboard analytics route
const vendorDashboardRoutes = require('./routes/vendor/dashboard');
app.use('/api/vendor/dashboard', vendorDashboardRoutes);

// Vendor listings overview route (after app is initialized)
const vendorListingsRoutes = require('./routes/vendor/listings');
app.use('/api/vendor/listings', vendorListingsRoutes);

// Vendor items overview route
const vendorItemsRoutes = require('./routes/vendor/items');
app.use('/api/vendor/items', vendorItemsRoutes);

// Vendor bookings routes
const vendorBookingRoutes = require('./routes/vendor/booking');
app.use('/api/vendor/bookings', vendorBookingRoutes);

// Vendor tracking routes
const vendorTrackingRoutes = require('./routes/vendor/tracking');
app.use('/api/vendor/tracking', vendorTrackingRoutes);

// Vendor billing routes
const vendorBillingRoutes = require('./routes/vendor/billing');
app.use('/api/vendor/billing', vendorBillingRoutes);

// Vendor profile routes
const vedorProfileRoutes = require('./routes/vendor/profile');
app.use('/api/vendor/profile', vedorProfileRoutes);

const designationRoutes = require('./routes/vendor/role');
app.use('/api/vendor/roles', designationRoutes);

// Vendor earnings analytics route
const vendorEarningsRoutes = require('./routes/vendor/earnings');
app.use('/api/vendor/earnings', vendorEarningsRoutes);

// Stock management routes
const stockRoutes = require('./routes/vendor/stock');
app.use('/api/vendor/stock', stockRoutes);

// Stripe payments route
const paymentsRoutes = require('./routes/payments');
app.use('/api/payments', paymentsRoutes);



// ADMIN SIDE

// Admin dashboard routes
const adminDashboardRoutes = require('./routes/admin/dashboard');
app.use('/api/admin/dashboard', adminDashboardRoutes);

// Admin user management routes
const adminUserManagementRoutes = require('./routes/admin/userManagement');
app.use('/api/admin/users', adminUserManagementRoutes);

// Admin booking analytics routes
const adminBookingAnalyticsRoutes = require('./routes/admin/bookings');
app.use('/api/admin/bookings', adminBookingAnalyticsRoutes);

// Admin report management route
const adminReportRoutes = require('./routes/admin/report');
app.use('/api/admin/report', adminReportRoutes);

// Admin tracking routes
const adminTrackingRoutes = require('./routes/admin/tracking');
app.use('/api/admin/tracking', adminTrackingRoutes);

// Admin Listing Management routes
const adminListingManagementRoutes = require('./routes/admin/listingsManagement');
app.use('/api/admin/listing', adminListingManagementRoutes);

const adminPlanRoutes = require('./routes/admin/plans');
app.use('/api/admin/plans', adminPlanRoutes);

// Admin Designation and Employee Role Management
const adminDesignationRoutes = require('./routes/admin/adminDesignations');
app.use('/api/admin/designations', adminDesignationRoutes);

const adminEmployeeRoutes = require('./routes/admin/adminEmployees');
app.use('/api/admin/employees', adminEmployeeRoutes);

// Admin support ticket routes
const adminSupportRoutes = require('./routes/admin/support');
app.use('/api/admin/support', adminSupportRoutes);

const adminSettingsRoutes = require('./routes/admin/settings');
app.use('/api/admin/settings', adminSettingsRoutes);

const adminBlogRoutes = require('./routes/admin/blog');
app.use('/api/admin/blogs', adminBlogRoutes);




// Error handling middleware
app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message });
});

module.exports = app;