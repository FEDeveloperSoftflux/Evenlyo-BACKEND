
const express = require('express');
const router = express.Router();
const { getAllDesignations, createDesignation, getAllRoleUsers, createRoleUser } = require('../../controllers/vendor/RoleManagement');
const { requireAuth, requireVendor, requireApprovedVendor } = require('../../middleware/authMiddleware');

// GET all designations
router.get('/designations', requireAuth, requireVendor, requireApprovedVendor, getAllDesignations);

// POST create a new designation
router.post('/designations', requireAuth, requireVendor, requireApprovedVendor, createDesignation);

// POST create a new role user (person)
router.post('/role-users', requireAuth, requireVendor, requireApprovedVendor, createRoleUser);

// GET all role users (overview)
router.get('/role-users', requireAuth, requireVendor, requireApprovedVendor, getAllRoleUsers);

module.exports = router;
