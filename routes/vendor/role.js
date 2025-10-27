
const express = require('express');
const router = express.Router();
const { getAllDesignations, createDesignation, getAllRoleUsers, createRoleUser, deleteDesignation, deleteRoleUser, editDesignation, editRoleUser } = require('../../controllers/vendor/RoleManagement');
const { requireAuth, requireVendor } = require('../../middleware/authMiddleware');

// GET all designations
router.get('/designations', requireAuth, requireVendor, getAllDesignations);

// POST create a new designation
router.post('/admin/create-designation', requireAuth, requireVendor, createDesignation);

// POST create a new role user (person)
router.post('/role-users', requireAuth, requireVendor, createRoleUser);

// GET all role users (overview)
router.get('/role-users', requireAuth, requireVendor, getAllRoleUsers);

// DELETE a designation by ID
router.delete('/designations/:designationId', requireAuth, requireVendor, deleteDesignation);

// DELETE a role user by ID
router.delete('/role-users/:employeeId', requireAuth, requireVendor, deleteRoleUser);

// PUT edit a designation by ID (name and permissions)
router.put('/designations/:designationId', requireAuth, requireVendor, editDesignation);

// PUT update a role user by ID
router.put('/role-users/:employeeId', requireAuth, requireVendor, editRoleUser);

module.exports = router;
