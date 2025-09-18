const AdminDesignation = require('../../models/AdminDesignation');

// Create designation
exports.createDesignation = async (req, res) => {
  try {
    const designation = new AdminDesignation(req.body);
    await designation.save();
    res.status(201).json(designation);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Get all designations
exports.getDesignations = async (req, res) => {
  try {
    const designations = await AdminDesignation.find();
    res.json(designations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get single designation
exports.getDesignation = async (req, res) => {
  try {
    const designation = await AdminDesignation.findById(req.params.id);
    if (!designation) return res.status(404).json({ error: 'Not found' });
    res.json(designation);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update designation
exports.updateDesignation = async (req, res) => {
  try {
    const designation = await AdminDesignation.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!designation) return res.status(404).json({ error: 'Not found' });
    res.json(designation);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Delete designation
exports.deleteDesignation = async (req, res) => {
  try {
    const designation = await AdminDesignation.findByIdAndDelete(req.params.id);
    if (!designation) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
