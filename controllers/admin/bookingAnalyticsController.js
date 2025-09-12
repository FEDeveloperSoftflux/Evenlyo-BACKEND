const Booking = require('../../models/Booking');
const User = require('../../models/User');
const Vendor = require('../../models/Vendor');
const Listing = require('../../models/Listing');

// @desc    Get admin booking analytics
// @route   GET /api/admin/bookings/analytics
// @access  Private (Admin)
const getAdminBookingAnalytics = async (req, res) => {
  try {
    // Get stats card data
    const [
      totalBookings,
      completedBookings,
      requestBookings,
      inProcessBookings,
      allBookings
    ] = await Promise.all([
      // Total Bookings
      Booking.countDocuments(),
      
      // Complete Bookings (status: completed)
      Booking.countDocuments({ status: 'completed' }),
      
      // Request Bookings (status: pending)
      Booking.countDocuments({ status: 'pending' }),
      
      // In Process Bookings (status: paid, on_the_way, accepted, received, picked_up)
      Booking.countDocuments({ 
        status: { $in: ['paid', 'on_the_way', 'accepted', 'received', 'picked_up'] } 
      }),
      
      // All bookings with populated data
      Booking.find()
        .populate('userId', 'firstName lastName')
        .populate('vendorId', 'businessName')
        .populate('listingId', 'title')
        .populate('statusHistory.updatedBy.userId', 'firstName lastName')
        .sort({ createdAt: -1 })
        .select('trackingId details status userId vendorId listingId statusHistory createdAt')
    ]);

    // Format stats cards
    const statsCard = [
      {
        label: "Total Bookings",
        value: totalBookings
      },
      {
        label: "Complete Bookings",
        value: completedBookings
      },
      {
        label: "Request Bookings", 
        value: requestBookings
      },
      {
        label: "In Process",
        value: inProcessBookings
      }
    ];

    // Format bookings list
    const bookings = allBookings.map(booking => {
      // Get customer name
      let customerName = 'Unknown Customer';
      if (booking.userId) {
        customerName = `${booking.userId.firstName || ''} ${booking.userId.lastName || ''}`.trim();
      }

      // Get vendor name
      let vendorName = 'Unknown Vendor';
      if (booking.vendorId) {
        vendorName = booking.vendorId.businessName || 'Unknown Vendor';
      }

      // Get listing title
      let title = 'Unknown Service';
      if (booking.listingId && booking.listingId.title) {
        title = booking.listingId.title.en || booking.listingId.title || 'Unknown Service';
      }

      return {
        id: booking._id,
        date: booking.details?.startDate || booking.createdAt,
        status: booking.status,
        title: title,
        time: booking.details?.startTime || '',
        customer: customerName,
        description: booking.details?.specialRequests?.en || 
                    booking.details?.specialRequests || 
                    booking.details?.eventType?.en || 
                    booking.details?.eventType || '',
        Vendor: vendorName,
        location: booking.details?.eventLocation || '',
        trackingId: booking.trackingId,
        statusHistory: booking.statusHistory?.map(history => ({
          status: history.status,
          timestamp: history.timestamp,
          updatedBy: {
            name: history.updatedBy?.name || 
                  (history.updatedBy?.userId ? 
                    `${history.updatedBy.userId.firstName || ''} ${history.updatedBy.userId.lastName || ''}`.trim() : 
                    'System'),
            userType: history.updatedBy?.userType || 'system'
          },
          notes: history.notes?.en || history.notes?.nl || history.notes || ''
        })) || []
      };
    });

    res.json({
      success: true,
      data: {
        statsCard,
        bookings
      }
    });

  } catch (error) {
    console.error('Admin booking analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching booking analytics',
      error: error.message
    });
  }
};

