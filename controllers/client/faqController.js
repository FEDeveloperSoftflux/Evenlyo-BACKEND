const asyncHandler = require('express-async-handler');
const FAQ = require('../../models/FAQ');
const { toMultilingualText } = require('../../utils/textUtils');

// Helper to build multilingual fields safely
const normalizeMultilingual = (value) => toMultilingualText(value);

// @desc Get all FAQs (admin)
// @route GET /api/admin/faqs
const getFAQs = asyncHandler(async (req, res) => {
  try {
    const faqs = await FAQ.find().sort({ createdAt: -1 });
    res.json({ success: true, data: faqs });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching FAQs', error: error.message });
  }
});

module.exports = {
    getFAQs
};