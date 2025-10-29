const Message = require("../models/Message");

// Get all messages in a chat room
const getMessages = async (req, res) => {
  try {
    const { conversationId, userId } = req.params;
    const messages = await Message.find({
      conversationId,
      deletedFor: { $ne: userId },
    });

    res.status(200).json({
      success: true,
      message: "Messages fetched successfully",
      data: messages,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error fetching messages",
      error: err.message,
    });
  }
};

// const getMessages = async (req, res) => {
//   try {
//     const { conversationId } = req.params;
//     const { page = 1, limit = 30 } = req.query;

//     const skip = (page - 1) * limit;

//     // Newest messages last me aayein → sort ascending by createdAt
//     const messages = await Message.find({ conversationId })
//       .sort({ createdAt: -1 }) // newest first
//       .skip(skip)
//       .limit(Number(limit));

//     const totalMessages = await Message.countDocuments({ conversationId });

//     res.status(200).json({
//       success: true,
//       message: "Messages fetched successfully",
//       data: messages.reverse(), // reverse to show oldest → newest in frontend
//       hasMore: skip + Number(limit) < totalMessages,
//     });
//   } catch (err) {
//     res.status(500).json({
//       success: false,
//       message: "Error fetching messages",
//       error: err.message,
//     });
//   }
// };

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

const softDeleteMessage = async (req, res) => {
  try {
    const { conversationId, userId } = req.params;
    await Message.updateMany(
      { conversationId },
      { $addToSet: { deletedFor: userId } }
    );
    res.json({ success: true, message: "Message deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getMessages,
  sendMessage,
  markAsRead,
  softDeleteMessage,
};
