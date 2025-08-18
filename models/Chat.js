const mongoose = require('mongoose');

// Chat Schema: represents a conversation between a user and vendor
const chatSchema = new mongoose.Schema({
  // Participants in the chat
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    userType: {
      type: String,
      enum: ['client', 'vendor'],
      required: true
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    lastSeen: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Quick reference to participant IDs for easier querying
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Chat metadata
  chatType: {
    type: String,
    enum: ['inquiry', 'booking', 'general'],
    default: 'general'
  },
  
  // Related listing if chat is about a specific service
  relatedListing: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Listing',
    default: null
  },
  
  // Related booking if chat is about a booking
  relatedBooking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    default: null
  },
  
  // Chat status
  status: {
    type: String,
    enum: ['active', 'archived', 'blocked'],
    default: 'active'
  },
  
  // Last message info for quick display
  lastMessage: {
    content: String,
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    sentAt: Date,
    language: String
  },
  
  // Unread message counts per participant
  unreadCounts: {
    client: {
      type: Number,
      default: 0
    },
    vendor: {
      type: Number,
      default: 0
    }
  },
  
  // Chat settings
  settings: {
    translationEnabled: {
      type: Boolean,
      default: true
    },
    notificationsEnabled: {
      type: Boolean,
      default: true
    }
  }
}, {
  timestamps: true
});

// Indexes for better performance
chatSchema.index({ client: 1, vendor: 1 }, { unique: true }); // Ensure only one chat between user-vendor pair
chatSchema.index({ 'participants.user': 1 });
chatSchema.index({ status: 1 });
chatSchema.index({ updatedAt: -1 });
chatSchema.index({ relatedListing: 1 });

// Methods
chatSchema.methods.getUnreadCount = function(userId) {
  // Find participant and return unread count
  const participant = this.participants.find(p => p.user.toString() === userId.toString());
  if (!participant) return 0;
  
  const userType = participant.userType;
  return this.unreadCounts[userType] || 0;
};

chatSchema.methods.markAsRead = function(userId) {
  // Find participant and reset unread count
  const participant = this.participants.find(p => p.user.toString() === userId.toString());
  if (!participant) return;
  
  const userType = participant.userType;
  this.unreadCounts[userType] = 0;
  participant.lastSeen = new Date();
};

chatSchema.methods.incrementUnreadCount = function(recipientId) {
  // Find recipient and increment unread count
  const participant = this.participants.find(p => p.user.toString() === recipientId.toString());
  if (!participant) return;
  
  const userType = participant.userType;
  this.unreadCounts[userType] = (this.unreadCounts[userType] || 0) + 1;
};

// Static methods
chatSchema.statics.findOrCreateChat = async function(clientId, vendorId, options = {}) {
  // First try to find existing chat
  let chat = await this.findOne({
    client: clientId,
    vendor: vendorId,
    status: 'active'
  }).populate('participants.user', 'firstName lastName profileImage userType');
  
  if (!chat) {
    // Create new chat
    chat = new this({
      client: clientId,
      vendor: vendorId,
      participants: [
        {
          user: clientId,
          userType: 'client'
        },
        {
          user: vendorId,
          userType: 'vendor'
        }
      ],
      chatType: options.chatType || 'general',
      relatedListing: options.relatedListing || null,
      relatedBooking: options.relatedBooking || null
    });
    
    await chat.save();
    await chat.populate('participants.user', 'firstName lastName profileImage userType');
  }
  
  return chat;
};

chatSchema.statics.getUserChats = async function(userId, userType) {
  const query = userType === 'client' ? { client: userId } : { vendor: userId };
  
  return this.find({
    ...query,
    status: 'active'
  })
  .populate('participants.user', 'firstName lastName profileImage userType')
  .populate('relatedListing', 'title media.featuredImage')
  .sort({ updatedAt: -1 });
};

module.exports = mongoose.model('Chat', chatSchema);