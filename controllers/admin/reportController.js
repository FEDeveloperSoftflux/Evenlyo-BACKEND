const Booking = require('../../models/Booking');
const Item = require('../../models/Item');
const Plan = require('../../models/Plan');

// GET /admin/report/stats-card
exports.getStatsCard = async (req, res) => {
        // Booking table view for completed bookings with payment details
        const bookingTableAgg = await Booking.aggregate([
            {
                $lookup: {
                    from: 'listings',
                    localField: 'listingId',
                    foreignField: '_id',
                    as: 'listing'
                }
            },
            { $unwind: '$listing' },
            {
                $lookup: {
                    from: 'paymentintents',
                    localField: '_id',
                    foreignField: 'booking',
                    as: 'paymentIntent'
                }
            },
            {
                $unwind: { path: '$paymentIntent', preserveNullAndEmptyArrays: true }
            },
            {
                $project: {
                    trackingId: 1,
                    date: '$createdAt',
                    listingTitle: '$listing.title',
                    platformFee: {
                        $ifNull: ['$platformFee', '$pricing.platformFee']
                    },
                    totalPrice: '$pricing.totalPrice',
                    paymentDate: '$paymentIntent.createdAt',
                    paymentPurpose: '$paymentIntent.paymentPurpose',
                    paymentMethod: '$paymentIntent.paymentMethod',
                    paymentAmount: '$paymentIntent.amount',
                    paymentCurrency: '$paymentIntent.currency',
                    paymentStatus: '$paymentIntent.status'
                }
            }
        ]);

        const bookingTable = bookingTableAgg.map(b => ({
            trackingId: b.trackingId,
            date: b.date,
            listingTitle: b.listingTitle,
            earning: b.platformFee,
            totalPrice: b.totalPrice,
                date: b.paymentDate,
                purpose: b.paymentPurpose,
                method: b.paymentMethod,
                amount: b.paymentAmount,
                currency: b.paymentCurrency,
                status: b.paymentStatus
        }));
        // Category-wise earning calculation
        const categorywiseAgg = await Booking.aggregate([
            { $match: { status: 'pending' } },
            {
                $lookup: {
                    from: 'listings',
                    localField: 'listingId',
                    foreignField: '_id',
                    as: 'listing'
                }
            },
            { $unwind: '$listing' },
            {
                $lookup: {
                    from: 'categories',
                    localField: 'listing.category',
                    foreignField: '_id',
                    as: 'categoryObj'
                }
            },
            { $unwind: { path: '$categoryObj', preserveNullAndEmptyArrays: true } },
            {
                $group: {
                    _id: '$categoryObj.name',
                    earning: { $sum: '$platformFee' }
                }
            }
        ]);

        const categorywiseEarning = categorywiseAgg.map(c => ({
            category: c._id || 'Unknown',
            earning: c.earning || 0
        }));
    try {
        // Booking Earning: Sum of platformFee from completed bookings
        const bookingEarningAgg = await Booking.aggregate([
            { $match: { status: { $in: ['pending', 'claim'] } } },
            { $group: { _id: null, total: { $sum: '$platformFee' } } }
        ]);
        const bookingEarning = bookingEarningAgg[0]?.total || 0;

        // Sale Item Earning: Sum of item platform fees from completed bookings
        const saleItemEarningAgg = await Booking.aggregate([
            { $match: { status: 'completed' } },
            { $group: { _id: null, total: { $sum: '$itemPlatformFee' } } }
        ]);
        const saleItemEarning = saleItemEarningAgg[0]?.total || 0;

        // NEED IMPLEMENTATION
        const planEarningAgg = await Plan.aggregate([
            { $group: { _id: null, total: { $sum: '$platformFee' } } }
        ]);
        const planEarning = planEarningAgg[0]?.total || 0;

        const totalRevenue = bookingEarning + saleItemEarning + planEarning;

        // Monthly revenue calculation for current year
        const currentYear = new Date().getFullYear();
        const monthlyRevenueAgg = await Booking.aggregate([
            {
                $match: {
                    status: 'pending',
                    createdAt: {
                        $gte: new Date(`${currentYear}-01-01T00:00:00.000Z`),
                        $lt: new Date(`${currentYear + 1}-01-01T00:00:00.000Z`)
                    }
                }
            },
            {
                $group: {
                    _id: { month: { $month: "$createdAt" } },
                    revenue: { $sum: "$platformFee" }
                }
            },
            {
                $sort: { "_id.month": 1 }
            }
        ]);

        // Format monthly revenue for all 12 months
        const monthlyRevenue = Array.from({ length: 12 }, (_, i) => {
            const found = monthlyRevenueAgg.find(m => m._id.month === i + 1);
            return {
                month: i + 1,
                revenue: found ? found.revenue : 0
            };
        });

        res.json({
            statsCard: {
                bookingEarning,
                saleItemEarning,
                planEarning,
                totalRevenue
            },
            monthlyRevenue,
            categorywiseEarning,
            bookingTable
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch stats', details: error.message });
    }
};
