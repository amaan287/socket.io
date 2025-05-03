import { Server } from "socket.io";
import express from "express";
import { createServer } from "http";

const port = 3000;
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Track users in rooms
const rooms = new Map();

io.on("connect", (socket) => {
  console.log("a user connected " + socket.id);

  let currentRoom: string | null = null;

  socket.on("disconnect", () => {
    console.log("User disconnected");

    // Remove user from room when they disconnect
    if (currentRoom && rooms.has(currentRoom)) {
      const roomUsers = rooms.get(currentRoom);
      rooms.set(
        currentRoom,
        roomUsers.filter((user: { id: string }) => user.id !== socket.id)
      );

      // Notify others in the room that this user left
      socket.to(currentRoom).emit("user-disconnected", socket.id);
    }
  });

  // Join a room with a username
  socket.on("join-room", ({ roomId, username }) => {
    // Leave previous room if any
    if (currentRoom) {
      socket.leave(currentRoom);

      // Remove from previous room's user list
      if (rooms.has(currentRoom)) {
        const roomUsers = rooms.get(currentRoom);
        rooms.set(
          currentRoom,
          roomUsers.filter((user: { id: string }) => user.id !== socket.id)
        );
      }
    }

    // Join new room
    socket.join(roomId);
    currentRoom = roomId;

    // Add user to room's user list
    if (!rooms.has(roomId)) {
      rooms.set(roomId, []);
    }
    
    // Add user with timestamp for "user joined" message
    const newUser = { 
      id: socket.id, 
      username, 
      joinedAt: Date.now() 
    };
    
    rooms.get(roomId).push(newUser);

    // Get existing users in this room
    const usersInRoom = rooms.get(roomId);

    // Send existing users list to the new user
    socket.emit("room-users", usersInRoom);

    // Notify others that this user joined
    socket.to(roomId).emit("user-joined", newUser);

    console.log(`User ${socket.id} (${username}) joined room ${roomId}`);
  });

  // Handle chat messages
  socket.on("send-message", ({ roomId, message }) => {
    // Get user info from rooms
    const roomUsers = rooms.get(roomId) || [];
    const sender = roomUsers.find((user: { id: string }) => user.id === socket.id);
    
    if (!sender) return;
    
    const messageData = {
      id: Date.now().toString(),
      senderId: socket.id,
      senderName: sender.username,
      message,
      timestamp: Date.now(),
    };
    
    // Broadcast to everyone in the room except sender
    socket.to(roomId).emit("new-message", messageData);
  });

  // User typing indicator
  socket.on("typing-start", ({ roomId }) => {
    socket.to(roomId).emit("user-typing", { userId: socket.id });
  });

  socket.on("typing-stop", ({ roomId }) => {
    socket.to(roomId).emit("user-stopped-typing", { userId: socket.id });
  });
});

httpServer.listen(port, () => {
  console.log("server is running on port 3000");
});
