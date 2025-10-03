const Billing = require('../../models/Billing');
const Plan = require('../../models/Plan');
const Vendor = require('../../models/Vendor');

// Get all billing invoices for a vendor
const getVendorBillingInvoices = async (req, res) => {
	try {
		// Find the vendor document for the logged-in user
		const vendor = await Vendor.findOne({ userId: req.user.id });
		if (!vendor) {
			return res.status(404).json({ success: false, message: 'Vendor not found' });
		}
		const vendorId = vendor._id;

		const invoices = await Billing.find({ vendorId })
			.populate('planId', 'planName planPrice Period')
			.sort({ billingDate: -1 });

		const formatted = invoices.map(inv => ({
			billingId: inv._id,
			date: inv.billingDate,
			subscriptionPlan: inv.planId ? inv.planId.planName : '',
			amount: inv.amount,
			status: inv.status,
			invoiceNumber: inv.invoiceNumber
		}));

		res.json({ success: true, invoices: formatted });
	} catch (err) {
		res.status(500).json({ success: false, message: 'Server error', error: err.message });
	}
};

// Download invoice as PDF
const downloadInvoice = async (req, res) => {
	const PDFDocument = require('pdfkit');
	try {
		const { invoiceId } = req.params;
		const invoice = await Billing.findById(invoiceId)
			.populate('planId', 'planName planPrice Period')
			.populate('vendorId', 'businessName businessEmail businessPhone businessAddress');
		if (!invoice) {
			return res.status(404).json({ success: false, message: 'Invoice not found' });
		}
		// Prepare PDF
		const doc = new PDFDocument();
		res.setHeader('Content-Type', 'application/pdf');
		res.setHeader('Content-Disposition', `attachment; filename=invoice_${invoice.invoiceNumber}.pdf`);
		doc.pipe(res);
		// Header
		doc.fontSize(20).text('Invoice', { align: 'center' });
		doc.moveDown();
		// Vendor Info
		doc.fontSize(12).text(`Vendor: ${invoice.vendorId.businessName || ''}`);
		doc.text(`Email: ${invoice.vendorId.businessEmail || ''}`);
		doc.text(`Phone: ${invoice.vendorId.businessPhone || ''}`);
		doc.text(`Address: ${invoice.vendorId.businessAddress || ''}`);
		doc.moveDown();
		// Invoice Info
		doc.text(`Invoice Number: ${invoice.invoiceNumber}`);
		doc.text(`Date: ${invoice.billingDate.toLocaleDateString()}`);
		doc.text(`Status: ${invoice.status}`);
		doc.moveDown();
		// Plan Info
		doc.text(`Plan: ${invoice.planId && invoice.planId.planName ? (invoice.planId.planName.en || invoice.planId.planName) : ''}`);
		doc.text(`Period: ${invoice.planId && invoice.planId.Period ? invoice.planId.Period : ''}`);
		doc.text(`Amount: $${invoice.amount}`);
		doc.moveDown();
		doc.text('Thank you!', { align: 'center' });
		doc.end();
	} catch (err) {
		res.status(500).json({ success: false, message: 'Server error', error: err.message });
	}
}

module.exports = {
	   getVendorBillingInvoices,
	   downloadInvoice

};
