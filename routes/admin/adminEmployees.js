const express = require('express');
const router = express.Router();
const adminEmployeeController = require('../../controllers/admin/adminEmployeeController');

router.post('/create-admin', adminEmployeeController.createAdmin);
router.post('/login-admin', adminEmployeeController.loginEmployee);
router.get('/admin/fetch-employees', adminEmployeeController.getEmployees);
router.post('/admin/create-employee', adminEmployeeController.createEmployee);
router.post('/admin/login-employee', adminEmployeeController.loginEmployee);
router.get('/:id', adminEmployeeController.getEmployee);
router.put('/:id', adminEmployeeController.updateEmployee);
router.delete('/:id', adminEmployeeController.deleteEmployee);

// Toggle employee status
router.patch('/:id/toggle-status', adminEmployeeController.toggleEmployeeStatus);

module.exports = router;
