const express = require('express');
const router = express.Router();
const {
  addToCart,
  getCart,
  removeFromCart,
  updateCartItem,
  submitCart,
  clearCart
} = require('../controllers/cartController');
const { requireAuth, requireClient } = require('../middleware/authMiddleware');

// @route   POST /api/cart/add
// @desc    Add item to user cart
// @access  Private (User)
router.post('/add', requireAuth, requireClient, addToCart);

// @route   GET /api/cart
// @desc    Get user's cart
// @access  Private (User)
router.get('/', requireAuth, requireClient, getCart);

// @route   DELETE /api/cart/:listingId
// @desc    Remove item from cart
// @access  Private (User)
router.delete('/remove/:listingId', requireAuth, requireClient, removeFromCart);

// @route   PUT /api/cart/update/:listingId
// @desc    Update item details in cart
// @access  Private (User)
router.put('/update/:listingId', requireAuth, requireClient, updateCartItem);

// @route   POST /api/cart/submit
// @desc    Submit all cart items as booking requests
// @access  Private (User)
router.post('/submit', requireAuth, requireClient, submitCart);

// @route   DELETE /api/cart
// @desc    Clear user's cart
// @access  Private (User)
router.delete('/', requireAuth, requireClient, clearCart);

module.exports = router;
