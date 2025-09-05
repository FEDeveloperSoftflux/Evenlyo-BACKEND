const Booking = require('../../models/Booking');
const Listing = require('../../models/Listing');
const User = require('../../models/User');

// Vendor Dashboard Analytics Controller
const getDashboardAnalytics = async (req, res) => {
  try {
    const vendorId = req.vendor._id;

    // 6. Recent Clients (last 5 unique clients who booked with vendor)
    const recentClientBookings = await Booking.find({ vendorId })
      .sort({ createdAt: -1 })
      .populate('userId', 'firstName lastName email profileImage')
      .select('userId createdAt');
    const seenClientIds = new Set();
    const recentClients = [];
    for (const booking of recentClientBookings) {
      if (booking.userId && !seenClientIds.has(booking.userId._id.toString())) {
        seenClientIds.add(booking.userId._id.toString());
        recentClients.push({
          id: booking.userId._id,
          name: `${booking.userId.firstName} ${booking.userId.lastName}`,
          email: booking.userId.email,
          profileImage: booking.userId.profileImage,
          lastBooking: booking.createdAt
        });
        if (recentClients.length >= 4) break;
      }
    }

    // 7. Total unique clients who gave booking to this vendor
    const totalClientsAgg = await Booking.aggregate([
      { $match: { vendorId } },
      { $group: { _id: '$userId' } },
      { $count: 'total' }
    ]);
    const totalClients = totalClientsAgg.length > 0 ? totalClientsAgg[0].total : 0;
    const Vendor = require('../../models/Vendor');

    // Use Vendor model stats if available
    const vendorDoc = await Vendor.findById(vendorId);
    const completedBookingsCount = vendorDoc?.completedBookings ?? 0;
    const totalBookings = vendorDoc?.totalBookings ?? 0;

    // 2. Monthly Revenue (current month and all months for average)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    // All months in current year
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const monthlyRevenueAggAll = await Booking.aggregate([
      { $match: { vendorId, status: 'completed', createdAt: { $gte: startOfYear } } },
      { $group: {
        _id: { month: { $month: '$createdAt' } },
        revenue: { $sum: '$pricing.totalPrice' }
      } },
      { $sort: { '_id.month': 1 } }
    ]);
    // Array of 12 months, fill missing with 0
    const monthlyRevenueByMonth = Array.from({ length: 12 }, (_, i) => {
      const found = monthlyRevenueAggAll.find(m => m._id.month === i + 1);
      return found ? found.revenue : 0;
    });
    // Average monthly revenue (across all months)
    const monthlyRevenue =
      monthlyRevenueByMonth.reduce((sum, val) => sum + val, 0) / 12;

  // 3. Total Number of Items Listed (only 'active' listings, using Listing model)
  const totalItemsListed = await Listing.countDocuments({ vendor: vendorId, status: 'active', isActive: true });

    // 4. Recent Bookings (last 5)
    const recentBookings = await Booking.find({ vendorId })
      .sort({ createdAt: -1 })
      .limit(3)
      .populate('userId', 'firstName lastName address')
      .select('trackingId details eventLocation status createdAt userId');

    // 5. Order Overview by Month (just number of bookings per month)
    const orderOverviewAgg = await Booking.aggregate([
      { $match: { vendorId, createdAt: { $gte: startOfYear } } },
      { $group: {
        _id: { month: { $month: '$createdAt' } },
        totalOrders: { $sum: 1 }
      } },
      { $sort: { '_id.month': 1 } }
    ]);
    // Fill missing months with 0 orders
    const orderOverview = Array.from({ length: 12 }, (_, i) => {
      const found = orderOverviewAgg.find(m => m._id.month === i + 1);
      return { month: i + 1, totalOrders: found ? found.totalOrders : 0 };
    });

    res.json({
      success: true,
      stats: {
        completedBookingsCount,
        totalBookings,
        monthlyRevenue, // now average of all months
        totalItemsListed,
        totalClients
      },
      recentBookings: recentBookings.map(b => ({
        trackingId: b.trackingId,
        clientName: b.userId ? `${b.userId.firstName} ${b.userId.lastName}` : '',
        location: b.details?.eventLocation || '',
        status: b.status,
        createdAt: b.createdAt
      })),
  orderOverview,
  recentClients
    });
  } catch (err) {
    console.error('Dashboard analytics error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

module.exports = {
  getDashboardAnalytics
};
