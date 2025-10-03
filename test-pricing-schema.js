const mongoose = require('mongoose');
const Listing = require('./models/Listing');

// Test the pricing schema
console.log('Listing Schema - Pricing field definition:');
console.log(JSON.stringify(Listing.schema.paths.pricing.schema.paths, null, 2));

// Test creating a listing object
const testListing = new Listing({
  title: { en: "Test", nl: "Test" },
  description: { en: "Test desc", nl: "Test desc" },
  vendor: new mongoose.Types.ObjectId(),
  category: new mongoose.Types.ObjectId(),
  subCategory: new mongoose.Types.ObjectId(),
  pricing: {
    type: "PerEvent",
    amount: 500,
    extratimeCost: 50,
    securityFee: 100,
    pricePerKm: 5
  },
  serviceDetails: {
    serviceType: "non_human"
  }
});

console.log('\nTest Listing Pricing Object:');
console.log(JSON.stringify(testListing.pricing, null, 2));
console.log('\nTest Listing Service Type:');
console.log(testListing.serviceDetails.serviceType);