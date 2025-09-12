const express = require('express');
const router = express.Router();
const {createSupportTicket,} = require('../../controllers/client/supportController');
const { requireAuth } = require('../../middleware/authMiddleware');

// Protected routes (require authentication)
router.use(requireAuth);

// User routes
router.post('/ticket', createSupportTicket);
module.exports = router;