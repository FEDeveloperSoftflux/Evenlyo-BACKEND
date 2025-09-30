const mongoose = require('mongoose');
const Category = require('./models/Category'); // Adjust path if needed

// Connect to your database
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/yourdb', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

async function migrateCategories() {
  try {
    // Find all categories with icons
    const categories = await Category.find({ icon: { $exists: true, $ne: null, $ne: '' } });

    for (const category of categories) {
      // Check if icon is a valid Cloudinary URL
      if (!/^https:\/\/res\.cloudinary\.com\//.test(category.icon)) {
        // Option 1: Remove invalid icons
        category.icon = undefined;

        // Option 2: Or update to a default Cloudinary URL if you have one
        // category.icon = 'https://res.cloudinary.com/your-cloud-name/image/upload/default-icon.png';

        await category.save();
        console.log(`Updated category: ${category.name.en}`);
      }
    }

    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    mongoose.connection.close();
  }
}

migrateCategories();