const Listing = require('../../models/Listing');
const Booking = require('../../models/Booking');


const toggleListingStatus = async (req, res) => {
	try {
		const vendorId = req.vendor._id;
		const listingId = req.params.id;

		// Find the listing and ensure it belongs to the vendor
		const listing = await Listing.findOne({ _id: listingId, vendor: vendorId });
		if (!listing) {
			return res.status(404).json({ success: false, message: 'Listing not found or not authorized' });
		}

		// Toggle the status (active/inactive)
		listing.status = listing.status === 'active' ? 'inactive' : 'active';
		listing.isActive = listing.status === 'active';
		await listing.save();

		res.json({
			success: true,
			message: `Listing status updated to ${listing.status}`,
			status: listing.status,
			isActive: listing.isActive
		});
	} catch (err) {
		console.error('Toggle listing status error:', err);
		res.status(500).json({ success: false, message: 'Server error', error: err.message });
	}
};

// GET /api/vendor/listings/overview
const getVendorListingsOverview = async (req, res) => {
	try {
		const vendorId = req.vendor._id;

		// Get all listings for this vendor
		const listings = await Listing.find({ vendor: vendorId })
			.populate('category', 'name')
			.populate('subCategory', 'name');

		// Stats: unique main categories and subcategories
		const mainCategorySet = new Set();
		const subCategorySet = new Set();
		listings.forEach(listing => {
			if (listing.category) mainCategorySet.add(listing.category._id.toString());
			if (listing.subCategory) subCategorySet.add(listing.subCategory._id.toString());
		});

		// Total number of listings
		const totalListings = listings.length;

		// Most booked listings (for bar chart)
		const bookings = await Booking.aggregate([
			{ $match: { vendorId: vendorId } },
			{ $group: { _id: '$listingId', count: { $sum: 1 } } },
			{ $sort: { count: -1 } }
		]);

		// Map booking counts to listingId
		const bookingCountMap = {};
		bookings.forEach(b => { bookingCountMap[b._id?.toString()] = b.count; });

		// listingOverview: all listings with their booking count
		const listingOverview = listings.map(listing => ({
			listingId: listing._id,
			title: listing.title?.en || listing.title,
			bookedCount: bookingCountMap[listing._id.toString()] || 0
		}));

		// listingTable: all listings with required details
		const listingTable = listings.map(listing => ({
			listingId: listing._id,
			image: listing.media?.featuredImage || '',
			title: listing.title?.en || listing.title,
			description: listing.description?.en || listing.description,
			category: listing.category?.name?.en || '',
			pricing: listing.pricing,
			date: listing.createdAt,
			status: listing.status,
		}));

		res.json({
			success: true,
			stats: {
				totalMainCategories: mainCategorySet.size,
				totalSubCategories: subCategorySet.size,
				totalListings
			},
			listingOverview,
			listingTable
		});
	} catch (err) {
		console.error('Vendor listing overview error:', err);
		res.status(500).json({ success: false, message: 'Server error', error: err.message });
	}
};

