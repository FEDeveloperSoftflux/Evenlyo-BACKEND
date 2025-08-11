const mongoose = require('mongoose');

// Chat Schema: represents a conversation between two users (vendor & client)
const chatSchema = new mongoose.Schema({
	participants: [
		{
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			required: true
		}
	],
	lastMessage: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Message',
	},
	createdAt: {
		type: Date,
		default: Date.now
	},
	updatedAt: {
		type: Date,
		default: Date.now
	}
});

module.exports = mongoose.model('Chat', chatSchema);
