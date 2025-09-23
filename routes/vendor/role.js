
const express = require('express');
const router = express.Router();
const { getAllDesignations, createDesignation, getAllRoleUsers, createRoleUser, deleteDesignation, deleteRoleUser, editDesignation, editRoleUser } = require('../../controllers/vendor/RoleManagement');
const { requireAuth, requireVendor, requireApprovedVendor } = require('../../middleware/authMiddleware');

// GET all designations
router.get('/designations', requireAuth, requireVendor, requireApprovedVendor, getAllDesignations);

// POST create a new designation
router.post('/designations', requireAuth, requireVendor, requireApprovedVendor, createDesignation);

// POST create a new role user (person)
router.post('/role-users', requireAuth, requireVendor, requireApprovedVendor, createRoleUser);

// GET all role users (overview)
router.get('/role-users', requireAuth, requireVendor, requireApprovedVendor, getAllRoleUsers);

// DELETE a designation by ID
router.delete('/designations/:designationId', requireAuth, requireVendor, requireApprovedVendor, deleteDesignation);

// DELETE a role user by ID
router.delete('/role-users/:employeeId', requireAuth, requireVendor, requireApprovedVendor, deleteRoleUser);

// PUT edit a designation by ID (name and permissions)
router.put('/designations/:designationId', requireAuth, requireVendor, requireApprovedVendor, editDesignation);

// PUT update a role user by ID
router.put('/role-users/:employeeId', requireAuth, requireVendor, requireApprovedVendor, editRoleUser);

module.exports = router;
