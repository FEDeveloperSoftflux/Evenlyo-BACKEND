const Booking = require('../../models/Booking');
const SaleItemPurchase = require('../../models/SaleItemPurchase');
const Item = require('../../models/Item');
const Plan = require('../../models/Plan');

// GET /admin/report/stats-card


const getTotalAmountFromBookings = async () => {
    const result = await Booking.aggregate([
        {
            $facet: {
                completedTotals: [
                    { $match: { status: "completed" } },
                    {
                        $group: {
                            _id: null,
                            total: { $sum: "$pricingBreakdown.total" }
                        }
                    }
                ],

                upfrontTotals: [
                    { $match: { paymentStatus: "upfront_paid" } },
                    {
                        $group: {
                            _id: null,
                            total: { $sum: "$pricingBreakdown.upfrontFee" }
                        }
                    }
                ]
            }
        },
        {
            $project: {
                totalAmount: {
                    $add: [
                        { $ifNull: [{ $arrayElemAt: ["$completedTotals.total", 0] }, 0] },
                        { $ifNull: [{ $arrayElemAt: ["$upfrontTotals.total", 0] }, 0] }
                    ]
                }
            }
        }
    ]);

    return result[0].totalAmount || 0;
};



// -------------------------------------------
// 2) PLATFORM EARNING FUNCTION
// -------------------------------------------
const getPlatformEarningFromBooking = async () => {
    const result = await Booking.aggregate([
        {
            $facet: {
                completedEarnings: [
                    { $match: { status: "completed" } },
                    {
                        $group: {
                            _id: null,
                            total: {
                                $sum: {
                                    $add: [
                                        "$pricingBreakdown.evenyloProtectFee",
                                        "$pricingBreakdown.platformFee"
                                    ]
                                }
                            }
                        }
                    }
                ],

                cancelledUpfrontEarnings: [
                    {
                        $match: {
                            status: "cancelled",
                            paymentStatus: "upfront_paid"
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            total: {
                                $sum: {
                                    $multiply: ["$pricingBreakdown.upfrontFee", 0.12]
                                }
                            }
                        }
                    }
                ]
            }
        },
        {
            $project: {
                platformEarning: {
                    $add: [
                        { $ifNull: [{ $arrayElemAt: ["$completedEarnings.total", 0] }, 0] },
                        { $ifNull: [{ $arrayElemAt: ["$cancelledUpfrontEarnings.total", 0] }, 0] }
                    ]
                }
            }
        }
    ]);

    return result[0].platformEarning || 0;
};

const getTotalAmountFromSale = async () => {
    const result = await SaleItemPurchase.aggregate([
        {
            $match: { status: "Delivered" }
        },
        {
            $group: {
                _id: null,
                totalAmountFromSale: { $sum: "$totalAmount" }  // 👈 Direct total
            }
        }
    ]);

    return result.length > 0 ? result[0].totalAmountFromSale : 0;
};

const getMonthlyBookingTotals = async () => {
    const result = await Booking.aggregate([
        {
            $match: {
                $or: [
                    { status: "completed" },
                    { paymentStatus: "upfront_paid" }
                ]
            }
        },
        {
            $addFields: {
                month: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },

                computedTotalAmount: {
                    $cond: [
                        { $eq: ["$status", "completed"] },
                        "$pricingBreakdown.total",
                        {
                            $cond: [
                                { $eq: ["$paymentStatus", "upfront_paid"] },
                                "$pricingBreakdown.upfrontFee",
                                0
                            ]
                        }
                    ]
                },

                computedPlatformEarning: {
                    $cond: [
                        { $eq: ["$status", "completed"] },
                        { $add: ["$pricingBreakdown.evenyloProtectFee", "$pricingBreakdown.platformFee"] },
                        {
                            $cond: [
                                {
                                    $and: [
                                        { $eq: ["$paymentStatus", "upfront_paid"] },
                                        { $eq: ["$status", "cancelled"] }
                                    ]
                                },
                                { $multiply: ["$pricingBreakdown.upfrontFee", 0.12] },
                                0
                            ]
                        }
                    ]
                }
            }
        },
        {
            $group: {
                _id: "$month",
                totalAmount: { $sum: "$computedTotalAmount" },
                platformEarning: { $sum: "$computedPlatformEarning" }
            }
        },
        {
            $project: {
                _id: 0,
                month: "$_id",
                totalAmount: 1,
                platformEarning: 1
            }
        },
        { $sort: { month: 1 } }
    ]);

    return result;
};

