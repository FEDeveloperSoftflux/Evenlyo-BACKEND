const Message = require("../models/Message");

// Get all messages in a chat room
const getMessages = async (req, res) => {
  try {
    const { chatRoomId } = req.params;
    const messages = await Message.find({ chatRoom: chatRoomId })
      .populate("sender", "name email")
      .populate("readBy", "name email")
      .sort({ createdAt: 1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Send a message
const sendMessage = async (req, res) => {
  try {
    const { sender, content, chatRoom } = req.body;
    const newMessage = await Message.create({ sender, content, chatRoom });
    res.status(201).json(newMessage);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Mark message as read
const markAsRead = async (req, res) => {
  try {
    const { messageId, userId } = req.body;
    const updatedMsg = await Message.findByIdAndUpdate(
      messageId,
      { $addToSet: { readBy: userId } },
      { new: true }
    );
    res.json(updatedMsg);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
    getMessages,
    sendMessage,
    markAsRead
};  
