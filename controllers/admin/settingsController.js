const bcrypt = require('bcrypt');
const Admin = require('../../models/Admin');
const Settings = require('../../models/Settings');

exports.resetPassword = async (req, res) => {
    try {
        const adminId = req.user.id; // assuming authMiddleware sets req.user
        const { oldPassword, newPassword } = req.body;

        if (!oldPassword || !newPassword) {
            return res.status(400).json({ message: 'Old and new password required.' });
        }

        const admin = await Admin.findById(adminId);
        if (!admin) {
            return res.status(404).json({ message: 'Admin not found.' });
        }

        const isMatch = await bcrypt.compare(oldPassword, admin.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Old password is incorrect.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        admin.password = hashedPassword;
        await admin.save();

        res.json({ message: 'Password updated successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Server error.', error: error.message });
    }
};

exports.getPlatformFees = async (req, res) => {
    try {
        const settings = await Settings.findOne();
        if (!settings) {
            return res.status(404).json({ message: 'Settings not found.' });
        }
        res.json({
            bookingItemPlatformFee: settings.bookingItemPlatformFee,
            salesItemPlatformFee: settings.salesItemPlatformFee
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error.', error: error.message });
    }
};

exports.setPlatformFees = async (req, res) => {
    try {
        const { bookingItemPlatformFee, salesItemPlatformFee } = req.body;
        if (typeof bookingItemPlatformFee !== 'number' || bookingItemPlatformFee < 0 || typeof salesItemPlatformFee !== 'number' || salesItemPlatformFee < 0) {
            return res.status(400).json({ message: 'Both fees must be non-negative numbers.' });
        }
        let settings = await Settings.findOne();
        if (!settings) {
            settings = new Settings({ bookingItemPlatformFee, salesItemPlatformFee });
        } else {
            settings.bookingItemPlatformFee = bookingItemPlatformFee;
            settings.salesItemPlatformFee = salesItemPlatformFee;
        }
        await settings.save();
        res.json({ message: 'Platform fees updated successfully.', bookingItemPlatformFee, salesItemPlatformFee });
    } catch (error) {
        res.status(500).json({ message: 'Server error.', error: error.message });
    }
};
