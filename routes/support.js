const express = require('express');
const router = express.Router();
const {
  getIssueCategories,
  createSupportTicket,
  getUserSupportTickets,
  getSupportTicketById
} = require('../controllers/supportController');
const { requireAuth } = require('../middleware/authMiddleware');

// Public route to get issue categories
router.get('/categories', getIssueCategories);

// Protected routes (require authentication)
router.use(requireAuth);

// User routes
router.post('/ticket', createSupportTicket);
module.exports = router;