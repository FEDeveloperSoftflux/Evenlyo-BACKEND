
const Item = require('../../models/Item');
const Purchase = require('../../models/Purchase');


// Buy item API
const buyItem = async (req, res) => {
    try {
        const { itemId, quantity, location } = req.body;
        if (!itemId || !quantity || quantity <= 0 || !location) {
            return res.status(400).json({ success: false, message: 'Invalid itemId, quantity, or location.' });
        }
        const item = await Item.findById(itemId);
        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found.' });
        }
        if (item.stockQuantity < quantity) {
            return res.status(400).json({ success: false, message: 'Not enough stock.' });
        }
        // Reduce stock
        item.stockQuantity -= quantity;
        await item.save();

        // Get vendor info
        const vendorId = item.vendor || item.vendorId; // adjust field name if needed
        let vendorName = '';
        let vendorRef = null;
        if (vendorId) {
            const Vendor = require('../../models/Vendor');
            const vendor = await Vendor.findById(vendorId);
            if (vendor) {
                vendorName = vendor.businessName || '';
                vendorRef = vendor._id;
            }
        }

        // If vendor info is missing, return error
        if (!vendorRef || !vendorName) {
            return res.status(400).json({ success: false, message: 'Item does not have a valid vendor assigned.' });
        }

        // Calculate total price
        const totalPrice = quantity * item.sellingPrice;

        // Track purchase
        const purchase = new Purchase({
            item: itemId,
            itemName: item.title,
            user: req.user.id,
            userName: req.user.firstName + ' ' + req.user.lastName,
            vendor: vendorRef,
            vendorName,
            quantity,
            location,
            totalPrice
        });
        await purchase.save();

        return res.status(200).json({ success: true, message: 'Item purchased successfully.', item, purchase });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Get items by selected category and subcategory
const getItemsByCategory = async (req, res) => {
	try {
		const { categoryId, subCategoryId } = req.query;
		const filter = {};
		if (categoryId && typeof categoryId === 'string' && categoryId.trim() !== '') {
			filter.mainCategory = categoryId.trim();
		}
		if (subCategoryId && typeof subCategoryId === 'string' && subCategoryId.trim() !== '') {
			filter.subCategory = subCategoryId.trim();
		}
		// Exclude items with null or 'Others' category/subcategory names
		const items = await Item.find({
			...filter,
			mainCategoryName: { $nin: [null, 'Others'] },
			subCategoryName: { $nin: [null, 'Others'] }
		});
		return res.status(200).json({ success: true, items });
	} catch (error) {
		return res.status(500).json({ success: false, message: error.message });
	}
};
module.exports = {
    buyItem,
    getItemsByCategory
};
