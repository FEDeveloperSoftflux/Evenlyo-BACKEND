const express = require("express");
const { getOrCreateRoom, getUserRooms, getRecentChats } = require("../controllers/chatRoomController");

const router = express.Router();

router.post("/", getOrCreateRoom);
router.get("/:userId", getUserRooms);
router.get("/recent/:userId", getRecentChats);
module.exports = router;
