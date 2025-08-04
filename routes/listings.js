const express = require('express');
const router = express.Router();
const listingController = require('../controllers/listingController');

// Public routes (no authentication required)
router.get('/', listingController.getAvailableListings);
router.get('/search', listingController.searchListings);
router.get('/featured', listingController.getFeaturedListings);
router.get('/popular', listingController.getPopularListings);
router.post('/category', listingController.getListingsByCategoryPost);
router.post('/subcategory', listingController.getListingsBySubCategoryPost);
router.get('/vendor/:vendorId', listingController.getListingsByVendor);
router.get('/service-type/:type', listingController.getListingsByServiceType);
router.get('/:id', listingController.getListingById);

// Protected routes (authentication required)
router.post('/', listingController.createListing);
router.put('/:id', listingController.updateListing);

module.exports = router; 