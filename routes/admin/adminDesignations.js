const express = require('express');
const router = express.Router();
const adminDesignationController = require('../../controllers/admin/adminDesignationController');

router.post('/admin/create-designation', adminDesignationController.createDesignation);
router.get('/admin/fetch-designations', adminDesignationController.getDesignations);
router.get('/:id', adminDesignationController.getDesignation);
router.put('/admin/update-designation/:id', adminDesignationController.updateDesignation);
router.delete('/admin/delete-designation/:id', adminDesignationController.deleteDesignation);

module.exports = router;
