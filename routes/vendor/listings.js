const express = require('express');
const router = express.Router();
const { requireAuth, requireVendor, requireApprovedVendor } = require('../../middleware/authMiddleware');
const { getVendorListingsOverview, toggleListingStatus, createListing } = require('../../controllers/vendor/listingManagement');


// GET /api/vendor/listings/overview
router.get('/overview', requireAuth, requireVendor, requireApprovedVendor, getVendorListingsOverview);
router.patch('/:id/toggle-status', requireAuth, requireVendor, requireApprovedVendor, toggleListingStatus);

// Protected routes (authentication required)
router.post('/', requireAuth, requireVendor, requireApprovedVendor, createListing);

module.exports = router;

