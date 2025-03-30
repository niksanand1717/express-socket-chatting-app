// Description: This is a simple chat server using Express and Socket.io.
import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import cors from "cors";
import { fileURLToPath } from "url";
import { connectToDB } from "./db.config.js"; // MongoDB connection
import { Chat } from "./schema/chat.schema.js";

// Initialize express app
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins in development
    methods: ["GET", "POST"],
  },
});

// Create modern __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

// Store connected users and their rooms
const users = {};
const rooms = {};

// Socket.io connection handling
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  // Handle user joining a room
  socket.on("join_room", async ({ username, roomId }) => {
    users[socket.id] = { username, roomId };

    if (!rooms[roomId]) {
      rooms[roomId] = [];
    }

    rooms[roomId].push(socket.id);
    socket.join(roomId);

    // Fetch previous messages from MongoDB
    try {
      const previousMessages = await Chat.find({ roomId }).sort({
        timestamp: 1,
      });
      previousMessages.forEach((message) => {
        console.log(message.username + ":" + message.message);
      });
      socket.emit("previous_messages", previousMessages);
    } catch (err) {
      console.error("Error fetching previous messages:", err);
    }

    const roomUsers = getRoomUsers(roomId);

    io.to(roomId).emit("user_joined", {
      userId: socket.id,
      username,
      users: roomUsers,
    });

    socket.to(roomId).emit("message", {
      userId: "system",
      username: "System",
      text: `${username} has joined the room`,
      time: new Date().toISOString(),
    });
  });

  // Handle incoming messages
  socket.on("message", async (messageData) => {
    const userData = users[socket.id];
    if (!userData) return;

    const message = {
      userId: socket.id,
      username: userData.username,
      text: messageData.text,
      time: new Date().toISOString(),
    };

    // Save message to MongoDB
    const chatMessage = new Chat({
      roomId: userData.roomId,
      username: userData.username,
      message: messageData.text,
    });

    // Save message to MongoDB
    try {
      await chatMessage.save();
    } catch (err) {
      console.error("Error saving message:", err);
    }

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
  connectToDB();
  console.log(`Server running on port ${PORT}`);
});
