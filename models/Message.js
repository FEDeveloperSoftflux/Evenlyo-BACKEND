const mongoose = require('mongoose');

// Message Schema: supports multilingual messages
const messageSchema = new mongoose.Schema({
	chat: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Chat',
		required: true
	},
	sender: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
		required: true
	},
	// Multilingual support: translations object { en: 'Hello', fr: 'Bonjour', ... }
	translations: {
		type: Map,
		of: String,
		required: true
	},
	// Optionally, store the original language
	originalLanguage: {
		type: String,
		required: true
	},
	sentAt: {
		type: Date,
		default: Date.now
	}
});

module.exports = mongoose.model('Message', messageSchema);
