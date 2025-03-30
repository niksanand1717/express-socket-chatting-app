const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");
const cors = require("cors");

// Initialize express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*", // Allow all origins in development
    methods: ["GET", "POST"],
  },
});

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

// Store connected users and their rooms
const users = {};
const rooms = {};

// Socket.io connection handling
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  // Handle user joining a room
  socket.on("join_room", ({ username, roomId }) => {
    // Add user to users object
    users[socket.id] = { username, roomId };

    // Create room if it doesn't exist
    if (!rooms[roomId]) {
      rooms[roomId] = [];
    }

    // Add user to room
    rooms[roomId].push(socket.id);

    // Join socket.io room
    socket.join(roomId);

    // Get all users in this room
    const roomUsers = getRoomUsers(roomId);

    // Notify room about the new user
    io.to(roomId).emit("user_joined", {
      userId: socket.id,
      username: username,
      users: roomUsers,
    });

    // Send current room users list to the new user
    socket.emit("users_list", roomUsers);

    // Send room notification
    socket.to(roomId).emit("message", {
      userId: "system",
      username: "System",
      text: `${username} has joined the room`,
      time: new Date().toISOString(),
    });
  });

  // Handle incoming messages
  socket.on("message", (messageData) => {
    const userData = users[socket.id];

    if (!userData) return;

    const message = {
      userId: socket.id,
      username: userData.username,
      text: messageData.text,
      time: new Date().toISOString(),
    };

    // Broadcast message only to the same room
    io.to(userData.roomId).emit("message", message);
  });

  // Handle typing indicator
  socket.on("typing", (isTyping) => {
    const userData = users[socket.id];

    if (!userData) return;

    // Broadcast typing status only to the same room
    socket.to(userData.roomId).emit("user_typing", {
      userId: socket.id,
      username: userData.username,
      isTyping,
    });
  });

  // Handle room switching
  socket.on("switch_room", (newRoomId) => {
    const userData = users[socket.id];

    if (!userData) return;

    const oldRoomId = userData.roomId;

    // Leave old room
    socket.leave(oldRoomId);

    // Remove user from old room's user list
    if (rooms[oldRoomId]) {
      rooms[oldRoomId] = rooms[oldRoomId].filter((id) => id !== socket.id);

      // Notify old room about user leaving
      io.to(oldRoomId).emit("message", {
        userId: "system",
        username: "System",
        text: `${userData.username} has left the room`,
        time: new Date().toISOString(),
      });

      // Update old room's user list
      io.to(oldRoomId).emit("user_left", {
        userId: socket.id,
        users: getRoomUsers(oldRoomId),
      });
    }

    // Update user's room
    userData.roomId = newRoomId;
    users[socket.id] = userData;

    // Create new room if it doesn't exist
    if (!rooms[newRoomId]) {
      rooms[newRoomId] = [];
    }

    // Add user to new room
    rooms[newRoomId].push(socket.id);

    // Join socket.io new room
    socket.join(newRoomId);

    // Notify new room about user joining
    io.to(newRoomId).emit("user_joined", {
      userId: socket.id,
      username: userData.username,
      users: getRoomUsers(newRoomId),
    });

    // Send room notification
    socket.to(newRoomId).emit("message", {
      userId: "system",
      username: "System",
      text: `${userData.username} has joined the room`,
      time: new Date().toISOString(),
    });

    // Send current room users list to the switching user
    socket.emit("users_list", getRoomUsers(newRoomId));
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    const userData = users[socket.id];

    if (userData) {
      const { username, roomId } = userData;

      // Notify room users about disconnection
      socket.to(roomId).emit("message", {
        userId: "system",
        username: "System",
        text: `${username} has left the room`,
        time: new Date().toISOString(),
      });

      // Remove user from users list
      delete users[socket.id];

      // Remove user from room
      if (rooms[roomId]) {
        rooms[roomId] = rooms[roomId].filter((id) => id !== socket.id);

        // Update online users list for remaining room clients
        io.to(roomId).emit("user_left", {
          userId: socket.id,
          users: getRoomUsers(roomId),
        });
      }
    }

    console.log("Client disconnected:", socket.id);
  });

  // Helper function to get users in a room
  function getRoomUsers(roomId) {
    if (!rooms[roomId]) return [];

    return rooms[roomId].map((userId) => ({
      userId,
      username: users[userId]?.username,
    }));
  }
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
