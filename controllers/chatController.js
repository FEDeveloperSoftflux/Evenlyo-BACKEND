const Chat = require('../models/Chat');
const Message = require('../models/Message');
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const asyncHandler = require('express-async-handler');
const { sendNotification } = require('../config/firebase');

// @desc    Get user's chat list
// @route   GET /api/chat/
// @access  Private
const getUserChats = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const userType = req.user.userType;
  
  try {
    const chats = await Chat.getUserChats(userId, userType);
    
    // Format chat data for frontend
    const formattedChats = chats.map(chat => {
      const otherParticipant = chat.participants.find(p => p.user._id.toString() !== userId);
      
      return {
        _id: chat._id,
        participant: {
          id: otherParticipant.user._id,
          name: `${otherParticipant.user.firstName} ${otherParticipant.user.lastName}`,
          profileImage: otherParticipant.user.profileImage,
          userType: otherParticipant.userType,
          lastSeen: otherParticipant.lastSeen
        },
        lastMessage: chat.lastMessage ? {
          content: chat.lastMessage.content,
          sentAt: chat.lastMessage.sentAt,
          isFromMe: chat.lastMessage.sender?.toString() === userId
        } : null,
        unreadCount: chat.getUnreadCount(userId),
        chatType: chat.chatType,
        relatedListing: chat.relatedListing ? {
          id: chat.relatedListing._id,
          title: chat.relatedListing.title,
          featuredImage: chat.relatedListing.media?.featuredImage
        } : null,
        status: chat.status,
        updatedAt: chat.updatedAt
      };
    });
    
    res.json({
      success: true,
      data: formattedChats
    });
  } catch (error) {
    console.error('Get user chats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching chats'
    });
  }
});

// @desc    Start or get existing chat
// @route   POST /api/chat/start
// @access  Private
const startChat = asyncHandler(async (req, res) => {
  const { recipientId, chatType, relatedListing, relatedBooking } = req.body;
  const currentUserId = req.user.id;
  const currentUserType = req.user.userType;
  
  if (!recipientId) {
    return res.status(400).json({
      success: false,
      message: 'Recipient ID is required'
    });
  }
  
  if (recipientId === currentUserId) {
    return res.status(400).json({
      success: false,
      message: 'Cannot start chat with yourself'
    });
  }
  
  try {
    // Verify recipient exists and get their user type
    const recipient = await User.findById(recipientId).select('userType firstName lastName profileImage');
    if (!recipient) {
      return res.status(404).json({
        success: false,
        message: 'Recipient not found'
      });
    }
    
    // Ensure chat is between client and vendor
    if ((currentUserType === 'client' && recipient.userType !== 'vendor') ||
        (currentUserType === 'vendor' && recipient.userType !== 'client')) {
      return res.status(400).json({
        success: false,
        message: 'Chat can only be between client and vendor'
      });
    }
    
    // Determine client and vendor IDs
    const clientId = currentUserType === 'client' ? currentUserId : recipientId;
    const vendorId = currentUserType === 'vendor' ? currentUserId : recipientId;
    
    // Find or create chat
    const chat = await Chat.findOrCreateChat(clientId, vendorId, {
      chatType,
      relatedListing,
      relatedBooking
    });
    
    // Get the other participant info
    const otherParticipant = chat.participants.find(p => p.user._id.toString() !== currentUserId);
    
    const chatData = {
      _id: chat._id,
      participant: {
        id: otherParticipant.user._id,
        name: `${otherParticipant.user.firstName} ${otherParticipant.user.lastName}`,
        profileImage: otherParticipant.user.profileImage,
        userType: otherParticipant.userType,
        lastSeen: otherParticipant.lastSeen
      },
      chatType: chat.chatType,
      relatedListing: chat.relatedListing,
      status: chat.status,
      createdAt: chat.createdAt
    };
    
    res.json({
      success: true,
      message: 'Chat started successfully',
      data: chatData
    });
  } catch (error) {
    console.error('Start chat error:', error);
    res.status(500).json({
      success: false,
      message: 'Error starting chat'
    });
  }
});

// @desc    Get chat messages
// @route   GET /api/chat/:chatId/messages
// @access  Private
const getChatMessages = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const { page = 1, limit = 50 } = req.query;
  const userId = req.user.id;
  const userLanguage = req.user.language || 'english';
  const langCode = userLanguage === 'dutch' ? 'nl' : 'en';
  
  try {
    // Verify user has access to this chat
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }
    
    const hasAccess = chat.participants.some(p => p.user.toString() === userId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this chat'
      });
    }
    
    // Mark chat as read for current user
    chat.markAsRead(userId);
    await chat.save();
    
    // Get messages with pagination
    const skip = (page - 1) * limit;
    const messages = await Message.find({ chat: chatId })
      .populate('sender', 'firstName lastName profileImage userType')
      .sort({ sentAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Format messages for frontend
    const formattedMessages = messages.reverse().map(message => {
      // Get message content in user's preferred language
      const content = message.translations.get(langCode) || 
                     message.translations.get('en') || 
                     message.translations.get(message.originalLanguage) || 
                     'Message translation not available';
      
      return {
        _id: message._id,
        content: content,
        originalLanguage: message.originalLanguage,
        availableLanguages: Array.from(message.translations.keys()),
        sender: {
          id: message.sender._id,
          name: `${message.sender.firstName} ${message.sender.lastName}`,
          profileImage: message.sender.profileImage,
          userType: message.sender.userType
        },
        isFromMe: message.sender._id.toString() === userId,
        sentAt: message.sentAt
      };
    });
    
    res.json({
      success: true,
      data: {
        messages: formattedMessages,
        hasMore: messages.length === parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get chat messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching messages'
    });
  }
});

