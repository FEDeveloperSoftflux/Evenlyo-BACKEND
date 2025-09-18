const AdminEmployee = require('../../models/AdminEmployee');
const bcrypt = require('bcryptjs');

// Create employee
exports.createEmployee = async (req, res) => {
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

// Get all employees
exports.getEmployees = async (req, res) => {
  try {
    const employees = await AdminEmployee.find().populate('designation');
    res.json(employees);
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
