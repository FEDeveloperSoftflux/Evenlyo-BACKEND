const jwt = require('jsonwebtoken');
const Chat = require('../models/Chat');
const User = require('../models/User');
const { sendMessage } = require('../controllers/chatController');

// Store active users and their socket connections
const activeUsers = new Map();

// Socket authentication middleware using session cookie
const cookie = require('cookie');
const util = require('util');
const session = require('express-session');
const sessionMiddleware = require('../app').get('sessionMiddleware');

const authenticateSocket = async (socket, next) => {
  try {
    // Parse cookies from socket handshake
    const cookies = socket.request.headers.cookie ? cookie.parse(socket.request.headers.cookie) : {};
    const sessionId = cookies['evenlyo.sid'] || cookies['connect.sid'];
    if (!sessionId) {
      return next(new Error('Session cookie required'));
    }

    // Get session store from express-session
    const store = sessionMiddleware && sessionMiddleware.store;
    if (!store) {
      return next(new Error('Session store not available'));
    }

    // Get session data
    const getSession = util.promisify(store.get).bind(store);
    const sid = sessionId.startsWith('s:') ? sessionId.slice(2).split('.')[0] : sessionId;
    const sess = await getSession(sid);
    if (!sess || !sess.user || !sess.user.id) {
      return next(new Error('Not authenticated (no session user)'));
    }

    // Verify user exists in database
    const user = await User.findById(sess.user.id);
    if (!user || !user.isActive) {
      return next(new Error('User not found or inactive'));
    }

    // Attach user to socket
    socket.user = {
      id: user._id.toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      userType: user.userType,
      language: user.language || 'english'
    };
    next();
  } catch (error) {
    console.error('Socket authentication error:', error);
    next(new Error('Authentication failed'));
  }
};

