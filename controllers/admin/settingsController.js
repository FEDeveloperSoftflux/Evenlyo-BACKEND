const bcrypt = require('bcrypt');
const Admin = require('../../models/Admin');
const User = require('../../models/User');
const Settings = require('../../models/Settings');

const resetPassword = async (req, res) => {
    try {
        // The JWT/req.user contains the user id (User document), not the Admin document id.
        const userId = req.user && req.user.id;
        const { oldPassword, newPassword } = req.body;

        if (!oldPassword || !newPassword) {
            return res.status(400).json({ message: 'Old and new password required.' });
        }

        if (typeof newPassword !== 'string' || newPassword.length < 8) {
            return res.status(400).json({ message: 'New password must be at least 8 characters long.' });
        }

        // Handle superadmin special case (no DB user)
        if (userId === 'superadmin') {
            return res.status(403).json({ message: 'Superadmin password reset is not supported via this endpoint.' });
        }

        // Find the User (password lives on User model)
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // Ensure this user is an admin (extra safety)
        if (user.userType !== 'admin') {
            return res.status(403).json({ message: 'Only admin users may use this endpoint.' });
        }

        // Compare old password
        const isMatch = await bcrypt.compare(oldPassword, user.password || '');
        if (!isMatch) {
            return res.status(401).json({ message: 'Old password is incorrect.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        user.password = hashedPassword;
        await user.save();

        res.json({ message: 'Password updated successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Server error.', error: error.message });
    }
};

const getPlatformFees = async (req, res) => {
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

const setPlatformFees = async (req, res) => {
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

const getNotificationSettings = async (req, res) => {
    try {
        const settings = await Settings.findOne();
        if (!settings) {
            return res.status(404).json({ message: 'Settings not found.' });
        }

        // Ensure notification settings exist with defaults
        const notificationSettings = settings.adminNotificationSettings || {
            email: {
                bookingCompletion: true,
                newAccount: true
            },
            push: {
                bookingCompletion: true,
                newAccount: true
            }
        };

        res.json({
            message: 'Notification settings retrieved successfully.',
            notifications: notificationSettings
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error.', error: error.message });
    }
};

const toggleEmailNotifications = async (req, res) => {
    try {
        let { bookingCompletion, newAccount, orderCompletion, newRegistration } = req.body;
        
        // Handle both property name variations
        let finalBookingCompletion = bookingCompletion !== undefined ? bookingCompletion : orderCompletion;
        let finalNewAccount = newAccount !== undefined ? newAccount : newRegistration;
        
        // Convert string booleans to actual booleans
        if (typeof finalBookingCompletion === 'string') {
            finalBookingCompletion = finalBookingCompletion.toLowerCase() === 'true';
        }
        if (typeof finalNewAccount === 'string') {
            finalNewAccount = finalNewAccount.toLowerCase() === 'true';
        }
        
        if (typeof finalBookingCompletion !== 'boolean' || typeof finalNewAccount !== 'boolean') {
            return res.status(400).json({ message: 'bookingCompletion/orderCompletion and newAccount/newRegistration must be boolean values.' });
        }

        let settings = await Settings.findOne();
        if (!settings) {
            settings = new Settings();
        }

        if (!settings.adminNotificationSettings) {
            settings.adminNotificationSettings = { email: {}, push: {} };
        }
        if (!settings.adminNotificationSettings.email) {
            settings.adminNotificationSettings.email = {};
        }

        settings.adminNotificationSettings.email.bookingCompletion = finalBookingCompletion;
        settings.adminNotificationSettings.email.newAccount = finalNewAccount;

        // Mark the nested object as modified for Mongoose to detect changes
        settings.markModified('adminNotificationSettings');

        await settings.save();
        res.json({ 
            message: 'Email notification settings updated successfully.',
            email: settings.adminNotificationSettings.email
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error.', error: error.message });
    }
};

const togglePushNotifications = async (req, res) => {
    try {
        let { bookingCompletion, newAccount, orderCompletion, newRegistration } = req.body;
        
        // Handle both property name variations
        let finalBookingCompletion = bookingCompletion !== undefined ? bookingCompletion : orderCompletion;
        let finalNewAccount = newAccount !== undefined ? newAccount : newRegistration;
        
        // Convert string booleans to actual booleans
        if (typeof finalBookingCompletion === 'string') {
            finalBookingCompletion = finalBookingCompletion.toLowerCase() === 'true';
        }
        if (typeof finalNewAccount === 'string') {
            finalNewAccount = finalNewAccount.toLowerCase() === 'true';
        }
        
        if (typeof finalBookingCompletion !== 'boolean' || typeof finalNewAccount !== 'boolean') {
            return res.status(400).json({ message: 'bookingCompletion/orderCompletion and newAccount/newRegistration must be boolean values.' });
        }

        let settings = await Settings.findOne();
        if (!settings) {
            settings = new Settings();
        }

        if (!settings.adminNotificationSettings) {
            settings.adminNotificationSettings = { email: {}, push: {} };
        }
        if (!settings.adminNotificationSettings.push) {
            settings.adminNotificationSettings.push = {};
        }

        settings.adminNotificationSettings.push.bookingCompletion = finalBookingCompletion;
        settings.adminNotificationSettings.push.newAccount = finalNewAccount;

        // Mark the nested object as modified for Mongoose to detect changes
        settings.markModified('adminNotificationSettings');

        await settings.save();
        res.json({ 
            message: 'Push notification settings updated successfully.',
            push: settings.adminNotificationSettings.push
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error.', error: error.message });
    }
};

module.exports = {
    resetPassword,
    getPlatformFees,
    setPlatformFees,
    getNotificationSettings,
    toggleEmailNotifications,
    togglePushNotifications
};
