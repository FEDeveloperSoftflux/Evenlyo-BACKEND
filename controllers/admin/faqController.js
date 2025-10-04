const asyncHandler = require('express-async-handler');
const FAQ = require('../../models/FAQ');
const { toMultilingualText } = require('../../utils/textUtils');

// Helper to build multilingual fields safely
const normalizeMultilingual = (value) => toMultilingualText(value);

// @desc Create FAQ
// @route POST /api/admin/faqs
// @access Private (Admin)
const createFAQ = asyncHandler(async (req, res) => {
  try {
    const { question, answer, isActive = true } = req.body;

    if (!question || !answer) {
      return res.status(400).json({ success: false, message: 'question and answer are required' });
    }

    const faq = await FAQ.create({
      question: normalizeMultilingual(question),
      answer: normalizeMultilingual(answer),
      isActive
    });

    res.status(201).json({ success: true, message: 'FAQ created', data: faq });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error creating FAQ', error: error.message });
  }
});

// @desc Get all FAQs (admin)
// @route GET /api/admin/faqs
// @access Private (Admin)
const getFAQs = asyncHandler(async (req, res) => {
  try {
    const faqs = await FAQ.find().sort({ createdAt: -1 });
    res.json({ success: true, data: faqs });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching FAQs', error: error.message });
  }
});


// @desc Get FAQ by id
// @route GET /api/admin/faqs/:id
// @access Private (Admin)
const getFAQById = asyncHandler(async (req, res) => {
  try {
    const faq = await FAQ.findById(req.params.id);
    if (!faq) return res.status(404).json({ success: false, message: 'FAQ not found' });
    res.json({ success: true, data: faq });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching FAQ', error: error.message });
  }
});

// @desc Update FAQ
// @route PUT /api/admin/faqs/:id
// @access Private (Admin)
 const updateFAQ = asyncHandler(async (req, res) => {
  try {
    const { question, answer, isActive } = req.body;
    const faq = await FAQ.findById(req.params.id);
    if (!faq) return res.status(404).json({ success: false, message: 'FAQ not found' });

    if (question) faq.question = normalizeMultilingual(question);
    if (answer) faq.answer = normalizeMultilingual(answer);
    if (isActive !== undefined) faq.isActive = isActive;

    await faq.save();
    res.json({ success: true, message: 'FAQ updated', data: faq });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating FAQ', error: error.message });
  }
});

// @desc Delete FAQ
// @route DELETE /api/admin/faqs/:id
// @access Private (Admin)
const deleteFAQ = asyncHandler(async (req, res) => {
  try {
    const faq = await FAQ.findById(req.params.id);
    if (!faq) return res.status(404).json({ success: false, message: 'FAQ not found' });
    await faq.deleteOne();
    res.json({ success: true, message: 'FAQ deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting FAQ', error: error.message });
  }
});

module.exports = {
  createFAQ,
  getFAQs,
  getFAQById,
  updateFAQ,
  deleteFAQ
};