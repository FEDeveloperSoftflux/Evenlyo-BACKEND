const mongoose = require('mongoose');
const Booking = require('../../models/Booking');
const Listing = require('../../models/Listing');
const SaleItems = require('../../models/Item.js');
const User = require('../../models/User');
const Vendor = require('../../models/Vendor');
const Purchase = require('../../models/Purchase');

// Vendor Dashboard Analytics Controller
const getDashboardAnalytics = async (req, res) => {
  try {
    // Ensure user is authenticated
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Get vendor ID from session or find vendor by user ID
    let vendorId = req.user.vendorId;
    
    if (!vendorId) {
      // Fallback: find vendor by user ID
      const vendor = await Vendor.findOne({ userId: req.user.id });
      if (!vendor) {
        return res.status(404).json({
          success: false,
          message: 'Vendor profile not found'
        });
      }
      vendorId = vendor._id;
    }

    // Ensure vendorId is an ObjectId for aggregation match stages
    const vendorObjectId = typeof vendorId === 'string' && mongoose.Types.ObjectId.isValid(vendorId)
      ? new mongoose.Types.ObjectId(vendorId)
      : vendorId;

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
      }
    }

    // 7. Total unique clients who gave booking to this vendor
    const totalClientsAgg = await Booking.aggregate([
      { $match: { vendorId: vendorObjectId } },
      { $group: { _id: '$userId' } },
      { $count: 'total' }
    ]);
    const totalClients = totalClientsAgg.length > 0 ? totalClientsAgg[0].total : 0;

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
      { $match: { vendorId: vendorObjectId, status: 'completed', createdAt: { $gte: startOfYear } } },
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
      Number((monthlyRevenueByMonth.reduce((sum, val) => sum + val, 0) / 12).toFixed(3));

  // 3. Total Number of Items Listed (only 'active' listings, using Listing model)
  const totalItemsListed = await Listing.countDocuments({ vendor: vendorId, status: 'active', isActive: true });

    // New: Total Service Items (listings that are services)
    // We consider a listing a service when `serviceDetails.serviceType` exists (human/non_human)
    const totalServiceItems = await SaleItems.countDocuments({
      vendor: vendorId,
    });

    // 4. Recent Bookings (last 5)
    const recentBookings = await Booking.find({ vendorId })
      .sort({ createdAt: -1 })
      .limit(3)
      .populate('userId', 'firstName lastName address')
      .select('trackingId details eventLocation status createdAt userId');

    // 5. Order Overview by Month (just number of bookings per month)
    const orderOverviewAgg = await Booking.aggregate([
      { $match: { vendorId: vendorObjectId, createdAt: { $gte: startOfYear } } },
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

        // 6. Purchase Overview by Month (sale item purchases for this vendor)
    const purchaseAgg = await Purchase.aggregate([
      { $match: { vendor: vendorObjectId, purchasedAt: { $gte: startOfYear } } },
      { $group: { _id: { month: { $month: '$purchasedAt' } }, totalPurchases: { $sum: '$quantity' } } },
      { $sort: { '_id.month': 1 } }
    ]);

    const purchaseOverview = Array.from({ length: 12 }, (_, i) => {
      const found = purchaseAgg.find(m => m._id.month === i + 1);
      return { month: i + 1, totalPurchases: found ? found.totalPurchases : 0 };
    });

    // Recent Purchases (last 3)
    const recentPurchases = await Purchase.find({ vendor: vendorId })
      .sort({ purchasedAt: -1 })
      .limit(3)
      .populate('user', 'firstName lastName email')
      .select('trackingId itemName user userName quantity totalPrice status purchasedAt');

    res.json({
      success: true,
      stats: {
        completedBookingsCount,
        totalBookings,
        monthlyRevenue, // now average of all months
        totalItemsListed,
        totalServiceItems,
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
      purchaseOverview,
      recentPurchases: recentPurchases.map(p => ({
        trackingId: p.trackingId,
        itemName: p.itemName,
        buyerName: p.user ? `${p.user.firstName} ${p.user.lastName}` : p.userName || '',
        quantity: p.quantity,
        totalPrice: p.totalPrice,
        status: p.status,
        purchasedAt: p.purchasedAt
      })),
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