// @desc    Get booking analytics with filters
// @route   GET /api/admin/bookings/analytics/filtered
// @access  Private (Admin)
const getFilteredBookingAnalytics = async (req, res) => {
  try {
    const { status, dateFrom, dateTo, vendorId, page = 1, limit = 10 } = req.query;
    
    // Build filter object
    let filter = {};
    
    if (status) {
      filter.status = status;
    }
    
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) {
        filter.createdAt.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        filter.createdAt.$lte = new Date(dateTo);
      }
    }
    
    if (vendorId) {
      filter.vendorId = vendorId;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Get filtered bookings and total count
    const [bookings, totalCount] = await Promise.all([
      Booking.find(filter)
        .populate('userId', 'firstName lastName')
        .populate('vendorId', 'businessName')
        .populate('listingId', 'title')
        .populate('statusHistory.updatedBy.userId', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('trackingId details status userId vendorId listingId statusHistory createdAt'),
      
      Booking.countDocuments(filter)
    ]);

    // Format bookings
    const formattedBookings = bookings.map(booking => {
      let customerName = 'Unknown Customer';
      if (booking.userId) {
        customerName = `${booking.userId.firstName || ''} ${booking.userId.lastName || ''}`.trim();
      }

      let vendorName = 'Unknown Vendor';
      if (booking.vendorId) {
        vendorName = booking.vendorId.businessName || 'Unknown Vendor';
      }

      let title = 'Unknown Service';
      if (booking.listingId && booking.listingId.title) {
        title = booking.listingId.title.en || booking.listingId.title || 'Unknown Service';
      }

      return {
        id: booking._id,
        date: booking.details?.startDate || booking.createdAt,
        status: booking.status,
        title: title,
        time: booking.details?.startTime || '',
        customer: customerName,
        description: booking.details?.specialRequests?.en || 
                    booking.details?.specialRequests || 
                    booking.details?.eventType?.en || 
                    booking.details?.eventType || '',
        Vendor: vendorName,
        location: booking.details?.eventLocation || '',
        trackingId: booking.trackingId,
        statusHistory: booking.statusHistory?.map(history => ({
          status: history.status,
          timestamp: history.timestamp,
          updatedBy: {
            name: history.updatedBy?.name || 
                  (history.updatedBy?.userId ? 
                    `${history.updatedBy.userId.firstName || ''} ${history.updatedBy.userId.lastName || ''}`.trim() : 
                    'System'),
            userType: history.updatedBy?.userType || 'system'
          },
          notes: history.notes?.en || history.notes?.nl || history.notes || ''
        })) || []
      };
    });

    res.json({
      success: true,
      data: {
        bookings: formattedBookings,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / limit),
          totalCount,
          hasNextPage: page * limit < totalCount,
          hasPrevPage: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Filtered booking analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching filtered booking analytics',
      error: error.message
    });
  }
};

// @desc    Get detailed booking with full status history
// @route   GET /api/admin/bookings/:id/details
// @access  Private (Admin)
const getBookingDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await Booking.findById(id)
      .populate('userId', 'firstName lastName email phone')
      .populate('vendorId', 'businessName email phone')
      .populate('listingId', 'title description price')
      .populate('statusHistory.updatedBy.userId', 'firstName lastName userType');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Format the detailed booking information
    const detailedBooking = {
      id: booking._id,
      trackingId: booking.trackingId,
      
      // Customer Information
      customer: {
        id: booking.userId?._id,
        name: booking.userId ? `${booking.userId.firstName || ''} ${booking.userId.lastName || ''}`.trim() : 'Unknown Customer',
        email: booking.userId?.email,
        phone: booking.userId?.phone
      },

      // Vendor Information
      vendor: {
        id: booking.vendorId?._id,
        businessName: booking.vendorId?.businessName || 'Unknown Vendor',
        email: booking.vendorId?.email,
        phone: booking.vendorId?.phone
      },

      // Service Information
      service: {
        id: booking.listingId?._id,
        title: booking.listingId?.title?.en || booking.listingId?.title || 'Unknown Service',
        description: booking.listingId?.description?.en || booking.listingId?.description
      },

      // Booking Details
      details: {
        startDate: booking.details?.startDate,
        endDate: booking.details?.endDate,
        startTime: booking.details?.startTime,
        endTime: booking.details?.endTime,
        eventLocation: booking.details?.eventLocation,
        eventType: booking.details?.eventType?.en || booking.details?.eventType,
        guestCount: booking.details?.guestCount,
        specialRequests: booking.details?.specialRequests?.en || booking.details?.specialRequests,
        contactPreference: booking.details?.contactPreference
      },

      // Pricing Information
      pricing: booking.pricing,

      // Current Status
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      paymentMethod: booking.paymentMethod,

      // Complete Status History
      statusHistory: booking.statusHistory?.map(history => ({
        status: history.status,
        timestamp: history.timestamp,
        updatedBy: {
          name: history.updatedBy?.name || 
                (history.updatedBy?.userId ? 
                  `${history.updatedBy.userId.firstName || ''} ${history.updatedBy.userId.lastName || ''}`.trim() : 
                  'System'),
          userType: history.updatedBy?.userType || 'system',
          userId: history.updatedBy?.userId?._id
        },
        notes: history.notes?.en || history.notes?.nl || history.notes || ''
      })) || [],

      // Timestamps
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,

      // Additional Information
      cancellationDetails: booking.cancellationDetails,
      rejectionReason: booking.rejectionReason?.en || booking.rejectionReason?.nl || booking.rejectionReason,
      claimDetails: booking.claimDetails
    };

    res.json({
      success: true,
      data: detailedBooking
    });

  } catch (error) {
    console.error('Get booking details error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching booking details',
      error: error.message
    });
  }
};

module.exports = {
  getAdminBookingAnalytics,
  getFilteredBookingAnalytics,
  getBookingDetails
};
