const asyncHandler = require('express-async-handler');
const Booking = require('../../models/Booking');
const BookingRequest = require('../../models/Booking');
const User = require('../../models/User');
const Listing = require('../../models/Listing');
const Vendor = require('../../models/Vendor');

// GET /api/vendor/tracking
const getVendorBookings = async (req, res) => {
	try {
		// Find the vendor profile for the logged-in user
		const vendor = await Vendor.findOne({ userId: req.user.id });
		if (!vendor) {
			return res.status(404).json({ bookings: [], message: 'Vendor profile not found' });
		}
		const bookings = await Booking.find({ vendorId: vendor._id })
			.populate({
				path: 'userId',
				select: 'firstName lastName profileImage address',
			})
			.populate({
				path: 'listingId',
				select: 'title',
			})
			.sort({ createdAt: -1 });

		const result = bookings.map(b => ({
			trackingId: b.trackingId,
			eventDate: b.details?.startDate,
			buyer: {
				name: b.userId?.firstName + ' ' + b.userId?.lastName,
				profileImage: b.userId?.profileImage,
			},
			listingName: b.listingId?.title?.en || b.listingId?.title,
			deliveryDate: b.details?.endDate,
			location: b.details?.eventLocation || b.userId?.address?.city,
			status: b.status,
			_id: b._id,
			statusHistory: b.statusHistory || [],
		}));
		res.json({ bookings: result });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
};

// @desc    Mark booking as on the way (Vendor action)
// @route   POST /api/booking/:id/mark-on-the-way
// @access  Private (Vendor)
const markBookingOnTheWay = asyncHandler(async (req, res) => {
	// const { driverInfo } = req.body; // driverInfo is not required for now

	// Get vendor profile
	const vendor = await Vendor.findOne({ userId: req.user.id });
	if (!vendor) {
		return res.status(404).json({
			success: false,
			message: 'Vendor profile not found'
		});
	}

	const booking = await BookingRequest.findOne({
		_id: req.params.id,
		vendorId: vendor._id,
		status: 'paid'
	});

	if (!booking) {
		return res.status(404).json({
			success: false,
			message: 'Booking not found or not eligible for this action'
		});
	}

	booking.status = 'on_the_way';
	// if (driverInfo) {
	//   booking.deliveryDetails.driverInfo = driverInfo;
	// }
	booking.deliveryDetails.pickupTime = new Date();

	await booking.save();

	// Notify client (user) that booking is on the way
	try {
		await notificationController.createNotification({
			user: booking.userId,
			booking: booking._id,
			message: `Your booking is on the way.`
		});
	} catch (e) {
		console.error('Failed to create client notification for on_the_way booking:', e);
	}
	res.json({
		success: true,
		message: 'Booking marked as on the way',
		data: { booking }
	});
});

// @desc    Mark booking as picked up (Vendor action)
// @route   POST /api/booking/:id/mark-picked-up
// @access  Private (Vendor)
const markBookingPickedUp = asyncHandler(async (req, res) => {
	const { condition, amount } = req.body;
	// condition: 'good', 'fair', 'claim'
	// amount: number (required for fair/claim)

	// Get vendor profile
	const vendor = await Vendor.findOne({ userId: req.user.id });
	if (!vendor) {
		return res.status(404).json({
			success: false,
			message: 'Vendor profile not found'
		});
	}

	const booking = await BookingRequest.findOne({
		_id: req.params.id,
		vendorId: vendor._id,
		status: 'completed'
	});

	if (!booking) {
		return res.status(404).json({
			success: false,
			message: 'Booking not found or not eligible for this action'
		});
	}

		booking.status = 'picked_up';
		booking.deliveryDetails.returnTime = new Date();

		// Store condition in the new field
		booking.condition = condition;

		if (condition === 'good') {
			// No further action needed
		} else if (condition === 'fair') {
			if (!amount || isNaN(amount) || amount <= 0) {
				return res.status(400).json({
					success: false,
					message: 'Amount to deduct from security fee is required for fair condition.'
				});
			}
			// Store deduction in claimDetails for admin review
			booking.claimDetails = {
				reason: {
					en: 'Fair condition - deduction from security fee',
					nl: 'Redelijke staat - aftrek van borg'
				},
				claimedBy: 'vendor',
				claimedAt: new Date(),
				status: 'pending',
				amount: amount
			};
		} else if (condition === 'claim') {
			if (!amount || isNaN(amount) || amount <= 0) {
				return res.status(400).json({
					success: false,
					message: 'Claim amount is required for claim condition.'
				});
			}
			booking.claimDetails = {
				reason: {
					en: 'Claim requested by vendor',
					nl: 'Claim aangevraagd door leverancier'
				},
				claimedBy: 'vendor',
				claimedAt: new Date(),
				status: 'pending',
				amount: amount
			};
			// Send request/notification to admin for claim approval
			try {
				await notificationController.createNotification({
					user: null, // or admin userId if available
					booking: booking._id,
					message: `Claim request submitted by vendor for booking. Amount: ${amount}`
				});
			} catch (e) {
				console.error('Failed to notify admin for claim request:', e);
			}
		} else {
			return res.status(400).json({
				success: false,
				message: 'Invalid condition. Must be one of: good, fair, claim.'
			});
		}

	await booking.save();

	// Notify vendor that booking is picked up
	try {
		const vendor = await Vendor.findById(booking.vendorId);
		if (vendor && vendor.userId) {
			await notificationController.createNotification({
				user: vendor.userId,
				booking: booking._id,
				message: `A booking has been marked as picked up.`
			});
		}
	} catch (e) {
		console.error('Failed to create vendor notification for picked up booking:', e);
	}

	res.json({
		success: true,
		message: 'Booking marked as picked up',
		data: { booking }
	});
});

// @desc    Mark booking as completed 
// @route   POST /api/booking/:id/mark-completed
// @access  Private (Vendor)
const markBookingCompleted = asyncHandler(async (req, res) => {
	// Get vendor profile
	const vendor = await Vendor.findOne({ userId: req.user.id });
	if (!vendor) {
		return res.status(404).json({
			success: false,
			message: 'Vendor profile not found'
		});
	}

	// Only allow if status is picked_up or claim
	const booking = await Booking.findOne({
		_id: req.params.id,
		vendorId: vendor._id,
		status: { $in: ['picked_up', 'claim'] }
	});

	if (!booking) {
		return res.status(404).json({
			success: false,
			message: 'Booking not found or not eligible for completion'
		});
	}

	booking.status = 'completed';
	booking.completedAt = new Date();
	await booking.save();

	// Notify client (user) that booking is completed
	try {
		await notificationController.createNotification({
			user: booking.userId,
			booking: booking._id,
			message: `Your booking has been marked as completed.`
		});
	} catch (e) {
		console.error('Failed to create client notification for completed booking:', e);
	}

	res.json({
		success: true,
		message: 'Booking marked as completed',
		data: { booking }
	});
});

module.exports = {
		getVendorBookings,
		markBookingOnTheWay,
		markBookingPickedUp,
		markBookingCompleted
};