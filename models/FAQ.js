const mongoose = require('mongoose');


const faqSchema = new mongoose.Schema({
  question:
  {
    en: { type: String, trim: true, required: true },
    nl: { type: String, trim: true, required: true }
  },
  answer: 
  {
    en: { type: String, trim: true, required: true },
    nl: { type: String, trim: true, required: true }
  },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

faqSchema.index({ category: 1, order: 1 });
faqSchema.index({ isActive: 1 });

module.exports = mongoose.model('FAQ', faqSchema);
