const User = require('../../models/User');
const Vendor = require('../../models/Vendor');
const Listing = require('../../models/Listing');
const Booking = require('../../models/Booking');
const Purchase = require('../../models/SaleItemPurchase');
const Item = require('../../models/Item');

// --- Admin Dashboard Stats ---
const getDashboardStats = async (req, res) => {
  try {
    // Parallel queries for better performance
    const [
      totalClients,
      totalVendors,
      totalListings,
      totalBookings,
      totalPurchases,
      totalItems,
      monthlyData,
      recentBookings,
      recentPurchases,
      recentClients,
      recentVendors
    ] = await Promise.all([
      // Stats Cards
      User.countDocuments({ userType: 'client', isActive: true }),
      User.countDocuments({ userType: 'vendor', isActive: true }),
      Listing.countDocuments(),
      Booking.countDocuments(),
      Purchase.countDocuments(),
      Item.countDocuments(),
      
      // Monthly booking and purchase data (last 12 months)
      getMonthlyData(),
      
      // Recent bookings (last 3)
      Booking.find()
        .populate('userId', 'firstName lastName address')
        .sort({ createdAt: -1 })
        .limit(3)
        .select('trackingId userId details.eventLocation status createdAt'),
      
      // Recent purchases (last 3)
      Purchase.find()
        .populate('user', 'firstName lastName')
        .sort({ createdAt: -1 })
        .limit(3)
        .select('trackingId user itemName location status createdAt totalPrice'),
      
      // Recent clients (last 3)
      User.find({ userType: 'client', isActive: true })
        .sort({ createdAt: -1 })
        .limit(3)
        .select('firstName lastName email'),
      
      // Recent vendors (last 3)
      User.find({ userType: 'vendor', isActive: true })
        .sort({ createdAt: -1 })
        .limit(3)
        .select('firstName lastName email')
    ]);

    // Format stats cards
    const statsCard = {
      "All Client": totalClients,
      "All Vendor": totalVendors,
      "Total Listings": totalListings,
      "Total Booking": totalBookings,
      "Total Purchases": totalPurchases,
      "Total Items": totalItems
    };

    // Format recent bookings
    const formattedRecentBookings = await Promise.all(
      (recentBookings || []).map(async (booking) => {
        let clientName = 'Unknown Client';
        let location = 'Unknown Location';
        
        if (booking.userId) {
          clientName = `${booking.userId.firstName || ''} ${booking.userId.lastName || ''}`.trim();
          location = booking.userId.address || booking.details?.eventLocation || 'Not specified';
        }

        return {
          trackingId: booking.trackingId,
          clientName,
          location,
          status: booking.status,
          createdAt: booking.createdAt,
          type: 'booking'
        };
      })
    );

    // Format recent purchases
    const formattedRecentPurchases = (recentPurchases || []).map((purchase) => {
      let clientName = 'Unknown Client';
      
      if (purchase.user) {
        clientName = `${purchase.user.firstName || ''} ${purchase.user.lastName || ''}`.trim();
      }

      return {
        trackingId: purchase.trackingId,
        clientName,
        itemName: purchase.itemName,
        location: purchase.location,
        status: purchase.status,
        totalPrice: purchase.totalPrice,
        createdAt: purchase.createdAt,
        type: 'purchase'
      };
    });

    // Format recent clients with their last booking
    const formattedRecentClients = await Promise.all(
      (recentClients || []).map(async (client) => {
        const lastBooking = await Booking.findOne({ userId: client._id })
          .sort({ createdAt: -1 })
          .select('createdAt');

        return {
          id: client._id,
          name: `${client.firstName || ''} ${client.lastName || ''}`.trim(),
          email: client.email,
          lastBooking: lastBooking ? lastBooking.createdAt : ''
        };
      })
    );

    // Format recent vendors with their last booking
    const formattedRecentVendors = await Promise.all(
      (recentVendors || []).map(async (vendorUser) => {
        // Find vendor profile to get vendorId
        const vendorProfile = await Vendor.findOne({ userId: vendorUser._id });
        let lastBooking = null;
        
        if (vendorProfile) {
          const booking = await Booking.findOne({ vendorId: vendorProfile._id })
            .sort({ createdAt: -1 })
            .select('createdAt');
          lastBooking = booking ? booking.createdAt : '';
        }

        return {
          id: vendorUser._id,
          name: `${vendorUser.firstName || ''} ${vendorUser.lastName || ''}`.trim(),
          email: vendorUser.email,
          lastBooking
        };
      })
    );

    // Return dashboard data
    res.json({
      success: true,
      data: {
        statsCard,
        monthlyBookingData: monthlyData.bookings,
        monthlyPurchaseData: monthlyData.purchases,
        recentBookings: formattedRecentBookings,
        recentPurchases: formattedRecentPurchases,
        recentClients: formattedRecentClients,
        recentVendors: formattedRecentVendors
      }
    });

  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard stats',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Helper function to get monthly booking and purchase data for the last 12 months
const getMonthlyData = async () => {
  try {
    const currentYear = new Date().getFullYear();
    const startDate = new Date(currentYear, 0, 1); // January 1st of current year
    const endDate = new Date(currentYear, 11, 31, 23, 59, 59); // December 31st of current year

    // Get booking data
    const bookingResult = await Booking.aggregate([
      {
        $match: {
          createdAt: {
            $gte: startDate,
            $lte: endDate
          }
        }
      },
      {
        $group: {
          _id: {
            month: { $month: "$createdAt" }
          },
          count: { $sum: 1 }
        }
      }
    ]);

    // Get purchase data
    const purchaseResult = await Purchase.aggregate([
      {
        $match: {
          createdAt: {
            $gte: startDate,
            $lte: endDate
          }
        }
      },
      {
        $group: {
          _id: {
            month: { $month: "$createdAt" }
          },
          count: { $sum: 1 }
        }
      }
    ]);

    // Create maps for quick lookup
    const bookingMap = {};
    const purchaseMap = {};
    
    bookingResult.forEach(item => {
      bookingMap[item._id.month] = item.count;
    });
    
    purchaseResult.forEach(item => {
      purchaseMap[item._id.month] = item.count;
    });

    // Generate data for all 12 months with numeric month values
    const monthlyBookingData = [];
    const monthlyPurchaseData = [];
    
    for (let month = 1; month <= 12; month++) {
      monthlyBookingData.push({
        month: month,
        count: bookingMap[month] || 0
      });
      
      monthlyPurchaseData.push({
        month: month,
        count: purchaseMap[month] || 0
      });
    }

    return {
      bookings: monthlyBookingData,
      purchases: monthlyPurchaseData
    };

  } catch (error) {
    console.error('Monthly data error:', error);
    // Return 12 months with zero data as fallback
    const fallbackBookingData = [];
    const fallbackPurchaseData = [];
    
    for (let month = 1; month <= 12; month++) {
      fallbackBookingData.push({
        month: month,
        count: 0
      });
      fallbackPurchaseData.push({
        month: month,
        count: 0
      });
    }
    
    return {
      bookings: fallbackBookingData,
      purchases: fallbackPurchaseData
    };
  }
};



module.exports = {
  getDashboardStats
};
