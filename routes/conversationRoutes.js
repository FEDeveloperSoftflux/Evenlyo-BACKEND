const express = require("express");
const {
  createChatUserWithVendor,
  getConversations,
  getSingleConversationWithVendor,
  blockConversation,
  unblockConversation,
  reportConversation,
} = require("../controllers/conversationController");
const router = express.Router();

router.post("/", createChatUserWithVendor);
router.get("/:id/:type", getConversations);
router.get("/single/:userId/:vendorId", getSingleConversationWithVendor);
router.patch("/block/:id", blockConversation);
router.patch("/unblock/:id", unblockConversation);
router.patch("/report/:id", reportConversation);

module.exports = router;
