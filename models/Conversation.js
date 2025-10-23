const mongoose = require("mongoose");

const ConversationSchema = new mongoose.Schema(
  {
    participants: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          refPath: "participants.refPath",
        },
        refPath: {
          type: String,
          required: true,
          enum: ["User", "Vendor"],
        },
        role: {
          type: String,
          required: true,
          enum: ["user","vendor"],
        },
      },
    ],
    conversationId: {
      type: String,
      required: true,
      unique: true,
    },
    lastMessage: {
      type: String,
      default: "",
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
    messagesCount: {
      type: Number,
      default: 0,
    },
    unreadMessagesCount: {
      type: Map,
      of: Number,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

const Conversation = mongoose.model("Conversation", ConversationSchema);
module.exports = Conversation;
