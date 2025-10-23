const express = require("express");
const {
  createChatUserWithVendor,
  getConversations,
  getSingleConversationWithVendor,
} = require("../controllers/conversationController");
const router = express.Router();

router.post("/", createChatUserWithVendor);
router.get("/:id/:type", getConversations);
router.get("/single/:userId/:vendorId", getSingleConversationWithVendor);

module.exports = router;
