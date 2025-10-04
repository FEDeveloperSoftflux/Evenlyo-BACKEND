const express = require('express');
const router = express.Router();
const { createFAQ, getFAQs, getFAQById, updateFAQ, deleteFAQ } = require('../../controllers/admin/faqController');
const { requireAuth, requireAdmin, requireActiveAdmin } = require('../../middleware/authMiddleware');

// Combine admin middlewares similar to other admin routes
// const adminChain = [requireAuth, requireAdmin, requireActiveAdmin];

router.post('/', createFAQ);
router.get('/', getFAQs);
router.get('/:id', getFAQById);
router.put('/:id', updateFAQ);
router.delete('/:id', deleteFAQ);


module.exports = router;