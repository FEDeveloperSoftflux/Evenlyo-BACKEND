const app = require('./app');
const http = require('http');
const { Server } = require('socket.io');
const chatSocket = require('./sockets/chatSockets');

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

// Attach socket logic
chatSocket(io);

server.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});

// Optional: catch server errors
server.on('error', (err) => {
  console.error('Server error:', err);
});
