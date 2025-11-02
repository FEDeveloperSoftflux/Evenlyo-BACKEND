const express = require('express');
const router = express.Router();
const { createDesignation,
    deleteDesignation,
    getDesignation,
    getDesignations,
    updateDesignation
} = require('../../controllers/vendor/vendorDesignationsController');

router.post('/vendor/create-designation', createDesignation);
router.get('/vendor/fetch-designations/:id', getDesignations);
router.get('/:id', getDesignation);
router.put('/:id', updateDesignation);
router.delete('/:id', deleteDesignation);

module.exports = router;
