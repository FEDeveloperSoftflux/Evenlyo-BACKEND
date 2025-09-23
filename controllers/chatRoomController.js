const ChatRoom = require("../models/ChatRoom");

// Create or get existing chat room for two users
const getOrCreateRoom = async (req, res) => {
  try {
    const { userIds } = req.body; // [clientId, vendorId]

    let room = await ChatRoom.findOne({
      participants: { $all: userIds, $size: userIds.length }
    });

    if (!room) {
      room = await ChatRoom.create({ participants: userIds });
    }

    res.json(room);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get all rooms for a user
const getUserRooms = async (req, res) => {
  try {
    const { userId } = req.params;
    const rooms = await ChatRoom.find({ participants: userId })
      .populate("participants", "name email");
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get all recent chats for a user
 const getRecentChats = async (req, res) => {
  try {
    const { userId } = req.params;

    const rooms = await ChatRoom.find({ participants: userId })
      .populate("participants", "firstName lastName email")
      .populate("lastMessage")
      .sort({ updatedAt: -1 }); // latest first

    res.json(rooms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


module.exports = {
  getOrCreateRoom,
  getUserRooms,
  getRecentChats
};
