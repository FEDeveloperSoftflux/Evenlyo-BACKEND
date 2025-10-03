const express = require('express');
const router = express.Router();
const { requireAuth, requireVendor } = require('../../middleware/authMiddleware');
const { getVendorListingsOverview, toggleListingStatus, createListing, updateListing, deleteListing } = require('../../controllers/vendor/listingManagement');


// GET /api/vendor/listings/overview
router.get('/overview', requireAuth, requireVendor, getVendorListingsOverview);
router.patch('/:id/toggle-status', requireAuth, requireVendor, toggleListingStatus);

// Protected routes (authentication required)
router.post('/create', requireAuth, requireVendor, createListing);

// DELETE /api/vendor/listings/:id
router.delete('/delete/:id', requireAuth, requireVendor, deleteListing);

router.put('/update/:id', requireAuth, requireVendor, updateListing);

module.exports = router;

