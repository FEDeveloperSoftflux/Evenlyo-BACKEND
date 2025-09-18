const express = require('express');
const router = express.Router();
const reportController = require('../../controllers/admin/reportController');

// GET /admin/report/stats-card
router.get('/stats-card', reportController.getStatsCard);

module.exports = router;
