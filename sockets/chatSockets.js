const Message = require("../models/Message");
const Conversation = require("../models/Conversation");

function chatSocket(io) {
  io.on("connection", (socket) => {
    console.log("New connection:", socket.id);

    // Join a conversation room for chatting
    socket.on("join_conversation_room", ({ conversationId }) => {
      socket.join(conversationId);
      console.log(`CONVERSATION ROOM JOINED: ${conversationId}`);
    });

    // Admin Connected
    socket.on("vendor_connected", ({ vendorId }) => {
      const room = `vendor_${vendorId}`;
      socket.join(room);
      console.log(`VENDOR_CONNECTED: ${room}`);
    });

    //  User Connected
    socket.on("user_connected", ({ userId }) => {
      const room = `user_${userId}`;
      socket.join(room);
      console.log(`USER_CONNECTED: ${room}`);
    });

    socket.on("send_message", async (params) => {
      console.log("EVENT_FIRED", params);

      const {
        conversationId,
        senderId,
        receiverId,
        senderRole,
        receiverRole,
        senderRefrence,
        receiverRefrence,
        message,
        conversationType,
        attachment,
      } = params;

      try {
        const newMessage = new Message({
          conversationId,
          senderId,
          receiverId,
          senderRole,
          receiverRole,
          senderRefrence,
          receiverRefrence,
          message,
          ...(attachment && {
            attachment: {
              url: attachment?.url,
              type: attachment?.type,
              name: attachment?.name,
              size: attachment?.size,
            },
          }),
        });
        await newMessage.save();

        console.log("NEW_MESSAGE_SAVED", newMessage);

        try {
          const conversation = await Conversation.findOne({ conversationId });

          if (conversation) {
            conversation.lastMessage = message;
            conversation.lastUpdated = Date.now();
            conversation.messagesCount += 1;

            const currentUnreadCount =
              conversation.unreadMessagesCount.get(receiverId) || 0;
            conversation.unreadMessagesCount.set(
              receiverId,
              currentUnreadCount + 1
            );

            await conversation.save();

            const conObj = {
              conversationId,
              lastMessage: message,
              lastUpdated: Date.now(),
              unreadMessagesCount: Object.fromEntries(
                conversation.unreadMessagesCount
              ),
            };

            if (conversationType === "vender-to-user") {
              io.to(`user_${receiverId}`).emit("new_conversation", conObj);
              io.to(`vendor_${senderId}`).emit("new_conversation", conObj);
            }
            if (conversationType === "user-to-vendor") {
              io.to(`vendor_${receiverId}`).emit("new_conversation", conObj);
              io.to(`user_${senderId}`).emit("new_conversation", conObj);
            }
          }
        } catch (error) {
          console.error("Error updating conversation:", error.message);
        }

        console.log("New message saved:", newMessage);
        socket.broadcast.to(conversationId).emit("receive_message", newMessage);
      } catch (err) {
        console.error("Error saving message:", err.message);
      }
    });

    socket.on(
      "reset_unread_count",
      async ({ conversationId, userId, userType }) => {
        try {
          const conversation = await Conversation.findOne({ conversationId });
          if (conversation) {
            if (conversation.unreadMessagesCount.has(userId)) {
              conversation.unreadMessagesCount.set(userId, 0);
              await conversation.save();

              const conObj = {
                conversationId,
                isListUpdated: false,
                lastMessage: conversation.lastMessage,
                lastUpdated: conversation.lastUpdated,
                unreadMessagesCount: Object.fromEntries(
                  conversation.unreadMessagesCount
                ),
              };

              if (userType === "user") {
                io.to(`user_${userId}`).emit("new_conversation", conObj);
              }
              if (userType === "vendor") {
                io.to(`vendor_${userId}`).emit("new_conversation", conObj);
              }
            }
          }
        } catch (error) {
          console.error("Error resetting unread count:", error.message);
        }
      }
    );

    // Handle disconnection
    socket.on("disconnect", () => {
      console.log("❌ User disconnected:", socket.id);
    });
  });
}

module.exports = chatSocket;
