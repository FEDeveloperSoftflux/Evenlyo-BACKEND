const Purchase = require('../../models/Purchase');
const mongoose = require('mongoose');

/**
 * Get user's purchase history
 * @route GET /api/client/purchases/history
 * @access Private (requires authentication)
 */
const getPurchaseHistory = async (req, res) => {
    try {
        const userId = req.user.id; // User ID comes from auth middleware

        // Fetch all purchases for the authenticated user
        const purchases = await Purchase.find({ user: userId })
            .sort({ purchasedAt: -1 }); // Sort by most recent first

        // Format the response data
        const purchaseHistory = purchases.map(purchase => ({
            trackingId: purchase._id.toString(), // Using purchase ID as tracking ID
            sellerName: purchase.vendorName,
            location: purchase.location,
            totalPrice: purchase.totalPrice,
            status: purchase.status,
            purchaseDate: purchase.purchasedAt,
            itemName: purchase.itemName,
            quantity: purchase.quantity
        }));

        res.status(200).json({
            success: true,
            message: 'Purchase history retrieved successfully',
            data: purchaseHistory,
            count: purchaseHistory.length
        });

    } catch (error) {
        console.error('Error fetching purchase history:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve purchase history',
            error: error.message
        });
    }
};



module.exports = {
    getPurchaseHistory,
};
