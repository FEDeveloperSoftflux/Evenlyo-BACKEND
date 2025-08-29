const express = require('express');
const path = require('path');
const i18next = require('i18next');
const Backend = require('i18next-fs-backend');
const i18nextMiddleware = require('i18next-http-middleware');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const mongoose = require('mongoose');
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

// Connect to MongoDB Atlas
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB Atlas');
  })
  .catch((err) => console.error('MongoDB connection error:', err));


const app = express();

// ...existing code...


const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:3001',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001'
];

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
app.use(express.json());
app.use(cookieParser());
app.use(i18nextMiddleware.handle(i18next));

// Serve static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax'
  },
  name: 'evenlyo.sid' // Custom session name
}));

// Auth routes
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Category routes
const categoryRoutes = require('./routes/categories');
app.use('/api/categories', categoryRoutes);

// Listing routes
const listingRoutes = require('./routes/listings');
app.use('/api/listings', listingRoutes);

// Subcategory routes
const subCategoryRoutes = require('./routes/subcategories');
app.use('/api/subcategories', subCategoryRoutes);

// Booking routes
const bookingRoutes = require('./routes/bookings');
app.use('/api/booking', bookingRoutes);

// Cart routes
const cartRoutes = require('./routes/cart');
app.use('/api/cart', cartRoutes);

// Plan routes
const planRoutes = require('./routes/plans');
app.use('/api/plans', planRoutes);

// Vendor routes
const vendorRoutes = require('./routes/vendors');
app.use('/api/vendor', vendorRoutes);

// Blog routes
const blogRoutes = require('./routes/blogs');
app.use('/api/blogs', blogRoutes);

// Settings routes
const settingsRoutes = require('./routes/settings');
app.use('/api/settings', settingsRoutes);

// Support routes
const supportRoutes = require('./routes/support');
app.use('/api/support', supportRoutes);

// Notification routes
const notificationRoutes = require('./routes/notifications');
app.use('/api/notifications', notificationRoutes);

// Root endpoint with translation
app.get('/', (req, res) => {
  res.send(req.t('welcome'));
});


/// for test

// Debug endpoint to check session (remove in production)
app.get('/api/debug/session', (req, res) => {
  res.json({
    sessionExists: !!req.session,
    sessionID: req.sessionID,
    sessionData: req.session,
    cookies: req.cookies,
    user: req.session?.user || null
  });
});



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

// Error handling middleware
app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message });
});

module.exports = app;
