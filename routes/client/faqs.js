const express = require('express');
const router = express.Router();
const { getFAQs } = require('../../controllers/client/faqController');


router.get('/', getFAQs);

module.exports = router;