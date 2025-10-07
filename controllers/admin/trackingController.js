const Booking = require('../../models/Booking');
const Purchase = require('../../models/Purchase');
const User = require('../../models/User');
const Vendor = require('../../models/Vendor');
const Listing = require('../../models/Listing');
const Item = require('../../models/Item');

// Get all bookings with tracking information for admin
const getAllBookingsTracking = async (req, res) => {
  try {
    const { 
      status = '', 
      search = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    let filter = {};
    
    // Filter by status if provided
    if (status && status !== 'all') {
      filter.status = status;
    }

    // Search filter for tracking ID, buyer name, vendor name, or listing name
    let searchFilter = {};
    if (search) {
      searchFilter = {
        $or: [
          { trackingId: { $regex: search, $options: 'i' } }
        ]
      };
    }

    // Combine filters
    const finalFilter = { ...filter, ...searchFilter };

    // Sort configuration
    const sortConfig = {};
    sortConfig[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Get all bookings and purchases in parallel
    const [bookings, purchases] = await Promise.all([
        Booking.find(finalFilter)
        .populate({
          path: 'userId',
          select: 'firstName lastName profileImage email'
        })
        .populate({
          path: 'vendorId',
          populate: {
            path: 'userId',
            select: 'firstName lastName profileImage email'
          },
          select: 'businessName businessLogo userId'
        })
        .populate({
          path: 'listingId',
          select: 'title subtitle location'
        })
        .sort(sortConfig)
        .lean(),

      // Get all purchases with population
      Purchase.find(finalFilter)
        .populate({
          path: 'user',
          select: 'firstName lastName profileImage email'
        })
        .populate({
          path: 'vendor',
          populate: {
            path: 'userId',
            select: 'firstName lastName profileImage email'
          },
          select: 'businessName businessLogo userId'
        })
        .populate({
          path: 'item',
          select: 'title mainCategory subCategory'
        })
        .sort(sortConfig)
        .lean()
    ]);

    // Get total counts
    const totalBookings = bookings.length;
    const totalPurchases = purchases.length;

    // Format the booking tracking data
    const trackingData = bookings.map(booking => {
      // Buyer Info
      const buyerInfo = {
        name: booking.userId 
          ? `${booking.userId.firstName || ''} ${booking.userId.lastName || ''}`.trim() 
          : 'Unknown Buyer',
        profilePic: booking.userId?.profileImage || '',
        email: booking.userId?.email || ''
      };

      // Vendor Info
      let vendorInfo = {
        name: 'Unknown Vendor',
        profilePic: '',
        email: ''
      };

      if (booking.vendorId) {
        if (booking.vendorId.businessName) {
          // Business vendor
          vendorInfo = {
            name: booking.vendorId.businessName,
            profilePic: booking.vendorId.businessLogo || '',
            email: booking.vendorId.userId?.email || ''
          };
        } else if (booking.vendorId.userId) {
          // Personal vendor
          vendorInfo = {
            name: `${booking.vendorId.userId.firstName || ''} ${booking.vendorId.userId.lastName || ''}`.trim(),
            profilePic: booking.vendorId.userId.profileImage || '',
            email: booking.vendorId.userId.email || ''
          };
        }
      }

      return {
        trackingId: booking.trackingId,
        date: booking.createdAt,
        buyerInfo,
        vendorInfo,
        listingName: booking.listingId?.title || 'Unknown Listing',
        location: booking.details?.eventLocation || booking.listingId?.location?.fullAddress || 'Location not specified',
        status: booking.status,
        bookingId: booking._id,
        startDate: booking.details?.startDate,
        endDate: booking.details?.endDate,
        totalPrice: booking.pricing?.totalPrice,
        paymentStatus: booking.paymentStatus
      };
    });

    // Format the purchase history data
    const purchaseHistory = purchases.map(purchase => {
      // Buyer Info
      const buyerInfo = {
        name: purchase.user 
          ? `${purchase.user.firstName || ''} ${purchase.user.lastName || ''}`.trim() 
          : 'Unknown Buyer',
        profilePic: purchase.user?.profileImage || '',
        email: purchase.user?.email || ''
      };

      // Vendor Info
      let vendorInfo = {
        name: 'Unknown Vendor',
        profilePic: '',
        email: ''
      };

      if (purchase.vendor) {
        if (purchase.vendor.businessName) {
          // Business vendor
          vendorInfo = {
            name: purchase.vendor.businessName,
            profilePic: purchase.vendor.businessLogo || '',
            email: purchase.vendor.userId?.email || ''
          };
        } else if (purchase.vendor.userId) {
          // Personal vendor
          vendorInfo = {
            name: `${purchase.vendor.userId.firstName || ''} ${purchase.vendor.userId.lastName || ''}`.trim(),
            profilePic: purchase.vendor.userId.profileImage || '',
            email: purchase.vendor.userId.email || ''
          };
        }
      }

      return {
        trackingId: purchase.trackingId,
        date: purchase.createdAt,
        buyerInfo,
        vendorInfo,
        itemName: purchase.itemName || purchase.item?.title || 'Unknown Item',
        location: purchase.location || 'Location not specified',
        status: purchase.status,
        purchaseId: purchase._id,
        quantity: purchase.quantity,
        totalPrice: purchase.totalPrice,
        purchasedAt: purchase.purchasedAt,
        type: 'purchase'
      };
    });

    res.status(200).json({
      success: true,
      message: 'Booking and purchase tracking data retrieved successfully',
      data: {
        trackingData,
        purchaseHistory,
        totalBookings,
        totalPurchases,
        filters: {
          status: status || 'all',
          search,
          sortBy,
          sortOrder
        }
      }
    });

  } catch (error) {
    console.error('Error in getAllBookingsTracking:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve booking and purchase tracking data',
      error: error.message
    });
  }
};

// Get booking tracking details by tracking ID
const getBookingByTrackingId = async (req, res) => {
  try {
    const { trackingId } = req.params;

    const booking = await Booking.findOne({ trackingId })
      .populate({
        path: 'userId',
        select: 'firstName lastName profileImage email contactNumber address'
      })
      .populate({
        path: 'vendorId',
        populate: {
          path: 'userId',
          select: 'firstName lastName profileImage email contactNumber address'
        },
        select: 'businessName businessLogo businessEmail businessPhone businessAddress userId'
      })
      .populate({
        path: 'listingId',
        select: 'title subtitle description location pricing contact'
      })
      .lean();

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found with this tracking ID'
      });
    }

    // Format detailed tracking info
    const trackingDetails = {
      trackingId: booking.trackingId,
      bookingId: booking._id,
      date: booking.createdAt,
      
      // Buyer Details
      buyer: {
        name: booking.userId 
          ? `${booking.userId.firstName || ''} ${booking.userId.lastName || ''}`.trim() 
          : 'Unknown Buyer',
        profilePic: booking.userId?.profileImage || '',
        email: booking.userId?.email || '',
        phone: booking.userId?.contactNumber || '',
        address: booking.userId?.address || ''
      },

      // Vendor Details
      vendor: (() => {
        if (!booking.vendorId) {
          return {
            name: 'Unknown Vendor',
            profilePic: '',
            email: '',
            phone: '',
            address: ''
          };
        }

        if (booking.vendorId.businessName) {
          // Business vendor
          return {
            name: booking.vendorId.businessName,
            profilePic: booking.vendorId.businessLogo || '',
            email: booking.vendorId.businessEmail || booking.vendorId.userId?.email || '',
            phone: booking.vendorId.businessPhone || booking.vendorId.userId?.contactNumber || '',
            address: booking.vendorId.businessAddress || booking.vendorId.userId?.address || '',
            type: 'business'
          };
        } else if (booking.vendorId.userId) {
          // Personal vendor
          return {
            name: `${booking.vendorId.userId.firstName || ''} ${booking.vendorId.userId.lastName || ''}`.trim(),
            profilePic: booking.vendorId.userId.profileImage || '',
            email: booking.vendorId.userId.email || '',
            phone: booking.vendorId.userId.contactNumber || '',
            address: booking.vendorId.userId.address || '',
            type: 'personal'
          };
        }
      })(),

      // Listing Details
      listing: {
        name: booking.listingId?.title || '',
        subtitle: booking.listingId?.subtitle || '',
        description: booking.listingId?.description || '',
        location: booking.listingId?.location || '',
        pricing: booking.listingId?.pricing || ''
      },

      // Booking Details
      bookingDetails: {
        startDate: booking.details?.startDate,
        endDate: booking.details?.endDate,
        startTime: booking.details?.startTime,
        endTime: booking.details?.endTime,
        eventLocation: booking.details?.eventLocation,
        eventType: booking.details?.eventType,
        guestCount: booking.details?.guestCount,
        specialRequests: booking.details?.specialRequests,
        schedule: booking.details?.schedule || []
      },

      // Pricing
      pricing: {
        bookingPrice: booking.pricing?.bookingPrice,
        securityPrice: booking.pricing?.securityPrice,
        extraCharges: booking.pricing?.extraCharges,
        totalPrice: booking.pricing?.totalPrice
      },

      // Status Information
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      paymentMethod: booking.paymentMethod,
      
      // Status History
      statusHistory: booking.statusHistory || [],
      
      // Additional Details
      cancellationDetails: booking.cancellationDetails || '',
      claimDetails: booking.claimDetails || '',
      rejectionReason: booking.rejectionReason || '',
      
      updatedAt: booking.updatedAt
    };

    res.status(200).json({
      success: true,
      message: 'Booking tracking details retrieved successfully',
      data: trackingDetails
    });

  } catch (error) {
    console.error('Error in getBookingByTrackingId:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve booking details',
      error: error.message
    });
  }
};

