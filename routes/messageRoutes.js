const express = require("express");
const {
  getMessages,
  sendMessage,
  markAsRead,
  softDeleteMessage,
} = require("../controllers/messageController");
const router = express.Router();

router.get("/:conversationId/:userId", getMessages);
router.delete("/:conversationId/:userId", softDeleteMessage);
// router.post("/", sendMessage);
// router.patch("/read", markAsRead);

module.exports = router;
