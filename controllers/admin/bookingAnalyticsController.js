const Booking = require('../../models/Booking');
const Purchase = require('../../models/SaleItemPurchase');
const User = require('../../models/User');
const Vendor = require('../../models/Vendor');
const Listing = require('../../models/Listing');
const Item = require('../../models/Item');

// @desc    Get admin booking analytics
// @route   GET /api/admin/bookings/analytics
// @access  Private (Admin)
const getAdminBookingAnalytics = async (req, res) => {
  try {
    // Get stats card data for both bookings and purchases
    const [
      totalBookings,
      completedBookings,
      requestBookings,
      inProcessBookings,
      allBookings,
      totalPurchases,
      completedPurchases,
      onTheWayPurchases,
      allPurchases
    ] = await Promise.all([
      // Booking Stats
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
        .select('trackingId details status userId vendorId listingId statusHistory createdAt'),

      // Purchase Stats
      // Total Purchases
      Purchase.countDocuments(),
      
      // Complete Purchases (status: complete)
      Purchase.countDocuments({ status: 'complete' }),
      
      // On The Way Purchases (status: on the way)
      Purchase.countDocuments({ status: 'on the way' }),
      
      // All purchases with populated data
      Purchase.find()
        .populate('user', 'firstName lastName')
        .populate('vendor', 'businessName')
        .populate('item', 'title')
        .sort({ createdAt: -1 })
        .select('trackingId itemName userName vendorName quantity location totalPrice status user vendor item purchasedAt createdAt')
    ]);

    // Format stats cards for bookings
    const bookingStatsCard = [
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

    // Format stats cards for purchases
    const purchaseStatsCard = [
      {
        label: "Total Purchases",
        value: totalPurchases
      },
      {
        label: "Complete Purchases",
        value: completedPurchases
      },
      {
        label: "On The Way",
        value: onTheWayPurchases
      },
      {
        label: "Total Revenue",
        value: allPurchases.reduce((sum, purchase) => sum + (purchase.totalPrice || 0), 0)
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

    // Format purchases list
    const purchases = allPurchases.map(purchase => {
      // Get customer name
      let customerName = 'Unknown Customer';
      if (purchase.user) {
        customerName = `${purchase.user.firstName || ''} ${purchase.user.lastName || ''}`.trim();
      } else if (purchase.userName) {
        customerName = purchase.userName;
      }

      // Get vendor name
      let vendorName = 'Unknown Vendor';
      if (purchase.vendor) {
        vendorName = purchase.vendor.businessName || 'Unknown Vendor';
      } else if (purchase.vendorName) {
        vendorName = purchase.vendorName;
      }

      // Get item title
      let title = 'Unknown Item';
      if (purchase.item && purchase.item.title) {
        title = purchase.item.title.en || purchase.item.title || 'Unknown Item';
      } else if (purchase.itemName) {
        title = purchase.itemName;
      }

      return {
        id: purchase._id,
        date: purchase.purchasedAt || purchase.createdAt,
        status: purchase.status,
        title: title,
        quantity: purchase.quantity,
        customer: customerName,
        description: `Quantity: ${purchase.quantity} | Price: $${purchase.totalPrice}`,
        Vendor: vendorName,
        location: purchase.location || '',
        trackingId: purchase.trackingId,
        totalPrice: purchase.totalPrice,
        type: 'purchase' // To distinguish from bookings
      };
    });

    res.json({
      success: true,
      data: {
        bookingStats: bookingStatsCard,
        purchaseStats: purchaseStatsCard,
        bookings,
        purchases
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
    const { status, dateFrom, dateTo, vendorId, type = 'both', page = 1, limit = 10 } = req.query;
    
    // Build filter objects for bookings and purchases
    let bookingFilter = {};
    let purchaseFilter = {};
    
    // Apply status filter
    if (status) {
      bookingFilter.status = status;
      purchaseFilter.status = status;
    }
    
    // Apply date filter
    if (dateFrom || dateTo) {
      const dateFilter = {};
      if (dateFrom) {
        dateFilter.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        dateFilter.$lte = new Date(dateTo);
      }
      bookingFilter.createdAt = dateFilter;
      purchaseFilter.createdAt = dateFilter;
    }
    
    // Apply vendor filter
    if (vendorId) {
      bookingFilter.vendorId = vendorId;
      purchaseFilter.vendor = vendorId;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;
    
    let bookings = [];
    let purchases = [];
    let totalCount = 0;

    // Fetch data based on type filter
    if (type === 'bookings' || type === 'both') {
      const [bookingData, bookingCount] = await Promise.all([
        Booking.find(bookingFilter)
          .populate('userId', 'firstName lastName')
          .populate('vendorId', 'businessName')
          .populate('listingId', 'title')
          .populate('statusHistory.updatedBy.userId', 'firstName lastName')
          .sort({ createdAt: -1 })
          .skip(type === 'bookings' ? skip : 0)
          .limit(type === 'bookings' ? parseInt(limit) : parseInt(limit / 2))
          .select('trackingId details status userId vendorId listingId statusHistory createdAt'),
        
        Booking.countDocuments(bookingFilter)
      ]);
      
      bookings = bookingData;
      totalCount += bookingCount;
    }

    if (type === 'purchases' || type === 'both') {
      const [purchaseData, purchaseCount] = await Promise.all([
        Purchase.find(purchaseFilter)
          .populate('user', 'firstName lastName')
          .populate('vendor', 'businessName')
          .populate('item', 'title')
          .sort({ createdAt: -1 })
          .skip(type === 'purchases' ? skip : 0)
          .limit(type === 'purchases' ? parseInt(limit) : parseInt(limit / 2))
          .select('trackingId itemName userName vendorName quantity location totalPrice status user vendor item purchasedAt createdAt'),
        
        Purchase.countDocuments(purchaseFilter)
      ]);
      
      purchases = purchaseData;
      totalCount += purchaseCount;
    }

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
        type: 'booking',
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

    // Format purchases
    const formattedPurchases = purchases.map(purchase => {
      let customerName = 'Unknown Customer';
      if (purchase.user) {
        customerName = `${purchase.user.firstName || ''} ${purchase.user.lastName || ''}`.trim();
      } else if (purchase.userName) {
        customerName = purchase.userName;
      }

      let vendorName = 'Unknown Vendor';
      if (purchase.vendor) {
        vendorName = purchase.vendor.businessName || 'Unknown Vendor';
      } else if (purchase.vendorName) {
        vendorName = purchase.vendorName;
      }

      let title = 'Unknown Item';
      if (purchase.item && purchase.item.title) {
        title = purchase.item.title.en || purchase.item.title || 'Unknown Item';
      } else if (purchase.itemName) {
        title = purchase.itemName;
      }

      return {
        id: purchase._id,
        date: purchase.purchasedAt || purchase.createdAt,
        status: purchase.status,
        title: title,
        quantity: purchase.quantity,
        customer: customerName,
        description: `Quantity: ${purchase.quantity} | Price: $${purchase.totalPrice}`,
        Vendor: vendorName,
        location: purchase.location || '',
        trackingId: purchase.trackingId,
        totalPrice: purchase.totalPrice,
        type: 'purchase'
      };
    });

    // Combine and sort all data by date if showing both
    let combinedData = [];
    if (type === 'both') {
      combinedData = [...formattedBookings, ...formattedPurchases]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(skip, skip + parseInt(limit));
    } else if (type === 'bookings') {
      combinedData = formattedBookings;
    } else if (type === 'purchases') {
      combinedData = formattedPurchases;
    }

    res.json({
      success: true,
      data: {
        bookings: type === 'bookings' || type === 'both' ? formattedBookings : [],
        purchases: type === 'purchases' || type === 'both' ? formattedPurchases : [],
        combinedData: type === 'both' ? combinedData : [],
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

// @desc    Get detailed purchase information
// @route   GET /api/admin/purchases/:id/details
// @access  Private (Admin)
const getPurchaseDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const purchase = await Purchase.findById(id)
      .populate('user', 'firstName lastName email phone')
      .populate('vendor', 'businessName email phone')
      .populate('item', 'title purchasePrice sellingPrice stockQuantity image');

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: 'Purchase not found'
      });
    }

    // Format the detailed purchase information
    const detailedPurchase = {
      id: purchase._id,
      trackingId: purchase.trackingId,
      
      // Customer Information
      customer: {
        id: purchase.user?._id,
        name: purchase.user ? `${purchase.user.firstName || ''} ${purchase.user.lastName || ''}`.trim() : purchase.userName || 'Unknown Customer',
        email: purchase.user?.email,
        phone: purchase.user?.phone
      },

      // Vendor Information
      vendor: {
        id: purchase.vendor?._id,
        businessName: purchase.vendor?.businessName || purchase.vendorName || 'Unknown Vendor',
        email: purchase.vendor?.email,
        phone: purchase.vendor?.phone
      },

      // Item Information
      item: {
        id: purchase.item?._id,
        title: purchase.item?.title?.en || purchase.item?.title || purchase.itemName || 'Unknown Item',
        purchasePrice: purchase.item?.purchasePrice,
        sellingPrice: purchase.item?.sellingPrice,
        stockQuantity: purchase.item?.stockQuantity,
        image: purchase.item?.image
      },

      // Purchase Details
      quantity: purchase.quantity,
      location: purchase.location,
      totalPrice: purchase.totalPrice,
      status: purchase.status,

      // Timestamps
      purchasedAt: purchase.purchasedAt,
      createdAt: purchase.createdAt,
      updatedAt: purchase.updatedAt
    };

    res.json({
      success: true,
      data: detailedPurchase
    });

  } catch (error) {
    console.error('Get purchase details error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching purchase details',
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
  getBookingDetails,
  getPurchaseDetails
};
