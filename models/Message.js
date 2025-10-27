const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: String,
      required: true,
      ref: "Conversation",
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "senderRefrence",
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "receiverRefrence",
    },
    senderRefrence: {
      type: String,
      required: true,
      enum: ["User", "Vendor"],
    },
    receiverRefrence: {
      type: String,
      required: true,
      enum: ["User", "Vendor"],
    },
    senderRole: {
      type: String,
      enum: ["user", "vendor"],
      required: true,
    },
    receiverRole: {
      type: String,
      enum: ["user", "vendor"],
      required: true,
    },
    message: {
      type: String,
      default: "",
    },
    attachment: {
      url: { type: String },
      type: {
        type: String,
        enum: ["image", "file"],
      },
      name: { type: String },
      size: { type: Number },
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        refPath: "senderRefrence",
      },
    ],
  },
  {
    collection: "message",
    timestamps: true,
  }
);

const Message = mongoose.model("Message", MessageSchema);
module.exports = Message;
