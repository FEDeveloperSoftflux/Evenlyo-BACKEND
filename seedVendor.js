const mongoose = require('mongoose');
const Vendor = require('./models/Vendor');
const User = require('./models/User');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://talal:X1vb2CgwaaRg7vNy@cluster0.yghxjij.mongodb.net/Evenlyo';

async function seedVendor() {
  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

  // Create a user for the vendor
  const user = new User({
    firstName: 'John',
    lastName: 'Doe',
    email: 'vendor@example.com',
    profileImage: 'https://images.unsplash.com/photo-15688cee39901d51358af867f711367461989-f85a21fda167?auto=format&fit=facearea&w=400&h=400&q=80',
    password: 'hashedpassword', // Use a hashed password in production
    isActive: true,
    userType: 'vendor',
    contactNumber: '+1234567890'
  });
  await user.save();

  // Create the vendor
  const vendor = new Vendor({
    userId: user._id,
    businessName: 'Eventful Moments',
    businessEmail: 'contact@eventful.com',
    businessPhone: '+1234567890',
    businessAddress: '123 Main St, Cityville',
    businessWebsite: 'https://eventful.com',
    teamType: 'team',
    teamSize: '6-10',
    businessLocation: 'Cityville',
  businessLogo: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Logo_TV_2015.png',
  bannerImage: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
    businessDescription: {
      en: 'We provide the best event management services in the city.',
      nl: 'Wij bieden de beste evenementenservices in de stad.'
    },
    whyChooseUs: 'We have 10+ years of experience and a passionate team.',
    rating: {
      average: 4.8,
      totalReviews: 25
    },
    totalBookings: 100,
    completedBookings: 98,
    contactMeEnabled: true,
    approvalStatus: 'approved',
    isApproved: true,
    mainCategories: [], // Add category ObjectIds if available
    subCategories: [], // Add subcategory ObjectIds if available
    gallery: [
      'https://images.unsplash.com/photo-1465101046530-73398c7f28ca?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1464983953574-0892a716854b?auto=format&fit=crop&w=800&q=80'
    ]
  });
  await vendor.save();

  console.log('Vendor and user seeded successfully!');
  await mongoose.disconnect();
}

seedVendor().catch(err => {
  console.error('Seeding error:', err);
  mongoose.disconnect();
});
