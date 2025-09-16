const Plan = require('../../models/Plan');

// Get all pricing plans (admin view)
const getAllPlansAdmin = async (req, res) => {
  try {
    const plans = await Plan.find({}).sort({ sortOrder: 1, createdAt: 1 });
    const plansData = plans.map(plan => ({
      id: plan._id,
      Planame: plan.planName?.en || '',
      PlanPrice: plan.planPrice,
      Period: plan.Period,
      features: plan.features?.map(f => f.en) || [],
      active: plan.isActive,
      discountDays: plan.discount?.discountDays || 0,
      percentage: plan.discount?.percentage || 0
    }));
    res.status(200).json({ success: true, data: plansData, count: plansData.length });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Toggle plan active/deactive status
const togglePlanStatusAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await Plan.findById(id);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }
    plan.isActive = !plan.isActive;
    await plan.save();
    res.status(200).json({ success: true, message: `Plan is now ${plan.isActive ? 'active' : 'inactive'}`, active: plan.isActive });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Activate discount for a plan
const activateDiscount = async (req, res) => {
  try {
    const { id } = req.params;
    const { percentage, discountDays } = req.body;

    // Validation
    if (!percentage || !discountDays) {
      return res.status(400).json({
        success: false,
        message: 'Discount percentage and discount days are required'
      });
    }

    if (percentage < 0 || percentage > 100) {
      return res.status(400).json({
        success: false,
        message: 'Discount percentage must be between 0 and 100'
      });
    }

    if (discountDays < 0) {
      return res.status(400).json({
        success: false,
        message: 'Discount days must be a positive number'
      });
    }

    const plan = await Plan.findByIdAndUpdate(
      id,
      {
        'discount.percentage': percentage,
        'discount.discountDays': discountDays,
        'discount.isActive': true
      },
      { new: true, runValidators: true }
    );

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Discount activated successfully',
      data: {
        ...plan.toObject(),
        effectivePrice: plan.getEffectivePrice(),
        isDiscountActive: plan.isDiscountActive(),
        discountedPrice: plan.discountedPrice
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error occurred',
      error: error.message
    });
  }
};

module.exports = { getAllPlansAdmin, togglePlanStatusAdmin, activateDiscount };
// Toggle discount active/deactive status
const toggleDiscountStatusAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await Plan.findById(id);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }
    plan.discount.isActive = !plan.discount.isActive;
    await plan.save();
    res.status(200).json({ success: true, message: `Discount is now ${plan.discount.isActive ? 'active' : 'inactive'}`, discountActive: plan.discount.isActive });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

module.exports = { getAllPlansAdmin, togglePlanStatusAdmin, activateDiscount, toggleDiscountStatusAdmin };