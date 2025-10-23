const Conversation = require("../models/Conversation");
const Message = require("../models/Message");

const createChatUserWithVendor = async (req, res) => {
  const { userId, vendorId } = req.body;
  const io = req.app.get("socketio");

  try {
    const conversation = await Conversation.findOne({
      participants: {
        $all: [
          { $elemMatch: { role: "vendor", userId: vendorId } },
          { $elemMatch: { role: "user", userId: userId } },
        ],
      },
    })
      .sort({ lastUpdated: -1 })
      .populate("participants.userId");

    if (conversation) {
      return res.status(200).json({
        success: true,
        message: "Conversation already exists",
        data: conversation,
      });
    }

    const payloadWithWorker = {
      participants: [
        { userId: vendorId, role: "vendor", refPath: "Vendor" },
        { userId: userId, role: "user", refPath: "User" },
      ],
      conversationId: `${vendorId}_${userId}`,
      lastMessage: "Welcome to our service!",
      lastUpdated: Date.now(),
      unreadMessagesCount: new Map([
        [vendorId.toString(), 1],
        [userId, 0],
      ]),
    };

    const createdConversation = await Conversation.create(payloadWithWorker);
    const newConversation = await createdConversation.populate(
      "participants.userId"
    );

    const newMessage = new Message({
      conversationId: newConversation?.conversationId,
      senderId: vendorId,
      receiverId: userId,
      senderRole: "vendor",
      receiverRole: "user",
      senderRefrence: "Vendor",
      receiverRefrence: "User",
      message: "Welcome to our service!",
    });
    await newMessage.save();

    io.to(`user_${userId}`).emit("new_conversation", newConversation);
    io.to(`vendor_${vendorId}`).emit("new_conversation", newConversation);

    return res.status(200).json({
      success: true,
      message: "Conversation created successfully",
      data: newConversation,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error creating conversation",
      error: error.message,
    });
  }
};

const getConversations = async (req, res) => {
  try {
    const { id, type } = req.params;

    console.log("IDDDDDDDDDDDDDDDDDS:", id, type);

    let filter = {
      "participants.userId": id,
      "participants.role": type,
    };

    const conversations = await Conversation.find(filter)
      .populate("participants.userId")
      .sort({ lastUpdated: -1 });

    return res.status(200).json({
      success: true,
      message: "Conversation fetched successfully",
      data: conversations,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error fetching conversations",
      error: error.message,
    });
  }
};

const getSingleConversationWithVendor = async (req, res) => {
  try {
    const { userId, vendorId } = req.params;

    // console.log("IDDDDDDDDDDDDDDDDDS:", userId, vendorId);

    const conversation = await Conversation.findOne({
      participants: {
        $all: [
          { $elemMatch: { role: "vendor", userId: vendorId } },
          { $elemMatch: { role: "user", userId: userId } },
        ],
      },
    })
      .sort({ lastUpdated: -1 })
      .populate("participants.userId");

    return res.status(200).json({
      success: true,
      message: "Conversation fetched successfully",
      data: conversation,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error fetching conversation",
      error: error.message,
    });
  }
};

module.exports = {
  createChatUserWithVendor,
  getConversations,
  getSingleConversationWithVendor,
};
