const AdminEmployee = require('../../models/AdminEmployee');
const bcrypt = require('bcryptjs');
const { signToken, successHelper } = require('../../utils/jwtUtils');
const AdminDesignation = require("../../models/AdminDesignation")
// Create employee
exports.createAdmin = async (req, res) => {
  try {
    const { password, ...rest } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const employee = new AdminEmployee({ ...rest, password: hashedPassword });
    await employee.save();
    res.status(201).json(employee);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};


exports.loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    // Check if admin exists
    const admin = await AdminEmployee.findOne({ email, status: "active" });
    console.log(admin, "adminadminadminadminadmin");

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    // Generate JWT Token
    const token = signToken({
      id: admin._id,
      name: admin.name,
    });

    return res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

exports.createEmployee = async (req, res) => {
  try {
    const { password, ...rest } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const employee = new AdminEmployee({
      ...rest,
      password: hashedPassword,
      role: "Employee"
    });
    await employee.save();
    res.status(201).json(employee);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.loginEmployee = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    const employee = await AdminEmployee.findOne({ email });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found"
      });
    }

    const isMatch = await bcrypt.compare(password, employee.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid password"
      });
    }

    // Only fetch pages if Employee role
    let pages = [];
    if (employee.role === "Employee" && employee.designationID) {
      const designation = await AdminDesignation.findById(employee.designationID);
      pages = designation?.permissions?.map(p => p.module) || [];
    }

    const token = signToken({
      id: employee._id,
      name: employee.name,
    });

    employee.lastLogin = new Date();
    await employee.save();

    const responseData = {
      id: employee._id,
      name: employee.name,
      email: employee.email,
      role: employee.role,
      status: employee.status,
    };

    if (employee.role === "Employee") {
      responseData.pages = pages;
    }

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: responseData
    });

  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};


// Get all employees
exports.getEmployees = async (req, res) => {
  try {
    const employees = await AdminEmployee.find({ role: "Employee" }).populate("designationID");
    successHelper(res, employees, "employess fetch successfully");
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get single employee
exports.getEmployee = async (req, res) => {
  try {
    const employee = await AdminEmployee.findById(req.params.id).populate('designation');
    if (!employee) return res.status(404).json({ error: 'Not found' });
    res.json(employee);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update employee
exports.updateEmployee = async (req, res) => {
  try {
    const updateData = { ...req.body };
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }
    const employee = await AdminEmployee.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!employee) return res.status(404).json({ error: 'Not found' });
    res.json(employee);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Delete employee
exports.deleteEmployee = async (req, res) => {
  try {
    const employee = await AdminEmployee.findByIdAndDelete(req.params.id);
    if (!employee) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Toggle employee status (active/inactive)
exports.toggleEmployeeStatus = async (req, res) => {
  try {
    const employee = await AdminEmployee.findById(req.params.id);
    if (!employee) return res.status(404).json({ error: 'Employee not found' });
    employee.status = employee.status === 'active' ? 'inactive' : 'active';
    await employee.save();
    res.json({ message: `Employee status updated to ${employee.status}`, employee });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
