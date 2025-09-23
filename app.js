const express = require('express');
const path = require('path');
const i18next = require('i18next');
const Backend = require('i18next-fs-backend');
const i18nextMiddleware = require('i18next-http-middleware');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');
const connectDB = require('./config/db'); 
const cors = require('cors');
require('dotenv').config();


// ==========================
// DB connection
// ==========================
connectDB();

mongoose.connection.on('connected', () => console.log('Mongoose connected'));
mongoose.connection.on('disconnected', () => console.log('Mongoose disconnected'));

const app = express();

app.set('trust proxy', 1); // Trust proxy (needed for Heroku + secure cookies)


// ==========================
// i18next config
// ==========================
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


// ==========================
// CORS config
// ==========================
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://evenlyo.web.app',
  'https://staging-evenlyo-vendor.web.app',
  'https://evenlyo-admin.web.app',
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','PATCH','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Requested-With','Accept'],
}));


// ==========================
// Middleware
// ==========================
app.use(express.json({
  verify: (req, res, buf) => {
    if (req.originalUrl && req.originalUrl.startsWith('/api/payments/webhook')) {
      req.rawBody = buf;
    }
  }
}));
app.use(cookieParser());
app.use(i18nextMiddleware.handle(i18next));

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// ==========================
// Session Middleware (FIXED)
// ==========================
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    client: mongoose.connection.getClient(),   // reuse the same mongoose client
    collectionName: 'sessions',
    ttl: 24 * 60 * 60 // 1 day
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    // domain is optional — only set if you really need cross-subdomain cookies
  },
  name: 'evenlyo.sid'
}));



// ==========================
// API Routes
// ==========================
app.use('/api/auth', require('./routes/auth'));
app.use('/api/categories', require('./routes/client/categories'));
app.use('/api/listings', require('./routes/client/listings'));
app.use('/api/subcategories', require('./routes/client/subcategories'));
app.use('/api/booking', require('./routes/client/bookings'));
app.use('/api/cart', require('./routes/client/cart'));
app.use('/api/plans', require('./routes/client/plans'));
app.use('/api/blogs', require('./routes/client/blogs'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/support', require('./routes/client/support'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/vendor', require('./routes/client/vendors'));

// Vendor routes
app.use('/api/vendor/dashboard', require('./routes/vendor/dashboard'));
app.use('/api/vendor/listings', require('./routes/vendor/listings'));
app.use('/api/vendor/items', require('./routes/vendor/items'));
app.use('/api/vendor/bookings', require('./routes/vendor/booking'));
app.use('/api/vendor/tracking', require('./routes/vendor/tracking'));
app.use('/api/vendor/billing', require('./routes/vendor/billing'));
app.use('/api/vendor/profile', require('./routes/vendor/profile'));
app.use('/api/vendor/roles', require('./routes/vendor/role'));
app.use('/api/vendor/earnings', require('./routes/vendor/earnings'));
app.use('/api/vendor/stock', require('./routes/vendor/stock'));

// Payments
app.use('/api/payments', require('./routes/payments'));

// Admin routes
app.use('/api/admin/dashboard', require('./routes/admin/dashboard'));
app.use('/api/admin/users', require('./routes/admin/userManagement'));
app.use('/api/admin/bookings', require('./routes/admin/bookings'));
app.use('/api/admin/report', require('./routes/admin/report'));
app.use('/api/admin/tracking', require('./routes/admin/tracking'));
app.use('/api/admin/listing', require('./routes/admin/listingsManagement'));
app.use('/api/admin/plans', require('./routes/admin/plans'));
app.use('/api/admin/designations', require('./routes/admin/adminDesignations'));
app.use('/api/admin/employees', require('./routes/admin/adminEmployees'));
app.use('/api/admin/support', require('./routes/admin/support'));
app.use('/api/admin/settings', require('./routes/admin/settings'));
app.use('/api/admin/blogs', require('./routes/admin/blog'));

// Chat routes
app.use('/api/messages', require('./routes/messageRoutes'));
app.use('/api/chatrooms', require('./routes/chatRoomRoutes'));

// Root
app.get('/', (req, res) => {
  res.send(req.t('ok'));
});

// Debug
app.get('/api/debug/session', (req, res) => {
  res.json({
    sessionExists: !!req.session,
    sessionID: req.sessionID,
    sessionData: req.session,
    cookies: req.cookies,
    user: req.session?.user || null
  });
});

// Error handler
app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message });
});

module.exports = app;