// Get tracking statistics for admin dashboard
const getTrackingStats = async (req, res) => {
  try {
    const [
      totalBookings,
      pendingBookings,
      activeBookings,
      completedBookings,
      cancelledBookings,
      claimedBookings,
      statusDistribution
    ] = await Promise.all([
      Booking.countDocuments(),
      Booking.countDocuments({ status: 'pending' }),
      Booking.countDocuments({ status: { $in: ['accepted', 'paid', 'on_the_way', 'received', 'picked_up'] } }),
      Booking.countDocuments({ status: 'completed' }),
      Booking.countDocuments({ status: 'cancelled' }),
      Booking.countDocuments({ status: 'claim' }),
      
      // Status distribution
      Booking.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        },
        {
          $sort: { count: -1 }
        }
      ])
    ]);

    const stats = {
      totalBookings,
      pendingBookings,
      activeBookings,
      completedBookings,
      cancelledBookings,
      claimedBookings,
      statusDistribution: statusDistribution.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {})
    };

    res.status(200).json({
      success: true,
      message: 'Tracking statistics retrieved successfully',
      data: stats
    });

  } catch (error) {
    console.error('Error in getTrackingStats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve tracking statistics',
      error: error.message
    });
  }
};

// Update booking status (for admin actions)
const updateBookingStatus = async (req, res) => {
  try {
    const { trackingId } = req.params;
    const { status, adminNotes } = req.body;

    // Validate status
    const validStatuses = [
      'pending', 'accepted', 'rejected', 'paid', 
      'on_the_way', 'received', 'picked_up', 
      'completed', 'cancelled', 'claim'
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status provided'
      });
    }

    const booking = await Booking.findOne({ trackingId });
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found with this tracking ID'
      });
    }

    // Update status and add to history
    const previousStatus = booking.status;
    booking.status = status;
    
    // Add to status history
    booking.statusHistory.push({
      status: status,
      timestamp: new Date(),
      updatedBy: {
        userId: req.user._id,
        userType: 'admin',
        name: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || 'Admin'
      },
      notes: adminNotes ? { en: adminNotes } : undefined
    });

    await booking.save();

    res.status(200).json({
      success: true,
      message: `Booking status updated from ${previousStatus} to ${status}`,
      data: {
        trackingId: booking.trackingId,
        previousStatus,
        newStatus: status,
        updatedAt: new Date()
      }
    });

  } catch (error) {
    console.error('Error in updateBookingStatus:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update booking status',
      error: error.message
    });
  }
};

