const express = require('express');
const router = express.Router();
const {
  getAllPlans,
} = require('../../controllers/client/planController');



// Public route
// GET /api/plans - Get all plans
router.get('/', getAllPlans);


module.exports = router;
