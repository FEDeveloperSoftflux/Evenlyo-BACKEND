const express = require("express");
const { getMessages, sendMessage, markAsRead } = require("../controllers/messageController");
const router = express.Router();

router.get("/:chatRoomId", getMessages);
router.post("/", sendMessage);
router.patch("/read", markAsRead);

module.exports = router;