// @desc    Send message (used by Socket.io handler)
const sendMessage = async (chatId, senderId, content, originalLanguage = 'en', io) => {
  try {
    // Verify chat exists and user has access
    const chat = await Chat.findById(chatId).populate('participants.user', 'firstName lastName profileImage userType fcmToken language');
    if (!chat) {
      throw new Error('Chat not found');
    }
    
    const sender = chat.participants.find(p => p.user._id.toString() === senderId);
    if (!sender) {
      throw new Error('Access denied to this chat');
    }
    
    // Create message with translations
    const translations = new Map();
    translations.set(originalLanguage, content);
    
    // TODO: Add translation logic here if needed
    // For now, we'll store the same content for both languages
    if (originalLanguage === 'en') {
      translations.set('nl', content); // Placeholder - implement actual translation
    } else {
      translations.set('en', content); // Placeholder - implement actual translation
    }
    
    const message = new Message({
      chat: chatId,
      sender: senderId,
      translations: translations,
      originalLanguage: originalLanguage
    });
    
    await message.save();
    await message.populate('sender', 'firstName lastName profileImage userType');
    
    // Update chat's last message
    chat.lastMessage = {
      content: content,
      sender: senderId,
      sentAt: message.sentAt,
      language: originalLanguage
    };
    
    // Increment unread count for recipient
    const recipient = chat.participants.find(p => p.user._id.toString() !== senderId);
    if (recipient) {
      chat.incrementUnreadCount(recipient.user._id);
      
      // Send push notification to recipient if they have FCM token
      if (recipient.user.fcmToken) {
        const senderName = `${sender.user.firstName} ${sender.user.lastName}`;
        await sendNotification(
          recipient.user.fcmToken,
          `New message from ${senderName}`,
          content.length > 100 ? content.substring(0, 100) + '...' : content
        ).catch(err => console.error('FCM notification error:', err));
      }
    }
    
    chat.updatedAt = new Date();
    await chat.save();
    
    // Format message for real-time broadcast
    const formattedMessage = {
      _id: message._id,
      content: content,
      originalLanguage: originalLanguage,
      availableLanguages: Array.from(message.translations.keys()),
      sender: {
        id: message.sender._id,
        name: `${message.sender.firstName} ${message.sender.lastName}`,
        profileImage: message.sender.profileImage,
        userType: message.sender.userType
      },
      sentAt: message.sentAt,
      chatId: chatId
    };
    
    // Broadcast to chat room
    io.to(`chat_${chatId}`).emit('newMessage', formattedMessage);
    
    return formattedMessage;
  } catch (error) {
    console.error('Send message error:', error);
    throw error;
  }
};

// @desc    Mark chat as read
// @route   PATCH /api/chat/:chatId/read
// @access  Private
const markChatAsRead = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const userId = req.user.id;
  
  try {
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }
    
    const hasAccess = chat.participants.some(p => p.user.toString() === userId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this chat'
      });
    }
    
    chat.markAsRead(userId);
    await chat.save();
    
    res.json({
      success: true,
      message: 'Chat marked as read'
    });
  } catch (error) {
    console.error('Mark chat as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking chat as read'
    });
  }
});

// @desc    Delete/Archive chat
// @route   DELETE /api/chat/:chatId
// @access  Private
const deleteChat = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const userId = req.user.id;
  
  try {
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }
    
    const hasAccess = chat.participants.some(p => p.user.toString() === userId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this chat'
      });
    }
    
    // Archive chat instead of deleting
    chat.status = 'archived';
    await chat.save();
    
    res.json({
      success: true,
      message: 'Chat archived successfully'
    });
  } catch (error) {
    console.error('Delete chat error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting chat'
    });
  }
});

// @desc    Get chat statistics (for admin)
// @route   GET /api/chat/stats
// @access  Private (Admin)
const getChatStats = asyncHandler(async (req, res) => {
  try {
    const totalChats = await Chat.countDocuments({ status: 'active' });
    const totalMessages = await Message.countDocuments();
    const activeToday = await Chat.countDocuments({
      status: 'active',
      updatedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });
    
    res.json({
      success: true,
      data: {
        totalChats,
        totalMessages,
        activeToday
      }
    });
  } catch (error) {
    console.error('Get chat stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching chat statistics'
    });
  }
});

module.exports = {
  getUserChats,
  startChat,
  getChatMessages,
  sendMessage,
  markChatAsRead,
  deleteChat,
  getChatStats
};