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
router.put('/vendor/update-designation/:id', updateDesignation);
router.delete('/vendor/delete-designation/:id', deleteDesignation);

module.exports = router;
