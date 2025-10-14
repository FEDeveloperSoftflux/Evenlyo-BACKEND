// socketServer.js
const { Server } = require("socket.io");
const http = require("http");

const server = http.createServer();
const io = new Server(server, {
  cors: { origin: "*" },
});

io.on("connection", (socket) => {
  console.log("🔌 User connected:", socket.id);

  socket.on("joinRoom", (room) => {
    socket.join(room);
    console.log("📥 User joined room:", room);
  });

  socket.on("sendMessage", ({ room, sender, message }) => {
    console.log(`💬 ${sender} -> ${room}: ${message}`);
    io.to(room).emit("receiveMessage", { sender, message });
  });

  socket.on("disconnect", () => {
    console.log("❌ Disconnected:", socket.id);
  });
});

server.listen(5000, () => console.log("🚀 Socket.io server running on port 5000"));

