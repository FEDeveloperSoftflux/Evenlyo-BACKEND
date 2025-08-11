const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const authMiddleware = require('../middleware/authMiddleware');

// Send a message (multilingual)
router.post('/send', authMiddleware.requireAuth, chatController.sendMessage);

module.exports = router;
