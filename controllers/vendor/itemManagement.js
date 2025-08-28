const ServiceItem = require('../../models/Item');
const Booking = require('../../models/Booking');
const Category = require('../../models/Category');
const SubCategory = require('../../models/SubCategory');

// PATCH /api/vendor/items/:id/toggle-status
exports.toggleItemStatus = async (req, res) => {
    try {
        const vendorId = req.vendor._id;
        const itemId = req.params.id;

        // Find the item and ensure it belongs to the vendor
        const item = await ServiceItem.findOne({ _id: itemId, vendorId });
        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found or not authorized' });
        }

        // Toggle the status (active/inactive)
        item.status = item.status === 'active' ? 'inactive' : 'active';
        item.isActive = item.status === 'active';
        await item.save();

        res.json({
            success: true,
            message: `Item status updated to ${item.status}`,
            status: item.status,
            isActive: item.isActive
        });
    } catch (err) {
        console.error('Toggle item status error:', err);
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
};

// GET /api/vendor/items/overview
exports.getVendorItemsOverview = async (req, res) => {
    try {
        const vendorId = req.vendor._id;

        // Get all items for this vendor
        const items = await ServiceItem.find({ vendorId })
            .populate('mainCategory', 'name')
            .populate('subCategory', 'name');

        // Stats: unique main categories and subcategories
        const mainCategorySet = new Set();
        const subCategorySet = new Set();
        items.forEach(item => {
            if (item.mainCategory) mainCategorySet.add(item.mainCategory._id.toString());
            if (item.subCategory) subCategorySet.add(item.subCategory._id.toString());
        });

        // Total number of items
        const totalItems = items.length;

        // Most booked items (for bar chart)
        const bookings = await Booking.aggregate([
            { $match: { vendorId: vendorId } },
            { $group: { _id: '$itemId', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        // Map booking counts to itemId
        const bookingCountMap = {};
        bookings.forEach(b => { bookingCountMap[b._id?.toString()] = b.count; });

        // itemOverview: all items with their booking count
        const itemOverview = items.map(item => ({
            itemId: item._id,
            title: item.title?.en || item.title,
            bookedCount: bookingCountMap[item._id.toString()] || 0
        }));

        // itemTable: all items with required details
        const itemTable = items.map(item => ({
            itemId: item._id,
            image: item.media?.featuredImage || '',
            title: item.title?.en || item.title,
            description: item.description?.en || item.description,
            category: item.mainCategory?.name?.en || '',
            pricing: item.pricing,
            date: item.createdAt,
            status: item.availability?.isAvailable !== false // default true
        }));

        res.json({
            success: true,
            stats: {
                totalMainCategories: mainCategorySet.size,
                totalSubCategories: subCategorySet.size,
                totalItems
            },
            itemOverview,
            itemTable
        });
    } catch (err) {
        console.error('Vendor item overview error:', err);
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
};
