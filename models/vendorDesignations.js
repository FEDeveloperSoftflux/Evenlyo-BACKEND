const mongoose = require('mongoose');

const VendorDesignationSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    permissions: {
        type: Array,
        default: []
    },
    isActive: {
        type: Boolean,
        default: true
    },
    vendorId: {
        type: mongoose.Types.ObjectId
    }
}, { timestamps: true });

module.exports = mongoose.model('VendorDesignation', VendorDesignationSchema);