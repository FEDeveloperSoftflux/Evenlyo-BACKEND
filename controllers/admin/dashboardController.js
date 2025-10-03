const User = require('../../models/User');
const Vendor = require('../../models/Vendor');
const Listing = require('../../models/Listing');
const Booking = require('../../models/Booking');

// --- Admin Dashboard Stats ---
const getDashboardStats = async (req, res) => {
  try {
    // Parallel queries for better performance
    const [
      totalClients,
      totalVendors,
      totalItems,
      totalBookings,
      monthlyBookingData,
      recentBookings,
      recentClients,
      recentVendors
    ] = await Promise.all([
      // Stats Cards
      User.countDocuments({ userType: 'client', isActive: true }),
      User.countDocuments({ userType: 'vendor', isActive: true }),
      Listing.countDocuments(),
      Booking.countDocuments(),
      
      // Monthly booking data (last 12 months)
      getMonthlyBookingData(),
      
      // Recent bookings (last 3)
      Booking.find()
        .populate('userId', 'firstName lastName address')
        .sort({ createdAt: -1 })
        .limit(3)
        .select('trackingId userId details.eventLocation status createdAt'),
      
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
      "Total Items": totalItems,
      "Total Booking": totalBookings
    };

    // Format recent bookings
    const formattedRecentBookings = await Promise.all(
      recentBookings.map(async (booking) => {
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
          createdAt: booking.createdAt
        };
      })
    );

    // Format recent clients with their last booking
    const formattedRecentClients = await Promise.all(
      recentClients.map(async (client) => {
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
      recentVendors.map(async (vendorUser) => {
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
        monthlyBookingData,
        recentBookings: formattedRecentBookings,
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

// Helper function to get monthly booking data for the last 12 months
const getMonthlyBookingData = async () => {
  try {
    const currentYear = new Date().getFullYear();
    const startDate = new Date(currentYear, 0, 1); // January 1st of current year
    const endDate = new Date(currentYear, 11, 31, 23, 59, 59); // December 31st of current year

    const result = await Booking.aggregate([
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

    // Create a map for quick lookup
    const bookingMap = {};
    result.forEach(item => {
      bookingMap[item._id.month] = item.count;
    });

    // Generate data for all 12 months with numeric month values
    const monthlyData = [];
    for (let month = 1; month <= 12; month++) {
      monthlyData.push({
        month: month,
        count: bookingMap[month] || 0
      });
    }

    return monthlyData;

  } catch (error) {
    console.error('Monthly booking data error:', error);
    // Return 12 months with zero data as fallback
    const fallbackData = [];
    for (let month = 1; month <= 12; month++) {
      fallbackData.push({
        month: month,
        count: 0
      });
    }
    return fallbackData;
  }
};

module.exports = {
  getDashboardStats
};
