const express = require('express');
const router = express.Router();
const adminEmployeeController = require('../../controllers/admin/adminEmployeeController');

router.post('/', adminEmployeeController.createEmployee);
router.get('/', adminEmployeeController.getEmployees);
router.get('/:id', adminEmployeeController.getEmployee);
router.put('/:id', adminEmployeeController.updateEmployee);
router.delete('/:id', adminEmployeeController.deleteEmployee);

// Toggle employee status
router.patch('/:id/toggle-status', adminEmployeeController.toggleEmployeeStatus);

module.exports = router;
