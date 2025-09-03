
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
			status: d.status,
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


module.exports = {
	getAllDesignations,
	createDesignation,
	createRoleUser,
	getAllRoleUsers
};