// @desc    Create a new listing
// @route   POST /api/listings
// @access  Private (Vendor only)
const createListing = async (req, res) => {
	try {
		const listingData = req.body;

		// Ensure title, subtitle, and description are strings (not objects)
		if (typeof listingData.title === 'object' && listingData.title !== null) {
			listingData.title = listingData.title.en || listingData.title.nl || '';
		}
		if (typeof listingData.subtitle === 'object' && listingData.subtitle !== null) {
			listingData.subtitle = listingData.subtitle.en || listingData.subtitle.nl || '';
		}
		if (typeof listingData.description === 'object' && listingData.description !== null) {
			listingData.description = listingData.description.en || listingData.description.nl || '';
		}

		// Automatically set security fee based on service type
		if (listingData.serviceType === 'human') {
			if (listingData.pricing) {
				listingData.pricing.securityFee = 0;
			}
		} else if (listingData.serviceType === 'non_human') {
			if (listingData.pricing && (!listingData.pricing.securityFee || listingData.pricing.securityFee === 0)) {
				listingData.pricing.securityFee = 50; // Default security fee for equipment
			}
		}

		console.log("listingData", listingData);
		const listing = new Listing(listingData);
		await listing.save();

		// Populate the response
		const populatedListing = await Listing.findById(listing._id)
			.populate('vendor', '_id businessName businessLocation businessDescription businessEmail businessPhone businessWebsite gallery userId')
			.populate('category', 'name icon description')
			.populate('subCategory', 'name icon description');

		res.status(201).json({
			success: true,
			message: 'Listing created successfully',
			data: populatedListing
		});
	} catch (error) {
		console.error('Error creating listing:', error);

		if (error.name === 'ValidationError') {
			const errors = Object.values(error.errors).map(err => err.message);
			return res.status(400).json({
				success: false,
				message: 'Validation error',
				errors
			});
		}

		res.status(500).json({
			success: false,
			message: 'Error creating listing',
			error: error.message
		});
	}
};


// @desc    Update an existing listing
// @route   PUT /api/listings/:id
// @access  Private (Vendor only)
const updateListing = async (req, res) => {
  try {
	const { id } = req.params;
	const updateData = req.body;
	// Find the existing listing
	const existingListing = await Listing.findById(id);
	if (!existingListing) {
	  return res.status(404).json({
		success: false,
		message: 'Listing not found'
	  });
	}

	// --- Ensure new pricing structure ---
	if (updateData.pricing) {
	  const { type, amount, extratimeCost, securityFee } = updateData.pricing;
	  if (!type || amount === undefined) {
		return res.status(400).json({
		  success: false,
		  message: 'Pricing type and amount are required.'
		});
	  }
	  updateData.pricing = {
		type,
		amount,
		extratimeCost: extratimeCost !== undefined ? extratimeCost : 0,
		securityFee: securityFee !== undefined ? securityFee : 0
	  };
	}

	const updatedListing = await Listing.findByIdAndUpdate(
	  id,
	  updateData,
	  { new: true, runValidators: true }
	)
	  .populate('vendor', '_id businessName businessLocation businessDescription businessEmail businessPhone businessWebsite gallery userId')
	  .populate('category', 'name icon description')
	  .populate('subCategory', 'name icon description');

	res.json({
	  success: true,
	  message: 'Listing updated successfully',
	  data: updatedListing
	});
  } catch (error) {
	console.error('Error updating listing:', error);
	if (error.name === 'ValidationError') {
	  const errors = Object.values(error.errors).map(err => err.message);
	  return res.status(400).json({
		success: false,
		message: 'Validation error',
		errors
	  });
	}
	if (error.name === 'CastError') {
	  return res.status(400).json({
		success: false,
		message: 'Invalid listing ID'
	  });
	}
	res.status(500).json({
	  success: false,
	  message: 'Error updating listing',
	  error: error.message
	});
  }
};
// @desc    Delete a listing
// @route   DELETE /api/vendor/listings/:id
// @access  Private (Vendor only)
const deleteListing = async (req, res) => {
	try {
		const vendorId = req.vendor._id;
		const listingId = req.params.id;

		// Find the listing and ensure it belongs to the vendor
		const listing = await Listing.findOne({ _id: listingId, vendor: vendorId });
		if (!listing) {
			return res.status(404).json({ success: false, message: 'Listing not found or not authorized' });
		}

		await Listing.deleteOne({ _id: listingId });

		res.json({
			success: true,
			message: 'Listing deleted successfully'
		});
	} catch (err) {
		console.error('Delete listing error:', err);
		res.status(500).json({ success: false, message: 'Server error', error: err.message });
	}
};

module.exports = {
	toggleListingStatus,
	getVendorListingsOverview,
	createListing,
	updateListing,
	deleteListing
};