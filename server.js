const app = require('./app');
const http = require('http');
const { Server } = require('socket.io');
const { initializeSocket } = require('./utils/socketHandler');

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

// Initialize Socket.io with CORS configuration
const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5000',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'http://127.0.0.1:5500',
      'http://localhost:5500'
    ],
    methods: ['GET', 'POST'],
    credentials: true
  },
  // Connection timeout
  pingTimeout: 60000,
  pingInterval: 25000
});

// Attach Socket.io instance to app for access in controllers
app.set('io', io);

// Initialize socket event handlers
initializeSocket(io);

// Socket.io connection logging
io.engine.on('connection_error', (err) => {
  console.log('Socket.io connection error:', err.req);
  console.log('Socket.io error code:', err.code);
  console.log('Socket.io error message:', err.message);
  console.log('Socket.io error context:', err.context);
});

// Server startup
server.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
  console.log(`Socket.io server ready for real-time chat`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

module.exports = { server, io };