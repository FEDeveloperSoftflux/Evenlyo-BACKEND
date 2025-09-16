const Plan = require('../../models/Plan');

// Get all plans (both active and inactive)
const getAllPlans = async (req, res) => {
  try {
    const plans = await Plan.find({}).sort({ sortOrder: 1, createdAt: 1 });
    
    // Add effective pricing information
    const plansWithPricing = plans.map(plan => ({
      ...plan.toObject(),
      effectivePrice: plan.getEffectivePrice(),
      isDiscountActive: plan.isDiscountActive(),
      discountedPrice: plan.discountedPrice
    }));

    res.status(200).json({
      success: true,
      data: plansWithPricing,
      count: plansWithPricing.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error occurred',
      error: error.message
    });
  }
};



module.exports = {
  getAllPlans,
};
