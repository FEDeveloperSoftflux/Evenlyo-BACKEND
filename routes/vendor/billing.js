const express = require('express');
const router = express.Router();
const { getVendorBillingInvoices, downloadInvoice } = require('../../controllers/vendor/billingController');
const { requireAuth } = require('../../middleware/authMiddleware');

// GET /api/vendor/billing/invoices
router.get('/invoices', requireAuth,getVendorBillingInvoices);

module.exports = router;
// GET /api/vendor/billing/invoice/:invoiceId/download
router.get('/invoice/:invoiceId/download', requireAuth, downloadInvoice);
