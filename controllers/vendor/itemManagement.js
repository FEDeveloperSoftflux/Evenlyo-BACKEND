
const Item = require('../../models/Item');
const Category = require('../../models/Category');
const SubCategory = require('../../models/SubCategory');
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
			vendorId
		} = req.body;

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

		const item = new Item({
			title,
			mainCategory: mainCategory || '',
			subCategory: subCategory || '',
			mainCategoryName,
			subCategoryName,
			purchasePrice,
			sellingPrice,
			stockQuantity,
			image,
			vendor: vendorId || req.user.vendorId || ''
		});

		await item.save();
		return res.status(201).json({ success: true, item });
	} catch (error) {
		return res.status(500).json({ success: false, message: error.message });
	}
};

module.exports = {
	createItem,
};