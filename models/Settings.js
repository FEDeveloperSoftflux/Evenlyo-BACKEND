const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
    bookingItemPlatformFee: {
        type: Number,
        required: true,
        default: 0
    },
    salesItemPlatformFee: {
        type: Number,
        required: true,
        default: 0
    }
});

module.exports = mongoose.model('Settings', SettingsSchema);
