const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { 
  requireAuth, 
  requireRole,
  requireAdmin,
  rateLimit 
} = require('../middleware/authMiddleware');

// --- Protected Routes (Require Authentication) ---

// @desc    Get user's chat list
// @route   GET /api/chat/
// @access  Private (Client/Vendor)
router.get('/', 
  requireAuth,
  requireRole(['client', 'vendor']),
  rateLimit(100, 15 * 60 * 1000), // 100 requests per 15 minutes
  chatController.getUserChats
);

// @desc    Start or get existing chat
// @route   POST /api/chat/start
// @access  Private (Client/Vendor)
router.post('/start',
  requireAuth,
  requireRole(['client', 'vendor']),
  rateLimit(20, 5 * 60 * 1000), // 20 chat starts per 5 minutes
  chatController.startChat
);

// @desc    Get chat messages
// @route   GET /api/chat/:chatId/messages
// @access  Private (Participants only)
router.get('/:chatId/messages',
  requireAuth,
  requireRole(['client', 'vendor']),
  rateLimit(200, 15 * 60 * 1000), // 200 requests per 15 minutes
  chatController.getChatMessages
);

// @desc    Mark chat as read
// @route   PATCH /api/chat/:chatId/read
// @access  Private (Participants only)
router.patch('/:chatId/read',
  requireAuth,
  requireRole(['client', 'vendor']),
  rateLimit(100, 5 * 60 * 1000), // 100 mark-as-read per 5 minutes
  chatController.markChatAsRead
);

// @desc    Delete/Archive chat
// @route   DELETE /api/chat/:chatId
// @access  Private (Participants only)
router.delete('/:chatId',
  requireAuth,
  requireRole(['client', 'vendor']),
  rateLimit(10, 15 * 60 * 1000), // 10 deletions per 15 minutes
  chatController.deleteChat
);


// --- Health Check ---
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Chat service is running',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;