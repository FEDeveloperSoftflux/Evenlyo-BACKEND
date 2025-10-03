
const Item = require('../../models/Item');
const Category = require('../../models/Category');
const SubCategory = require('../../models/SubCategory');
const Listing = require('../../models/Listing');
const { toMultilingualText } = require('../../utils/textUtils');

// Create a new item
const createItem = async (req, res) => {
	try {
		const {
			title,
			mainCategory,
			subCategory,
			purchasePrice,
			sellingPrice,
			stockQuantity,
			image,
			linkedListing
		} = req.body;

		// Validate vendor session
		if (!req.user || !req.user.vendorId) {
			return res.status(401).json({
				success: false,
				message: 'Vendor authentication required'
			});
		}

		// Validate required fields
		if (!title || (typeof title === 'string' && !title.trim())) {
			return res.status(400).json({
				success: false,
				message: 'Validation error',
				errors: ['Title is required']
			});
		}

		// Validate linked listing if provided
		let listingDetails = null;
		if (linkedListing) {
			try {
				const listing = await Listing.findById(linkedListing);
				if (!listing) {
					return res.status(404).json({
						success: false,
						message: 'Linked listing not found'
					});
				}
				// Check if listing belongs to the same vendor
				const currentVendorId = req.user.vendorId;
				if (listing.vendor.toString() !== currentVendorId) {
					return res.status(403).json({
						success: false,
						message: 'You can only link items to your own listings'
					});
				}
				listingDetails = {
					id: listing._id,
					title: listing.title
				};
			} catch (error) {
				return res.status(400).json({
					success: false,
					message: 'Invalid linked listing ID'
				});
			}
		}

		let mainCategoryName = 'Others';
		let subCategoryName = 'Others';

		// If mainCategory ID is provided, fetch its name
		if (mainCategory) {
			const category = await Category.findById(mainCategory);
			if (category && category.name && category.name.en) {
				mainCategoryName = category.name.en;
			}
		}

		// If subCategory ID is provided, fetch its name
		if (subCategory) {
			const subCat = await SubCategory.findById(subCategory);
			if (subCat && subCat.name && subCat.name.en) {
				subCategoryName = subCat.name.en;
			}
		}

		// Convert title to multilingual format
		const multilingualTitle = toMultilingualText(title);

		const item = new Item({
			title: multilingualTitle,
			mainCategory: mainCategory || '',
			subCategory: subCategory || '',
			mainCategoryName,
			subCategoryName,
			purchasePrice,
			sellingPrice,
			stockQuantity,
			image,
			vendor: req.user.vendorId,
			linkedListing: linkedListing || null
		});

		await item.save();
		return res.status(201).json({ 
			success: true, 
			item,
			listingDetails: listingDetails
		});
	} catch (error) {
		return res.status(500).json({ success: false, message: error.message });
	}
};

// Get all items for a vendor with their linked listings
const getVendorItems = async (req, res) => {
	try {
		// Validate vendor session
		if (!req.user || !req.user.vendorId) {
			return res.status(401).json({
				success: false,
				message: 'Vendor authentication required'
			});
		}

		const vendorId = req.user.vendorId;
		
		const items = await Item.find({ vendor: vendorId })
			.populate('mainCategory', 'name')
			.populate('subCategory', 'name')
			.populate('linkedListing', 'title subtitle')
			.sort({ createdAt: -1 });

		return res.status(200).json({ 
			success: true, 
			items,
			count: items.length
		});
	} catch (error) {
		return res.status(500).json({ success: false, message: error.message });
	}
};

// Update item's linked listing
const updateItemListing = async (req, res) => {
	try {
		// Validate vendor session
		if (!req.user || !req.user.vendorId) {
			return res.status(401).json({
				success: false,
				message: 'Vendor authentication required'
			});
		}

		const { itemId } = req.params;
		const { linkedListing } = req.body;
		const vendorId = req.user.vendorId;

		// Find the item and verify ownership
		const item = await Item.findById(itemId);
		if (!item) {
			return res.status(404).json({
				success: false,
				message: 'Item not found'
			});
		}

		if (item.vendor.toString() !== vendorId) {
			return res.status(403).json({
				success: false,
				message: 'You can only update your own items'
			});
		}

		// Validate linked listing if provided
		let listingDetails = null;
		if (linkedListing) {
			try {
				const listing = await Listing.findById(linkedListing);
				if (!listing) {
					return res.status(404).json({
						success: false,
						message: 'Linked listing not found'
					});
				}
				// Check if listing belongs to the same vendor
				if (listing.vendor.toString() !== vendorId) {
					return res.status(403).json({
						success: false,
						message: 'You can only link items to your own listings'
					});
				}
				listingDetails = {
					id: listing._id,
					title: listing.title
				};
			} catch (error) {
				return res.status(400).json({
					success: false,
					message: 'Invalid linked listing ID'
				});
			}
		}

		// Update the item
		item.linkedListing = linkedListing || null;
		await item.save();

		return res.status(200).json({
			success: true,
			message: 'Item linked listing updated successfully',
			item,
			listingDetails: listingDetails
		});
	} catch (error) {
		return res.status(500).json({ success: false, message: error.message });
	}
};

// Remove listing link from item
const removeItemListing = async (req, res) => {
	try {
		// Validate vendor session
		if (!req.user || !req.user.vendorId) {
			return res.status(401).json({
				success: false,
				message: 'Vendor authentication required'
			});
		}

		const { itemId } = req.params;
		const vendorId = req.user.vendorId;

		// Find the item and verify ownership
		const item = await Item.findById(itemId);
		if (!item) {
			return res.status(404).json({
				success: false,
				message: 'Item not found'
			});
		}

		if (item.vendor.toString() !== vendorId) {
			return res.status(403).json({
				success: false,
				message: 'You can only update your own items'
			});
		}

		// Remove the linked listing
		item.linkedListing = null;
		await item.save();

		return res.status(200).json({
			success: true,
			message: 'Listing link removed successfully',
			item
		});
	} catch (error) {
		return res.status(500).json({ success: false, message: error.message });
	}
};

module.exports = {
	createItem,
	getVendorItems,
	updateItemListing,
	removeItemListing
};