
const Designation = require('../../models/Designation');
const Employee = require('../../models/Employee');
const Vendor = require('../../models/Vendor');
const User = require('../../models/User');
const bcrypt = require('bcryptjs');

// Get all designations for a vendor
const getAllDesignations = async (req, res) => {
	try {
		// Require vendor authentication, get vendorId from req.user
		const vendorId = req.user && req.user.vendorId;
		if (!vendorId) return res.status(401).json({ error: 'Unauthorized: vendor authentication required' });

		const designations = await Designation.find({ vendor: vendorId })
			.sort({ createdAt: -1 });

		const result = designations.map(d => ({
			id: d._id,
			name: d.name,
			permissions: d.permissions,
			isActive: d.isActive,
			createdAt: d.createdAt
		}));

		res.json({ designations: result });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
};

// Create a new designation for a vendor
const createDesignation = async (req, res) => {
	try {
		const vendorId = req.user && req.user.vendorId;
		if (!vendorId) return res.status(401).json({ error: 'Unauthorized: vendor authentication required' });

		const { name, permissions, status } = req.body;
		if (!name || !permissions) {
			return res.status(400).json({ error: 'name and permissions are required' });
		}

		const designation = new Designation({
			name,
			permissions,
			status: status || 'active',
			vendor: vendorId
		});
		await designation.save();
		res.status(201).json({ message: 'Designation created successfully', designation });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
};

// Create a new employee (role user) for a vendor business account using Employee model
const createRoleUser = async (req, res) => {
	try {
		const vendorId = req.user && req.user.vendorId;
		if (!vendorId) return res.status(401).json({ error: 'Unauthorized: vendor authentication required' });

		const { firstName, lastName, email, contactNumber, password, designationId } = req.body;
		if (!firstName || !lastName || !email || !contactNumber || !password || !designationId) {
			return res.status(400).json({ error: 'All fields are required' });
		}

		// Check if email already exists for this vendor
		const existing = await Employee.findOne({ email, vendor: vendorId });
		if (existing) return res.status(409).json({ error: 'Email already exists for this vendor' });

		const hashedPassword = await bcrypt.hash(password, 10);

		const employee = new Employee({
			firstName,
			lastName,
			email,
			contactNumber,
			password: hashedPassword,
			designation: designationId,
			vendor: vendorId
		});
		await employee.save();
		res.status(201).json({ message: 'Employee created', employee });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
};
// Get all employees (role users) for a vendor (overview) using Employee model
const getAllRoleUsers = async (req, res) => {
	try {
		const vendorId = req.user && req.user.vendorId;
		if (!vendorId) return res.status(401).json({ error: 'Unauthorized: vendor authentication required' });

		const employees = await Employee.find({ vendor: vendorId })
			.populate('designation')
			.sort({ createdAt: -1 });

		const result = employees.map(e => ({
			id: e._id,
			name: `${e.firstName} ${e.lastName}`,
			contact: e.contactNumber,
			email: e.email,
			password: '********', // never return real password
			designation: e.designation ? e.designation.name : null,
			status: e.status,
			createdAt: e.createdAt
		}));
		res.json({ employees: result });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
};

// Delete a designation for a vendor
const deleteDesignation = async (req, res) => {
	try {
		const vendorId = req.user && req.user.vendorId;
		if (!vendorId) return res.status(401).json({ error: 'Unauthorized: vendor authentication required' });
		const { designationId } = req.params;
		if (!designationId) return res.status(400).json({ error: 'designationId is required' });

		const designation = await Designation.findOneAndDelete({ _id: designationId, vendor: vendorId });
		if (!designation) return res.status(404).json({ error: 'Designation not found or not authorized' });

		res.json({ message: 'Designation deleted successfully' });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
};

const deleteRoleUser = async (req, res) => {
	try {
		const vendorId = req.user && req.user.vendorId;
		if (!vendorId) return res.status(401).json({ error: 'Unauthorized: vendor authentication required' });
		console.log('req.params:', req.params);
		const { employeeId } = req.params;
		if (!employeeId) return res.status(400).json({ error: 'employeeId is required' });

		const employee = await Employee.findOneAndDelete({ _id: employeeId, vendor: vendorId });
		if (!employee) return res.status(404).json({ error: 'Employee not found or not authorized' });

		res.json({ message: 'Employee deleted successfully' });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
};

// Edit a designation's name and permissions for a vendor
const editDesignation = async (req, res) => {
	try {
		const vendorId = req.user && req.user.vendorId;
		if (!vendorId) return res.status(401).json({ error: 'Unauthorized: vendor authentication required' });

		const { designationId } = req.params;
		const { name, permissions } = req.body;
		const {isActive} = req.body;
		if (!designationId) return res.status(400).json({ error: 'designationId is required' });

		const update = {};
		if (name) update.name = name;
		if (permissions) update.permissions = permissions;
		if (isActive) update.isActive = isActive;

		const designation = await Designation.findOneAndUpdate(
			{ _id: designationId, vendor: vendorId },
			{ $set: update },
			{ new: true }
		);

		if (!designation) return res.status(404).json({ error: 'Designation not found or not authorized' });

		res.json({ message: 'Designation updated successfully', designation });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
};

// Update a role user (employee) for a vendor
const editRoleUser = async (req, res) => {
	try {
		const vendorId = req.user && req.user.vendorId;
		if (!vendorId) return res.status(401).json({ error: 'Unauthorized: vendor authentication required' });

		const { employeeId } = req.params;
		const { firstName, lastName, email, contactNumber, password, designationId, status } = req.body;
		if (!employeeId) return res.status(400).json({ error: 'employeeId is required' });

		const update = {};
		if (firstName) update.firstName = firstName;
		if (lastName) update.lastName = lastName;
		if (email) update.email = email;
		if (contactNumber) update.contactNumber = contactNumber;
		if (designationId) update.designation = designationId;
		if (status) update.status = status;

		if (password) {
			const hashedPassword = await bcrypt.hash(password, 10);
			update.password = hashedPassword;
		}

		const employee = await Employee.findOneAndUpdate(
			{ _id: employeeId, vendor: vendorId },
			{ $set: update },
			{ new: true }
		);

		if (!employee) return res.status(404).json({ error: 'Employee not found or not authorized' });

		res.json({ message: 'Employee updated successfully', employee });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
};


module.exports = {
	getAllDesignations,
	createDesignation,
	createRoleUser,
	getAllRoleUsers,
	deleteDesignation,
	deleteRoleUser,
editDesignation,
editRoleUser
};