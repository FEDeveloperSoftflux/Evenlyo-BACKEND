const express = require('express');
const router = express.Router();
const { createSupportTicket, contactUs } = require('../../controllers/client/supportController');
const { requireAuth } = require('../../middleware/authMiddleware');

// Public route: contact form (no auth required)
router.post('/contact', contactUs);


// User routes
router.post('/ticket',requireAuth, createSupportTicket);

module.exports = router;