import { Server } from "socket.io";
const ws = new Server(3000, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

ws.on("connection", (socket) => {
  socket.emit("Hello", "world");

  socket.on("message", (msg) => {
    console.log(msg);
    socket.on("disconnected", () => {
      console.log("Client disconnected");
    });
  });
});
