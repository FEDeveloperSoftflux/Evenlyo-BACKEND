const mongoose = require('mongoose');
const Booking = require('../../models/Booking');
const Purchase = require('../../models/SaleItemPurchase');
const Listing = require('../../models/Listing');
const Item = require('../../models/Item');
const Category = require('../../models/Category');

// Helper to round numeric values to 3 decimal places (and ensure number type)
const round3 = (n) => Number(Number(n || 0).toFixed(3));

// GET /api/vendor/earnings/analytics
// Returns earning stats and monthly breakdown for a vendor
const getVendorEarningsAnalytics = async (req, res) => {
  try {

    let vendorId = req?.user?.id
    console.log(vendorId, " req.user req.user");

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
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const lastWeek = new Date(today); lastWeek.setDate(today.getDate() - 6);

    // Earnings stats
    const [todayEarnings, totalEarnings] = await Promise.all([
      Booking.aggregate([
        { $match: { vendorId: vendorId, status: 'completed', 'details.startDate': { $gte: today, $lt: tomorrow } } },
        { $group: { _id: null, total: { $sum: '$pricing.totalPrice' } } }
      ]),
      // Booking.aggregate([
      //   { $match: { vendorId: vendorId, status: 'completed', 'details.startDate': { $gte: lastWeek, $lt: tomorrow } } },
      //   { $group: { _id: null, total: { $sum: '$pricing.totalPrice' } } }
      // ]),
      Booking.aggregate([
        { $match: { vendorId: vendorId, status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$pricing.totalPrice' } } }
      ])
    ]);

    // Monthly earnings breakdown
    const monthlyEarningsAgg = await Booking.aggregate([
      { $match: { vendorId: vendorId, status: 'completed' } },
      {
        $group: {
          _id: { month: { $month: '$details.startDate' } },
          totalEarnings: { $sum: '$pricing.totalPrice' }
        }
      },
      { $sort: { '_id.month': 1 } }
    ]);

    // Create a map of month earnings for quick lookup
    const earningsMap = {};
    monthlyEarningsAgg.forEach(m => {
      earningsMap[m._id.month] = m.totalEarnings;
    });

    // Format to desired payload with all 12 months: [{ month: 1, totalEarnings: 23 }, ...]
    const monthlyEarnings = [];
    for (let month = 1; month <= 12; month++) {
      monthlyEarnings.push({
        month: month,
        totalEarnings: earningsMap[month] || 0
      });
    }

    // Earnings by Category - aggregate through listing relationships
    const earningsByCategoryAgg = await Booking.aggregate([
      {
        $match: {
          vendorId: vendorId,
          status: { $in: ["completed", "cancelled"] }
        }
      },

      // Join listing
      {
        $lookup: {
          from: "listings",
          localField: "listingId",
          foreignField: "_id",
          as: "listing"
        }
      },
      { $unwind: "$listing" },

      // Join category
      {
        $lookup: {
          from: "categories",
          localField: "listing.category",
          foreignField: "_id",
          as: "category"
        }
      },
      {
        $unwind: {
          path: "$category",
          preserveNullAndEmptyArrays: true
        }
      },

      // Calculate earnings per booking
      {
        $project: {
          categoryId: "$listing.category",
          categoryName: { $ifNull: ["$category.name.en", "Others"] },

          bookingEarning: {
            $add: [
              {
                $cond: [
                  { $eq: ["$status", "completed"] },
                  {
                    $subtract: [
                      { $ifNull: ["$pricingBreakdown.total", 0] },
                      {
                        $add: [
                          { $ifNull: ["$pricingBreakdown.platformFee", 0] },
                          { $ifNull: ["$pricingBreakdown.securityFee", 0] },
                          { $ifNull: ["$pricingBreakdown.evenlyoProtectFee", 0] }
                        ]
                      }
                    ]
                  },
                  0
                ]
              },
              {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$status", "cancelled"] },
                      { $eq: ["$paymentStatus", "upfront_paid"] }
                    ]
                  },
                  {
                    $multiply: [
                      { $ifNull: ["$pricingBreakdown.upfrontFee", 0] },
                      0.88
                    ]
                  },
                  0
                ]
              }
            ]
          }
        }
      },

      // Group by category
      {
        $group: {
          _id: "$categoryId",
          categoryName: { $first: "$categoryName" },
          totalEarnings: { $sum: "$bookingEarning" },
          totalBookings: { $sum: 1 }
        }
      },

      { $sort: { totalEarnings: -1 } }
    ]);

    // Format earnings by category
    const earningsByCategory = earningsByCategoryAgg.map(cat => ({
      categoryId: cat._id || 'unknown',
      categoryName: cat.categoryName || 'Others',
      totalEarnings: cat.totalEarnings,
      totalBookings: cat.totalBookings
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
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const monthlyRevenueAggAll = await Booking.aggregate([
      {
        $match: {
          vendorId: vendorId,
          createdAt: { $gte: startOfYear },
          status: { $in: ["completed", "cancelled"] }
        }
      },
      {
        $project: {
          month: { $month: "$createdAt" },

          completedRevenue: {
            $cond: [
              { $eq: ["$status", "completed"] },
              {
                $subtract: [
                  { $ifNull: ["$pricingBreakdown.total", 0] },
                  {
                    $add: [
                      { $ifNull: ["$pricingBreakdown.platformFee", 0] },
                      { $ifNull: ["$pricingBreakdown.securityFee", 0] },
                      { $ifNull: ["$pricingBreakdown.evenlyoProtectFee", 0] }
                    ]
                  }
                ]
              },
              0
            ]
          },

          refundRevenue: {
            $cond: [
              {
                $and: [
                  { $eq: ["$status", "cancelled"] },
                  { $eq: ["$paymentStatus", "upfront_paid"] }
                ]
              },
              {
                $multiply: [
                  { $ifNull: ["$pricingBreakdown.upfrontFee", 0] },
                  0.88
                ]
              },
              0
            ]
          }
        }
      },
      {
        $group: {
          _id: "$month",
          revenue: { $sum: { $add: ["$completedRevenue", "$refundRevenue"] } }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Array of 12 months, fill missing with 0
    console.log(monthlyRevenueAggAll, "monthlyRevenueAggAllmonthlyRevenueAggAll");

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const todaysEarningsAgg = await Booking.aggregate([
      {
        $match: {
          vendorId: vendorId,
          createdAt: { $gte: startOfToday },
          status: { $in: ["completed", "cancelled"] }
        }
      },
      {
        $project: {
          completedRevenue: {
            $cond: [
              { $eq: ["$status", "completed"] },
              {
                $subtract: [
                  { $ifNull: ["$pricingBreakdown.total", 0] },
                  {
                    $add: [
                      { $ifNull: ["$pricingBreakdown.platformFee", 0] },
                      { $ifNull: ["$pricingBreakdown.securityFee", 0] },
                      { $ifNull: ["$pricingBreakdown.evenlyoProtectFee", 0] }
                    ]
                  }
                ]
              },
              0
            ]
          },

          refundRevenue: {
            $cond: [
              {
                $and: [
                  { $eq: ["$status", "cancelled"] },
                  { $eq: ["$paymentStatus", "upfront_paid"] }
                ]
              },
              {
                $multiply: [
                  { $ifNull: ["$pricingBreakdown.upfrontFee", 0] },
                  0.88
                ]
              },
              0
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          revenue: { $sum: { $add: ["$completedRevenue", "$refundRevenue"] } }
        }
      }
    ]);

    const todaysEarnings = todaysEarningsAgg[0]?.revenue || 0;

    const startOfLastWeek = new Date();
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
    const lastWeekEarningsAgg = await Booking.aggregate([
      {
        $match: {
          vendorId: vendorId,
          createdAt: { $gte: startOfLastWeek },
          status: { $in: ["completed", "cancelled"] }
        }
      },
      {
        $project: {
          completedRevenue: {
            $cond: [
              { $eq: ["$status", "completed"] },
              {
                $subtract: [
                  { $ifNull: ["$pricingBreakdown.total", 0] },
                  {
                    $add: [
                      { $ifNull: ["$pricingBreakdown.platformFee", 0] },
                      { $ifNull: ["$pricingBreakdown.securityFee", 0] },
                      { $ifNull: ["$pricingBreakdown.evenlyoProtectFee", 0] }
                    ]
                  }
                ]
              },
              0
            ]
          },

          refundRevenue: {
            $cond: [
              {
                $and: [
                  { $eq: ["$status", "cancelled"] },
                  { $eq: ["$paymentStatus", "upfront_paid"] }
                ]
              },
              {
                $multiply: [
                  { $ifNull: ["$pricingBreakdown.upfrontFee", 0] },
                  0.88
                ]
              },
              0
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          revenue: { $sum: { $add: ["$completedRevenue", "$refundRevenue"] } }
        }
      }
    ]);

    const lastWeekEarnings = lastWeekEarningsAgg[0]?.revenue || 0;

    const monthlyEarningsAggs = await Booking.aggregate([
      {
        $match: {
          vendorId: vendorId,
          createdAt: { $gte: startOfYear },
          status: { $in: ["completed", "cancelled"] }
        }
      },
      {
        $project: {
          month: { $month: "$createdAt" },

          completedRevenue: {
            $cond: [
              { $eq: ["$status", "completed"] },
              {
                $subtract: [
                  { $ifNull: ["$pricingBreakdown.total", 0] },
                  {
                    $add: [
                      { $ifNull: ["$pricingBreakdown.platformFee", 0] },
                      { $ifNull: ["$pricingBreakdown.securityFee", 0] },
                      { $ifNull: ["$pricingBreakdown.evenlyoProtectFee", 0] }
                    ]
                  }
                ]
              },
              0
            ]
          },

          refundRevenue: {
            $cond: [
              {
                $and: [
                  { $eq: ["$status", "cancelled"] },
                  { $eq: ["$paymentStatus", "upfront_paid"] }
                ]
              },
              {
                $multiply: [
                  { $ifNull: ["$pricingBreakdown.upfrontFee", 0] },
                  0.88
                ]
              },
              0
            ]
          }
        }
      },
      {
        $group: {
          _id: "$month",
          totalEarnings: {
            $sum: { $add: ["$completedRevenue", "$refundRevenue"] }
          }
        }
      },
      {
        $project: {
          _id: 0,
          month: "$_id",
          totalEarnings: 1
        }
      },
      { $sort: { month: 1 } }
    ]);

    // ✅ ADD THIS PART RIGHT HERE (AFTER AGGREGATE)

    const monthlyEarningsss = Array.from({ length: 12 }, (_, index) => {
      const month = index + 1;

      const foundMonth = monthlyEarningsAggs.find(
        (item) => item.month === month
      );

      return {
        month,
        totalEarnings: foundMonth
          ? Number(foundMonth.totalEarnings.toFixed(2))
          : 0
      };
    });
    console.log(vendorId, "vendorIdvendorIdvendorId");

    const allBookings = await Booking.find({ vendorId })
    const allSale = await Purchase.aggregate([
      {
        $match: {
          vendorId: new mongoose.Types.ObjectId(vendorId)
        }
      },
      { $unwind: "$items" },

      // Convert itemId to ObjectId
      {
        $addFields: {
          itemIdObj: { $toObjectId: "$items.itemId" }
        }
      },

      // Lookup item data
      {
        $lookup: {
          from: "serviceitems",
          localField: "itemIdObj",
          foreignField: "_id",
          as: "itemData"
        }
      },
      { $unwind: "$itemData" },

      {
        $addFields: {
          itemProfit: {
            $multiply: [
              { $subtract: ["$itemData.sellingPrice", "$itemData.purchasePrice"] },
              "$items.quantity"
            ]
          }
        }
      },

      {
        $group: {
          _id: "$_id",
          trackingId: { $first: "$trackingId" },
          vendorId: { $first: "$vendorId" },
          customerId: { $first: "$customerId" },
          status: { $first: "$status" },
          totalAmount: { $first: "$totalAmount" },
          deliveryAmount: { $first: "$deliveryAmount" },
          platformFee: { $first: "$platformFee" },
          items: {
            $push: {
              itemId: "$items.itemId",
              itemName: "$itemData.title",
              quantity: "$items.quantity",
              purchasePrice: "$itemData.purchasePrice",
              sellingPrice: "$itemData.sellingPrice",
              profit: "$itemProfit"
            }
          },
          totalProfit: { $sum: "$itemProfit" },
          totalKms: { $first: "$totalKms" },
          createdAt: { $first: "$createdAt" },
          deliveryAmount: { $first: "$deliveryAmount" },
          platformFee: { $first: "$platformFee" },
          deliveryLocation: { $first: "$deliveryLocation" },
          itemLocation: { $first: "$itemLocation" },
        }
      }
    ]);
    res.json({
      success: true,
      stats: {
        todayEarnings: todaysEarnings,
        lastWeekEarnings: lastWeekEarnings,
        totalEarnings: monthlyRevenueAggAll[0]?.revenue ? monthlyRevenueAggAll[0]?.revenue : 0
      },
      monthlyEarnings: monthlyEarningsss,
      earningsByCategory,
      bookingTable: allBookings,
      allSale
    });
  } catch (err) {
    console.error('Vendor earnings analytics error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};



// GET /api/vendor/service-items/earnings/analytics
// Returns earning stats and detailed breakdown for service items
const getServiceItemEarningsAnalytics = async (req, res) => {
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
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const lastWeek = new Date(today); lastWeek.setDate(today.getDate() - 6);

    // Earnings stats for completed purchases
    const [todayEarnings, lastWeekEarnings, totalEarnings] = await Promise.all([
      Purchase.aggregate([
        { $match: { vendor: vendorId, createdAt: { $gte: today, $lt: tomorrow } } },
        { $group: { _id: null, total: { $sum: '$totalPrice' } } }
      ]),
      Purchase.aggregate([
        { $match: { vendor: vendorId, createdAt: { $gte: lastWeek, $lt: tomorrow } } },
        { $group: { _id: null, total: { $sum: '$totalPrice' } } }
      ]),
      Purchase.aggregate([
        { $match: { vendor: vendorId } },
        { $group: { _id: null, total: { $sum: '$totalPrice' } } }
      ])
    ]);

    // Monthly earnings breakdown
    const monthlyEarningsAgg = await Purchase.aggregate([
      { $match: { vendor: vendorId } },
      {
        $group: {
          _id: { month: { $month: '$createdAt' } },
          totalEarnings: { $sum: '$totalPrice' }
        }
      },
      { $sort: { '_id.month': 1 } }
    ]);

    // Create a map of month earnings for quick lookup
    const earningsMap = {};
    monthlyEarningsAgg.forEach(m => {
      earningsMap[m._id.month] = m.totalEarnings;
    });

    // Format monthly earnings with all 12 months: [{ month: 1, totalEarnings: 23 }, ...]
    const monthlyEarnings = [];
    for (let month = 1; month <= 12; month++) {
      monthlyEarnings.push({
        month: month,
        totalEarnings: earningsMap[month] || 0
      });
    }

    // Earnings by Category - aggregate through item relationships
    const earningsByCategoryAgg = await Purchase.aggregate([
      { $match: { vendor: vendorId, } },
      {
        $lookup: {
          from: 'serviceitems', // Collection name for Item model
          localField: 'item',
          foreignField: '_id',
          as: 'itemDetails'
        }
      },
      { $unwind: '$itemDetails' },
      {
        $lookup: {
          from: 'categories',
          localField: 'itemDetails.mainCategory',
          foreignField: '_id',
          as: 'categoryDetails'
        }
      },
      { $unwind: { path: '$categoryDetails', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$itemDetails.mainCategory',
          categoryName: { $first: { $ifNull: ['$categoryDetails.name.en', 'Others'] } },
          totalEarnings: { $sum: '$totalPrice' },
          totalPurchases: { $sum: 1 }
        }
      },
      { $sort: { totalEarnings: -1 } }
    ]);

    // Format earnings by category
    const earningsByCategory = earningsByCategoryAgg.map(cat => ({
      categoryId: cat._id,
      categoryName: cat.categoryName || 'Others',
      totalEarnings: cat.totalEarnings,
      totalPurchases: cat.totalPurchases
    }));

    // Tracking Table: Tracking Id, Item Name, Customer Name, Total Cost, Status
    const purchases = await Purchase.find({ vendor: vendorId })
      .populate('item', 'title')
      .populate('user', 'firstName lastName')
      .select('trackingId item user totalPrice purchasedAt itemName userName')
      .sort({ purchasedAt: -1 });

    const trackingTable = purchases.map(p => ({
      trackingId: p.trackingId,
      itemName: p.item?.title?.en || p.itemName || '',
      customerName: p.user ? `${p.user.firstName} ${p.user.lastName}` : p.userName || '',
      totalCost: p.totalPrice || 0,
      purchaseDate: p.purchasedAt
    }));

    res.json({
      success: true,
      stats: {
        todayEarnings: round3(todayEarnings[0]?.total || 0),
        lastWeekEarnings: round3(lastWeekEarnings[0]?.total || 0),
        totalEarnings: round3(totalEarnings[0]?.total || 0)
      },
      monthlyEarnings,
      earningsByCategory,
      trackingTable
    });
  } catch (err) {
    console.error('Service item earnings analytics error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

module.exports = {
  getVendorEarningsAnalytics,
  getServiceItemEarningsAnalytics
};
