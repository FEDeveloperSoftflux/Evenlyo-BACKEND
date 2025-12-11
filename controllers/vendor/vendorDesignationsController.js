const VendorDesignations = require('../../models/vendorDesignations');

// Create designation
exports.createDesignation = async (req, res) => {
    try {
        console.log(req.body, "req.bodyreq.bodyreq.body");
        const designation = new VendorDesignations(req.body);
        await designation.save();
        res.status(201).json(designation);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// Get all designations
exports.getDesignations = async (req, res) => {
    try {
        const { id } = req.params
        const designations = await VendorDesignations.find({ vendorId: id });
        res.json(designations);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get single designation
exports.getDesignation = async (req, res) => {
    try {
        const designation = await VendorDesignations.findById(req.params.id);
        if (!designation) return res.status(404).json({ error: 'Not found' });
        res.json(designation);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Update designation
exports.updateDesignation = async (req, res) => {
    try {
        const designation = await VendorDesignations.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!designation) return res.status(404).json({ error: 'Not found' });
        res.json(designation);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// Delete designation
exports.deleteDesignation = async (req, res) => {
    try {
        const designation = await VendorDesignations.findByIdAndDelete(req.params.id);
        if (!designation) return res.status(404).json({ error: 'Not found' });
        res.json({ message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
