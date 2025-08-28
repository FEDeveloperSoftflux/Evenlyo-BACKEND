const mongoose = require('mongoose');
const Billing = require('./models/Billing');
const Vendor = require('./models/Vendor');
const Plan = require('./models/Plan');

// TODO: Update with your MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://talal:X1vb2CgwaaRg7vNy@cluster0.yghxjij.mongodb.net/Evenlyo';

async function seedBilling() {
  await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

  // Fetch some real vendor and plan IDs
  const vendors = await Vendor.find().limit(2);
  const plans = await Plan.find().limit(2);

  if (vendors.length === 0 || plans.length === 0) {
    console.error('No vendors or plans found. Please add some first.');
    process.exit(1);
  }

  const billings = [
    {
      vendorId: vendors[0]._id,
      planId: plans[0]._id,
      amount: plans[0].planPrice,
      status: 'paid',
      invoiceNumber: 'INV-1001',
      billingDate: new Date()
    },
    {
      vendorId: vendors[1]._id,
      planId: plans[1]._id,
      amount: plans[1].planPrice,
      status: 'pending',
      invoiceNumber: 'INV-1002',
      billingDate: new Date()
    }
  ];

  await Billing.deleteMany({ invoiceNumber: { $in: ['INV-1001', 'INV-1002'] } });
  await Billing.insertMany(billings);

  console.log('Seeded billing data:', billings);
  await mongoose.disconnect();
}

seedBilling().catch(err => {
  console.error(err);
  process.exit(1);
});
