const AdminEmployee = require('../../models/AdminEmployee');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const employee = await AdminEmployee.findOne({ email });
    if (!employee || employee.status !== 'active') {
      return res.status(401).json({ error: 'Invalid credentials or inactive account' });
    }
    const isMatch = await bcrypt.compare(password, employee.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    // Update lastLogin
    employee.lastLogin = new Date();
    await employee.save();
    // Generate JWT
    const token = jwt.sign({ id: employee._id, designation: employee.designation }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, employee });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
