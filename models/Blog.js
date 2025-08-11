const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  author: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  isApproved: {
    type: Boolean,
    default: false
  }
});

const blogSchema = new mongoose.Schema({
  title: {
    en: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    nl: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    }
  },
  description: {
    en: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500
    },
    nl: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500
    }
  },
  content: {
    en: {
      type: String,
      required: true
    },
    nl: {
      type: String,
      required: true
    }
  },
  author: {
    en: {
      type: String,
      required: true,
      trim: true
    },
    nl: {
      type: String,
      required: true,
      trim: true
    }
  },
  category: {
    en: {
      type: String,
      required: true,
      trim: true
    },
    nl: {
      type: String,
      required: true,
      trim: true
    }
  },
  readTime: {
    type: Number,
    required: true,
    min: 1
  },
  image: {
    type: String,
    required: true
  },
  isMain: {
    type: Boolean,
    default: false
  },
  isPublished: {
    type: Boolean,
    default: true
  },
  tags: {
    en: [{
      type: String,
      trim: true
    }],
    nl: [{
      type: String,
      trim: true
    }]
  },
  views: {
    type: Number,
    default: 0
  },
  comments: [commentSchema]
}, {
  timestamps: true
});

// Index for better query performance
blogSchema.index({ isPublished: 1, createdAt: -1 });
blogSchema.index({ 'category.en': 1, 'category.nl': 1 });
blogSchema.index({ isMain: 1 });

// Virtual for formatted date
blogSchema.virtual('formattedDate').get(function() {
  return this.createdAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

module.exports = mongoose.model('Blog', blogSchema);
