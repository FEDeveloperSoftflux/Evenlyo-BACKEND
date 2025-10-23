const app = require('./app');
const http = require('http');
const { Server } = require('socket.io');
const chatSocket = require('./sockets/chatSockets');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// Shared allowed origins
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:3001',
  'https://evenlyo.web.app',
  'https://staging-evenlyo-vendor.web.app',
  'https://evenlyo-admin.web.app'
];

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'OPTIONS'], // OPTIONS useful for preflight
    credentials: true,
  }
});

app.set('socketio', io);
// Attach socket logic
chatSocket(io);

server.listen(PORT, () => {
  logger.info(`🚀 Server started on port ${PORT}`);
  logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`📝 Logging level: ${process.env.LOG_LEVEL || 'info'}`);
});

// Optional: catch server errors
server.on('error', (err) => {
  logger.error('Server error:', err);
});
