const Chat = require('../models/Chat');
const Message = require('../models/Message');

// Send a multilingual message
exports.sendMessage = async (req, res) => {
  try {
    const { chatId, translations, originalLanguage } = req.body;
    const senderId = req.user._id; // from auth middleware

    // Find or create chat
    let chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    // Create message
    const message = new Message({
      chat: chat._id,
      sender: senderId,
      translations,
      originalLanguage
    });
    await message.save();

    // Update chat's last message
    chat.lastMessage = message._id;
    chat.updatedAt = Date.now();
    await chat.save();

    // Optionally, emit socket event here if you want to trigger from REST

    res.status(201).json({ message: 'Message sent', data: message });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