// Initialize socket handlers
const initializeSocket = (io) => {
  // Use authentication middleware
  io.use(authenticateSocket);
  
  io.on('connection', (socket) => {
    const userId = socket.user.id;
    const userName = `${socket.user.firstName} ${socket.user.lastName}`;
    
    console.log(`User ${userName} (${userId}) connected: ${socket.id}`);
    
    // Store active user
    activeUsers.set(userId, {
      socketId: socket.id,
      user: socket.user,
      lastSeen: new Date()
    });
    
    // Broadcast user online status to relevant chats
    broadcastUserStatus(io, userId, 'online');
    
    // --- Chat Event Handlers ---
    
    // Join chat room
    socket.on('joinChat', async (data) => {
      try {
        const { chatId } = data;
        
        if (!chatId) {
          socket.emit('error', { message: 'Chat ID is required' });
          return;
        }
        
        // Verify user has access to this chat
        const chat = await Chat.findById(chatId);
        if (!chat) {
          socket.emit('error', { message: 'Chat not found' });
          return;
        }
        
        const hasAccess = chat.participants.some(p => p.user.toString() === userId);
        if (!hasAccess) {
          socket.emit('error', { message: 'Access denied to this chat' });
          return;
        }
        
        // Join the chat room
        socket.join(`chat_${chatId}`);
        
        // Mark chat as read when user joins
        chat.markAsRead(userId);
        await chat.save();
        
        console.log(`User ${userId} joined chat ${chatId}`);
        
        // Notify other participants that user joined
        socket.to(`chat_${chatId}`).emit('userJoinedChat', {
          userId: userId,
          userName: userName,
          chatId: chatId,
          timestamp: new Date()
        });
        
        socket.emit('joinedChat', { 
          chatId: chatId, 
          message: 'Successfully joined chat' 
        });
        
      } catch (error) {
        console.error('Join chat error:', error);
        socket.emit('error', { message: 'Error joining chat' });
      }
    });
    
    // Leave chat room
    socket.on('leaveChat', (data) => {
      try {
        const { chatId } = data;
        
        if (!chatId) {
          socket.emit('error', { message: 'Chat ID is required' });
          return;
        }
        
        socket.leave(`chat_${chatId}`);
        
        console.log(`User ${userId} left chat ${chatId}`);
        
        // Notify other participants that user left
        socket.to(`chat_${chatId}`).emit('userLeftChat', {
          userId: userId,
          userName: userName,
          chatId: chatId,
          timestamp: new Date()
        });
        
        socket.emit('leftChat', { 
          chatId: chatId, 
          message: 'Successfully left chat' 
        });
        
      } catch (error) {
        console.error('Leave chat error:', error);
        socket.emit('error', { message: 'Error leaving chat' });
      }
    });
    
    // Send message
    socket.on('sendMessage', async (data) => {
      try {
        const { chatId, content, originalLanguage = 'en' } = data;
        
        if (!chatId || !content) {
          socket.emit('error', { message: 'Chat ID and message content are required' });
          return;
        }
        
        if (content.trim().length === 0) {
          socket.emit('error', { message: 'Message content cannot be empty' });
          return;
        }
        
        if (content.length > 5000) {
          socket.emit('error', { message: 'Message too long (max 5000 characters)' });
          return;
        }
        
        // Send message using controller function
        const message = await sendMessage(chatId, userId, content.trim(), originalLanguage, io);
        
        console.log(`Message sent in chat ${chatId} by user ${userId}`);
        
        // Emit success to sender
        socket.emit('messageSent', {
          tempId: data.tempId, // If frontend uses temporary IDs
          message: message
        });
        
      } catch (error) {
        console.error('Send message error:', error);
        socket.emit('messageError', {
          tempId: data.tempId,
          error: error.message
        });
      }
    });
    
    // Typing indicators
    socket.on('startTyping', (data) => {
      try {
        const { chatId } = data;
        
        if (!chatId) {
          return;
        }
        
        // Broadcast typing status to other participants in the chat
        socket.to(`chat_${chatId}`).emit('userTyping', {
          userId: userId,
          userName: userName,
          chatId: chatId,
          isTyping: true,
          timestamp: new Date()
        });
        
      } catch (error) {
        console.error('Start typing error:', error);
      }
    });
    
    socket.on('stopTyping', (data) => {
      try {
        const { chatId } = data;
        
        if (!chatId) {
          return;
        }
        
        // Broadcast stop typing status to other participants in the chat
        socket.to(`chat_${chatId}`).emit('userTyping', {
          userId: userId,
          userName: userName,
          chatId: chatId,
          isTyping: false,
          timestamp: new Date()
        });
        
      } catch (error) {
        console.error('Stop typing error:', error);
      }
    });
    
    // Message read receipts
    socket.on('markMessageAsRead', async (data) => {
      try {
        const { chatId } = data;
        
        if (!chatId) {
          socket.emit('error', { message: 'Chat ID is required' });
          return;
        }
        
        // Update chat read status
        const chat = await Chat.findById(chatId);
        if (!chat) {
          socket.emit('error', { message: 'Chat not found' });
          return;
        }
        
        const hasAccess = chat.participants.some(p => p.user.toString() === userId);
        if (!hasAccess) {
          socket.emit('error', { message: 'Access denied to this chat' });
          return;
        }
        
        chat.markAsRead(userId);
        await chat.save();
        
        // Notify other participants about read status
        socket.to(`chat_${chatId}`).emit('messageRead', {
          chatId: chatId,
          readBy: userId,
          readAt: new Date()
        });
        
      } catch (error) {
        console.error('Mark message as read error:', error);
        socket.emit('error', { message: 'Error marking message as read' });
      }
    });
    
    // Handle user activity updates
    socket.on('userActivity', () => {
      // Update last seen time
      if (activeUsers.has(userId)) {
        const userInfo = activeUsers.get(userId);
        userInfo.lastSeen = new Date();
        activeUsers.set(userId, userInfo);
      }
    });
    
    // Get online users for a chat
    socket.on('getOnlineUsers', async (data) => {
      try {
        const { chatId } = data;
        
        if (!chatId) {
          socket.emit('error', { message: 'Chat ID is required' });
          return;
        }
        
        // Get chat participants
        const chat = await Chat.findById(chatId).populate('participants.user', 'firstName lastName');
        if (!chat) {
          socket.emit('error', { message: 'Chat not found' });
          return;
        }
        
        // Check which participants are online
        const onlineUsers = [];
        chat.participants.forEach(participant => {
          const participantId = participant.user._id.toString();
          if (activeUsers.has(participantId)) {
            const activeUser = activeUsers.get(participantId);
            onlineUsers.push({
              userId: participantId,
              userName: `${participant.user.firstName} ${participant.user.lastName}`,
              lastSeen: activeUser.lastSeen,
              isOnline: true
            });
          }
        });
        
        socket.emit('onlineUsers', {
          chatId: chatId,
          onlineUsers: onlineUsers
        });
        
      } catch (error) {
        console.error('Get online users error:', error);
        socket.emit('error', { message: 'Error getting online users' });
      }
    });
    
    // --- Disconnect Handler ---
    socket.on('disconnect', (reason) => {
      console.log(`User ${userName} (${userId}) disconnected: ${socket.id}, reason: ${reason}`);
      
      // Remove from active users
      activeUsers.delete(userId);
      
      // Broadcast user offline status to relevant chats
      broadcastUserStatus(io, userId, 'offline');
    });
    
    // --- Error Handler ---
    socket.on('error', (error) => {
      console.error(`Socket error for user ${userId}:`, error);
    });
  });
};

// Broadcast user online/offline status to all relevant chats
const broadcastUserStatus = async (io, userId, status) => {
  try {
    // Get all chats for this user
    const user = await User.findById(userId);
    if (!user) return;
    
    const userChats = await Chat.find({
      $or: [
        { client: userId },
        { vendor: userId }
      ],
      status: 'active'
    });
    
    // Broadcast status to each chat room
    userChats.forEach(chat => {
      io.to(`chat_${chat._id}`).emit('userStatusChanged', {
        userId: userId,
        status: status,
        timestamp: new Date(),
        chatId: chat._id
      });
    });
    
  } catch (error) {
    console.error('Broadcast user status error:', error);
  }
};

// Get active users count
const getActiveUsersCount = () => {
  return activeUsers.size;
};

// Get active users list
const getActiveUsers = () => {
  return Array.from(activeUsers.entries()).map(([userId, userInfo]) => ({
    userId,
    userName: `${userInfo.user.firstName} ${userInfo.user.lastName}`,
    userType: userInfo.user.userType,
    lastSeen: userInfo.lastSeen
  }));
};

// Check if user is online
const isUserOnline = (userId) => {
  return activeUsers.has(userId);
};

// Send direct message to user if online
const sendDirectMessage = (userId, eventName, data) => {
  const userInfo = activeUsers.get(userId);
  if (userInfo) {
    const io = require('../app').get('io');
    io.to(userInfo.socketId).emit(eventName, data);
    return true;
  }
  return false;
};

module.exports = {
  initializeSocket,
  getActiveUsersCount,
  getActiveUsers,
  isUserOnline,
  sendDirectMessage,
  broadcastUserStatus
};