// Get status history for a specific booking
const getBookingStatusHistory = async (req, res) => {
  try {
    const { trackingId } = req.params;

    const booking = await Booking.findOne({ trackingId })
      .select('trackingId statusHistory status createdAt updatedAt')
      .populate({
        path: 'statusHistory.updatedBy.userId',
        select: 'firstName lastName profileImage'
      })
      .lean();

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found with this tracking ID'
      });
    }

    // Format status history with user details
    const formattedHistory = booking.statusHistory.map(history => ({
      status: history.status,
      timestamp: history.timestamp,
      updatedBy: {
        userId: history.updatedBy?.userId?._id || history.updatedBy?.userId,
        userType: history.updatedBy?.userType,
        name: history.updatedBy?.name || 
              (history.updatedBy?.userId ? 
                `${history.updatedBy.userId.firstName || ''} ${history.updatedBy.userId.lastName || ''}`.trim() : 
                'Unknown User'),
        profileImage: history.updatedBy?.userId?.profileImage || ''
      },
      notes: history.notes || ''
    }));

    res.status(200).json({
      success: true,
      message: 'Booking status history retrieved successfully',
      data: {
        trackingId: booking.trackingId,
        currentStatus: booking.status,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
        statusHistory: formattedHistory
      }
    });

  } catch (error) {
    console.error('Error in getBookingStatusHistory:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve booking status history',
      error: error.message
    });
  }
};

// Get status history for a specific booking by booking ID
const getBookingStatusHistoryById = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId)
      .select('trackingId statusHistory status createdAt updatedAt')
      .populate({
        path: 'statusHistory.updatedBy.userId',
        select: 'firstName lastName profileImage'
      })
      .lean();

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found with this booking ID'
      });
    }

    // Format status history with user details
    const formattedHistory = booking.statusHistory.map(history => ({
      status: history.status,
      timestamp: history.timestamp,
      updatedBy: {
        userId: history.updatedBy?.userId?._id || history.updatedBy?.userId,
        userType: history.updatedBy?.userType,
        name: history.updatedBy?.name || 
              (history.updatedBy?.userId ? 
                `${history.updatedBy.userId.firstName || ''} ${history.updatedBy.userId.lastName || ''}`.trim() : 
                'Unknown User'),
        profileImage: history.updatedBy?.userId?.profileImage || ''
      },
      notes: history.notes || ''
    }));

    res.status(200).json({
      success: true,
      message: 'Booking status history retrieved successfully',
      data: {
        bookingId: booking._id,
        trackingId: booking.trackingId,
        currentStatus: booking.status,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
        statusHistory: formattedHistory
      }
    });

  } catch (error) {
    console.error('Error in getBookingStatusHistoryById:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve booking status history',
      error: error.message
    });
  }
};

module.exports = {
  getAllBookingsTracking,
  getBookingByTrackingId,
  getTrackingStats,
  updateBookingStatus,
  getBookingStatusHistory,
  getBookingStatusHistoryById
};
