const express = require('express');
const router = express.Router();
const listingController = require('../controllers/listingController');

// Public routes (no authentication required)
router.get('/', listingController.getAvailableListings);
router.get('/filter', listingController.filterListings);
router.get('/search', listingController.searchListings);
router.get('/featured', listingController.getFeaturedListings);
router.get('/popular', listingController.getPopularListings);
router.get('/vendor/:vendorId', listingController.getListingsByVendor);
router.get('/service-type/:type', listingController.getListingsByServiceType);
router.get('/:id', listingController.getListingById);

// Admin/utility route to update popular status (protect in production)
router.post('/update-popular', listingController.updatePopularListings);

// @route   GET /api/listing/:id/availability
// @desc    Check listing availability for date range
// @access  Public
router.get('/:id/availability', listingController.checkListingAvailability);

// @route   GET /api/cakenade/:id
// @desc    Get calendar data (booked and available days) for a listing
// @access  Public
router.get('/calendar/:id', listingController.getListingCalendar);

// Protected routes (authentication required)
router.post('/', listingController.createListing);
router.put('/:id', listingController.updateListing);

module.exports = router; 