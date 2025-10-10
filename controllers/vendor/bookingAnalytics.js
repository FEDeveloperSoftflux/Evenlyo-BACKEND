const asyncHandler = require('express-async-handler');
const Booking = require('../../models/Booking');
const Vendor = require('../../models/Vendor');
const BookingRequest = require('../../models/Booking');
const notificationController = require('../notificationController');
const Listing = require('../../models/Listing');
const StockLog = require('../../models/StockLog');
const {getAvailabilityDetails , checkAvailability} = require('../../utils/bookingUtils')

// GET /api/vendor/bookings/analytics
const getVendorBookingAnalytics = async (req, res) => {
	try {
		const vendorId = req.vendor?._id || req.user?._id || req.user?.vendorId || req.user?.id;
		if (!vendorId) return res.status(400).json({ success: false, message: 'Vendor not found in request.' });

		// Booking status counts
		const [total, completed, requested, inProcess, bookings] = await Promise.all([
			Booking.countDocuments({ vendorId }),
			Booking.countDocuments({ vendorId, status: 'completed' }),
			Booking.countDocuments({ vendorId, status: 'pending' }),
			Booking.countDocuments({ vendorId, status: { $in: ['accepted', 'paid', 'on_the_way', 'received', 'picked_up'] } }),
			Booking.find({ vendorId })
				.sort({ createdAt: -1 })
				.populate('userId', 'firstName lastName email')
				.populate('listingId', 'title')
				.select('details status trackingId userId listingId description eventLocation createdAt statusHistory listingDetails')
		]);

		// Get unique listing IDs
		const listingIds = [...new Set(bookings.map(b => b.listingId).filter(id => id))];


		const bookingsList = bookings.map(b => ({
			id: b._id,
			startDate: b.details?.startDate,
			endDate: b.details?.endDate,
			startTime: b.details?.startTime,
			endTime: b.details?.endTime,
			status: b.status,
			title: b.listingDetails?.title|| '',
			customer: b.userId ? `${b.userId.firstName} ${b.userId.lastName}` : '',
			description: b.details?.specialRequests?.en || b.details?.specialRequests || '',
			ListingId: b.listingId?._id,
			location: b.details?.eventLocation || '',
			trackingId: b.trackingId,
			statusHistory: b.statusHistory,
			createdAt: b.createdAt
				}));

		res.json({
			success: true,
			stats: {
				totalBookings: total,
				completedBookings: completed,
				requestBookings: requested,
				inProcessBookings: inProcess
			},
			bookings: bookingsList
		});
	} catch (err) {
		console.error('Vendor booking analytics error:', err);
		res.status(500).json({ success: false, message: 'Server error', error: err.message });
	}
};
// @desc    Accept booking request
// @route   POST /api/booking/:id/accept
// @access  Private (Vendor)
const acceptBooking = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Get vendor profile
  const vendor = await Vendor.findOne({ userId: req.user.id });
  if (!vendor) {
	return res.status(404).json({
	  success: false,
	  message: 'Vendor profile not found'
	});
  }

  const booking = await BookingRequest.findOne({
	_id: id,
	vendorId: vendor._id,
	status: 'pending'
  });

  if (!booking) {
	return res.status(404).json({
	  success: false,
	  message: 'Booking request not found or already processed'
	});
  }

  // Double-check availability before accepting (exclude current booking from check)
  const availabilityResult = await getAvailabilityDetails(
	booking.listingId,
	booking.details.startDate,
	booking.details.endDate,
	booking._id // Exclude the current booking from conflict check
  );

  if (!availabilityResult.isAvailable) {
	console.log(`Booking acceptance failed for booking ${id}: conflicting bookings found for listing ${booking.listingId}`);
	return res.status(409).json({
	  success: false,
	  message: 'Booking is no longer available due to conflicting bookings',
	  details: 'Another booking has been accepted for overlapping dates. Please check the booking calendar and try a different time slot.',
	  conflictingBookings: availabilityResult.conflictingBookings
	});
  }

  console.log(`Accepting booking ${id} for vendor ${vendor._id}`);

	// Update stock: decrement listing quantity by 1 (or by guestCount if specified)
	const listing = await Listing.findById(booking.listingId);
	const decrementBy = booking.details?.guestCount || 1;

	if (!listing) {
		return res.status(404).json({ success: false, message: 'Associated listing not found' });
	}

	if (typeof listing.quantity !== 'number') listing.quantity = Number(listing.quantity) || 0;

	if (listing.quantity < decrementBy) {
		return res.status(400).json({ success: false, message: 'Not enough stock to accept this booking' });
	}

	listing.quantity -= decrementBy;

	// Save listing first, then update booking. If booking save fails we attempt to roll back the listing quantity.
	try {
		await listing.save();
	} catch (e) {
		console.error('Failed to update listing quantity while accepting booking', e);
		return res.status(500).json({ success: false, message: 'Failed to update stock' });
	}

	// Create stock log for checkout
	try {
		await StockLog.create({
			listing: listing._id,
			type: 'checkout',
			quantity: decrementBy,
			note: `Checked out for booking ${booking._id}`,
			createdBy: req.user?._id
		});
	} catch (e) {
		// Log failure but continue; stock quantity was already updated
		console.error('Failed to create stock log for booking accept', e);
	}

	booking.status = 'accepted';
	try {
		await booking.save();
	} catch (e) {
		// Rollback listing quantity
		try {
			listing.quantity += decrementBy;
			await listing.save();
		} catch (rbErr) {
			console.error('Failed to rollback listing quantity after booking save failure', rbErr);
		}
		console.error('Failed to save booking after stock update', e);
		return res.status(500).json({ success: false, message: 'Failed to accept booking' });
	}

  // Notify client (user) of acceptance
  try {
	await notificationController.createNotification({
	  user: booking.userId,
	  bookingId: booking._id,
	  message: `Your booking has been accepted.`
	});
  } catch (e) {
	console.error('Failed to create client notification for accepted booking:', e);
  }
  // Create notification for user
  await notificationController.createNotification({
	user: booking.userId,
	bookingId: booking._id,
	message: `Your booking has been accepted.`
  });

  await booking.populate([
	{ path: 'userId', select: 'firstName lastName email contactNumber' },
	{ path: 'listingId', select: 'title featuredImage pricing' }
  ]);

  res.json({
	success: true,
	message: 'Booking request accepted successfully',
	data: {
	  booking
	}
  });
});

