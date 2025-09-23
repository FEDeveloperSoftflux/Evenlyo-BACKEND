const Message = require("../models/Message");
const ChatRoom = require("../models/ChatRoom");

function chatSocket(io) {
  io.on("connection", (socket) => {
    console.log("🔌 User connected:", socket.id);

    // Join a specific chat room
    socket.on("joinRoom", async (roomId) => {
      socket.join(roomId);
      console.log(`📥 User joined room: ${roomId}`);
    });

    // Send a new message
    socket.on("sendMessage", async ({ sender, content, chatRoom }) => {
      try {
        // Make sure chat room exists
        const room = await ChatRoom.findById(chatRoom);
        if (!room) {
          console.error("❌ ChatRoom not found:", chatRoom);
          return;
        }

        // Save message in DB
        const newMessage = await Message.create({
          sender,
          content,
          chatRoom,
          readBy: [sender], // mark sender as having "read" their own message
        });

        // Broadcast message to everyone in the room
        io.to(chatRoom).emit("receiveMessage", newMessage);
      } catch (err) {
        console.error("⚠️ Error sending message:", err.message);
      }
    });

    // Mark a message as read
    socket.on("markAsRead", async ({ messageId, userId, chatRoom }) => {
      try {
        const updatedMessage = await Message.findByIdAndUpdate(
          messageId,
          { $addToSet: { readBy: userId } }, // add only if not already there
          { new: true }
        );

        // Broadcast updated message to the room
        io.to(chatRoom).emit("messageRead", updatedMessage);
      } catch (err) {
        console.error("⚠️ Error marking message as read:", err.message);
      }
    });

    // Handle disconnection
    socket.on("disconnect", () => {
      console.log("❌ User disconnected:", socket.id);
    });
  });
}

module.exports = chatSocket;