const getPlatformEarningPerMonth = async () => {
    return await Booking.aggregate([
        {
            $group: {
                _id: {
                    $dateToString: { format: "%Y-%m", date: "$createdAt" }
                },
                platformEarning: {
                    $sum: {
                        $cond: [
                            { $eq: ["$status", "completed"] },
                            { $add: ["$pricingBreakdown.platformFee", "$pricingBreakdown.evenyloProtectFee"] },

                            {
                                $cond: [
                                    {
                                        $and: [
                                            { $eq: ["$paymentStatus", "upfront_paid"] },
                                            { $eq: ["$status", "cancelled"] }
                                        ]
                                    },
                                    { $multiply: ["$pricingBreakdown.upfrontFee", 0.12] },
                                    0
                                ]
                            }
                        ]
                    }
                }
            }
        },
        { $sort: { "_id": 1 } }
    ]);
};

const getSalesTotalPerMonth = async () => {
    return await SaleItemPurchase.aggregate([
        {
            $match: { status: "Delivered" }
        },
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
                totalSaleAmount: { $sum: "$total" }
            }
        },
        { $sort: { "_id": 1 } }
    ]);
};

const getLineChartDataHelper = async () => {
    const bookingTotals = await getMonthlyBookingTotals();
    const platformTotals = await getPlatformEarningPerMonth();
    const salesTotals = await getSalesTotalPerMonth();

    // Merge all months uniquely
    const allMonths = new Set([
        ...bookingTotals.map(b => b._id),
        ...platformTotals.map(p => p._id),
        ...salesTotals.map(s => s._id),
    ]);

    const finalData = [];

    for (const month of allMonths) {
        const booking = bookingTotals.find(b => b._id === month);
        const platform = platformTotals.find(p => p._id === month);
        const sale = salesTotals.find(s => s._id === month);

        finalData.push({
            month,
            totalAmount: (booking?.totalAmount || 0) + (sale?.totalSaleAmount || 0),
            platformEarning: platform?.platformEarning || 0
        });
    }

    return finalData.sort((a, b) => a.month.localeCompare(b.month));
};
exports.getStatsCard = async (req, res) => {
    try {
        const totalAmountFromBookings = await getTotalAmountFromBookings();
        const platformEarningFromBooking = await getPlatformEarningFromBooking();
        const totalAmountFromSale = await getTotalAmountFromSale();
        const chartData = await getLineChartDataHelper();
        res.json({
            success: true,
            totalAmountFromBookings,
            platformEarningFromBooking,
            totalAmountFromSale,
            chartData
        });

    } catch (error) {
        console.error("Dashboard Error:", error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
    // // Booking table view for completed bookings with payment details
    // const bookingTableAgg = await Booking.aggregate([
    //     {
    //         $lookup: {
    //             from: 'listings',
    //             localField: 'listingId',
    //             foreignField: '_id',
    //             as: 'listing'
    //         }
    //     },
    //     { $unwind: '$listing' },
    //     {
    //         $lookup: {
    //             from: 'paymentintents',
    //             localField: '_id',
    //             foreignField: 'booking',
    //             as: 'paymentIntent'
    //         }
    //     },
    //     {
    //         $unwind: { path: '$paymentIntent', preserveNullAndEmptyArrays: false }
    //     },
    //     {
    //         $project: {
    //             trackingId: 1,
    //             date: '$createdAt',
    //             listingTitle: '$listing.title',
    //             platformFee: {
    //                 $ifNull: ['$platformFee', '$pricing.platformFee']
    //             },
    //             totalPrice: '$pricing.totalPrice',
    //             paymentDate: '$paymentIntent.createdAt',
    //             paymentPurpose: '$paymentIntent.paymentPurpose',
    //             paymentMethod: '$paymentIntent.paymentMethod',
    //             paymentAmount: '$paymentIntent.amount',
    //             paymentCurrency: '$paymentIntent.currency',
    //             paymentStatus: '$paymentIntent.status'
    //         }
    //     }
    // ]);

    // const bookingTable = bookingTableAgg.map(b => ({
    //     trackingId: b.trackingId,
    //     date: b.date,
    //     listingTitle: b.listingTitle,
    //     totalPrice: b.totalPrice,
    //     date: b.paymentDate,
    //     purpose: b.paymentPurpose,
    //     method: b.paymentMethod,
    //     amount: b.paymentAmount,
    //     currency: b.paymentCurrency,
    //     status: b.paymentStatus
    // }));
    // // Category-wise earning calculation
    // const categorywiseAgg = await Booking.aggregate([
    //     { $match: { status: 'paid' } },
    //     {
    //         $lookup: {
    //             from: 'listings',
    //             localField: 'listingId',
    //             foreignField: '_id',
    //             as: 'listing'
    //         }
    //     },
    //     { $unwind: '$listing' },
    //     {
    //         $lookup: {
    //             from: 'categories',
    //             localField: 'listing.category',
    //             foreignField: '_id',
    //             as: 'categoryObj'
    //         }
    //     },
    //     { $unwind: { path: '$categoryObj', preserveNullAndEmptyArrays: true } },
    //     {
    //         $group: {
    //             _id: '$categoryObj.name',
    //             earning: { $sum: '$platformFee' }
    //         }
    //     }
    // ]);

    // const categorywiseEarning = categorywiseAgg.map(c => ({
    //     category: c._id || 'Unknown',
    //     earning: c.earning || 0
    // }));
    // try {
    //     // Booking Earning: Sum of platformFee from completed bookings
    //     const bookingEarningAgg = await Booking.aggregate([
    //         {
    //             $match: {
    //                 paymentStatus: "paid",
    //                 status: "completed"
    //             }
    //         },
    //         {
    //             $group: {
    //                 _id: null,
    //                 total: { $sum: "$platformFee" }
    //             }
    //         }
    //     ]);
    //     const bookingEarning = bookingEarningAgg[0]?.total || 0;

    //     // Sale Item Earning: Sum of item platform fees from completed bookings
    //     const saleItemEarningAgg = await Booking.aggregate([
    //         { $match: { status: 'completed' } },
    //         { $group: { _id: null, total: { $sum: '$itemPlatformFee' } } }
    //     ]);
    //     const saleItemEarning = saleItemEarningAgg[0]?.total || 0;

    //     // NEED IMPLEMENTATION
    //     const planEarningAgg = await Plan.aggregate([
    //         { $group: { _id: null, total: { $sum: '$platformFee' } } }
    //     ]);
    //     const planEarning = planEarningAgg[0]?.total || 0;

    //     // Round total revenue to 3 decimal places
    //     const totalRevenue = Number((bookingEarning + saleItemEarning + planEarning).toFixed(3));

    //     // Monthly revenue calculation for current year
    //     const currentYear = new Date().getFullYear();
    //     const monthlyRevenueAgg = await Booking.aggregate([
    //         {
    //             $match: {
    //                 status: 'paid',
    //                 createdAt: {
    //                     $gte: new Date(`${currentYear}-01-01T00:00:00.000Z`),
    //                     $lt: new Date(`${currentYear + 1}-01-01T00:00:00.000Z`)
    //                 }
    //             }
    //         },
    //         {
    //             $group: {
    //                 _id: { month: { $month: "$createdAt" } },
    //                 revenue: { $sum: "$platformFee" }
    //             }
    //         },
    //         {
    //             $sort: { "_id.month": 1 }
    //         }
    //     ]);

    //     // Format monthly revenue for all 12 months
    //     const monthlyRevenue = Array.from({ length: 12 }, (_, i) => {
    //         const found = monthlyRevenueAgg.find(m => m._id.month === i + 1);
    //         return {
    //             month: i + 1,
    //             revenue: found ? found.revenue : 0
    //         };
    //     });

    //     res.json({
    //         statsCard: {
    //             bookingEarning,
    //             saleItemEarning,
    //             planEarning,
    //             totalRevenue
    //         },
    //         monthlyRevenue,
    //         categorywiseEarning,
    //         bookingTable
    //     });
    // } catch (error) {
    //     res.status(500).json({ error: 'Failed to fetch stats', details: error.message });
    // }
};