// @desc    Reject booking request
// @route   POST /api/booking/:id/reject
// @access  Private (Vendor)
const rejectBooking = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rejectionReason } = req.body;

  // Get vendor profile
  const vendor = await Vendor.findOne({ userId: req.user.id });
  if (!vendor) {
	return res.status(404).json({
	  success: false,
	  message: 'Vendor profile not found'
	});
  }

  const booking = await BookingRequest.findOne({
	_id: id,
	vendorId: vendor._id,
	status: 'pending'
  });

  if (!booking) {
	return res.status(404).json({
	  success: false,
	  message: 'Booking request not found or already processed'
	});
  }


	booking.status = 'rejected';
	booking.rejectionReason = { en: rejectionReason || 'No reason provided' };
	await booking.save();

  // Notify client (user) of rejection
  try {
	await notificationController.createNotification({
	  user: booking.userId,
	  bookingId: booking._id,
	  message: `Your booking has been rejected.`
	});
  } catch (e) {
	console.error('Failed to create client notification for rejected booking:', e);
  }
  // Create notification for user
  await notificationController.createNotification({
	user: booking.userId,
	bookingId: booking._id,
	message: `Your booking has been rejected.`
  });

  await booking.populate([
	{ path: 'userId', select: 'firstName lastName email contactNumber' },
	{ path: 'listingId', select: 'title featuredImage pricing' }
  ]);

  res.json({
	success: true,
	message: 'Booking request rejected',
	data: {
	  booking
	}
  });
});
module.exports = {
	acceptBooking,
	rejectBooking,
	getVendorBookingAnalytics
};