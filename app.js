const express = require('express');
const i18next = require('i18next');
const Backend = require('i18next-fs-backend');
const i18nextMiddleware = require('i18next-http-middleware');
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
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
require('dotenv').config();
// Connect to MongoDB Atlas
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {/* Connected to MongoDB Atlas */})
  .catch((err) => console.error('MongoDB connection error:', err));


const app = express();
const allowedOrigins = ['http://localhost:3000'];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}))
app.use(express.json());
app.use(cookieParser());
app.use(i18nextMiddleware.handle(i18next));


// Auth routes
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Root endpoint with translation
app.get('/', (req, res) => {
  res.send(req.t('welcome'));
});


// Removed health check endpoint (demo/test)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: req.t('health') });
});

// Error handling middleware
app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message });
});

module.exports = app;
