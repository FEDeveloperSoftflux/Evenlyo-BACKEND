const mongoose = require('mongoose');
const Booking = require('../../models/Booking');
const Listing = require('../../models/Listing');
const Vendor = require('../../models/Vendor');

// GET /api/vendor/earnings/analytics
// Returns earning stats and monthly breakdown for a vendor
const getVendorEarningsAnalytics = async (req, res) => {
  try {

    let vendorId = req.vendor?._id || req.user?._id || req.user?.vendorId || req.user?.id;
    if (!vendorId) return res.status(400).json({ success: false, message: 'Vendor not found in request.' });
    // Convert to ObjectId if needed
    if (typeof vendorId === 'string' || (vendorId && vendorId.constructor && vendorId.constructor.name !== 'ObjectID' && vendorId.constructor.name !== 'ObjectId')) {
      try {
        vendorId = new mongoose.Types.ObjectId(vendorId);
      } catch (e) {
        return res.status(400).json({ success: false, message: 'Invalid vendorId.' });
      }
    }

    // Date helpers
    const today = new Date();
    today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const lastWeek = new Date(today); lastWeek.setDate(today.getDate() - 6);

    // Earnings stats
    const [todayEarnings, lastWeekEarnings, totalEarnings] = await Promise.all([
      Booking.aggregate([
        { $match: { vendorId: vendorId, status: 'completed', 'details.startDate': { $gte: today, $lt: tomorrow } } },
        { $group: { _id: null, total: { $sum: '$pricing.totalPrice' } } }
      ]),
      Booking.aggregate([
        { $match: { vendorId: vendorId, status: 'completed', 'details.startDate': { $gte: lastWeek, $lt: tomorrow } } },
        { $group: { _id: null, total: { $sum: '$pricing.totalPrice' } } }
      ]),
      Booking.aggregate([
        { $match: { vendorId: vendorId, status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$pricing.totalPrice' } } }
      ])
    ]);

    // Monthly earnings breakdown
    const monthlyEarningsAgg = await Booking.aggregate([
      { $match: { vendorId: vendorId, status: 'completed' } },
      { $group: {
        _id: { month: { $month: '$details.startDate' } },
        totalEarnings: { $sum: '$pricing.totalPrice' }
      } },
      { $sort: { '_id.month': 1 } }
    ]);
    // Format to desired payload: [{ month: 1, totalEarnings: 23 }, ...]
    const monthlyEarnings = monthlyEarningsAgg.map(m => ({
      month: m._id.month,
      totalEarnings: m.totalEarnings
    }));

    // Table: Tracking Id, Listing Name, Total Cost
    const bookings = await Booking.find({ vendorId, status: 'completed' })
      .populate('listingId', 'title')
      .select('trackingId listingId pricing.totalPrice');
    const bookingTable = bookings.map(b => ({
      trackingId: b.trackingId,
      listingName: b.listingId?.title?.en || b.listingId?.title || '',
      totalCost: b.pricing?.totalPrice || 0
    }));

    res.json({
      success: true,
      stats: {
        todayEarnings: todayEarnings[0]?.total || 0,
        lastWeekEarnings: lastWeekEarnings[0]?.total || 0,
        totalEarnings: totalEarnings[0]?.total || 0
      },
      monthlyEarnings,
      bookingTable
    });
  } catch (err) {
    console.error('Vendor earnings analytics error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

module.exports = { getVendorEarningsAnalytics };
