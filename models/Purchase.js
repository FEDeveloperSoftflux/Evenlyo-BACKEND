const mongoose = require('mongoose');


const purchaseSchema = new mongoose.Schema({
    trackingId: {
        type: String,
        unique: true,
        required: true
    },
    item: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceItem',
        required: true
    },
    itemName: {
        type: String,
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    userName: {
        type: String,
        required: true
    },
    vendor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vendor',
        required: true
    },
    vendorName: {
        type: String,
        required: true
    },
    quantity: {
        type: Number,
        required: true
    },
    location: {
        type: String,
        required: true
    },
    totalPrice: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['on the way', 'complete'],
        default: 'on the way'
    },
    purchasedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// Generate tracking ID before saving
purchaseSchema.pre('save', async function(next) {
    if (!this.trackingId) {
        const timestamp = Date.now().toString();
        const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        this.trackingId = `PUR${timestamp.slice(-6)}${randomNum}`;
    }
    next();
});

module.exports = mongoose.model('Purchase', purchaseSchema);
