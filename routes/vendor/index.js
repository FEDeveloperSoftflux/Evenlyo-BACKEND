const express = require('express');
const router = express.Router();


router.use('/bookings', require('./booking'));
router.use('/profile', require('./profile'));
// ... add other vendor subroutes here if needed

module.exports = router;
