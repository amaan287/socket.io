import React, { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import "./App.css";

// Types for better type safety
interface User {
  id: string;
  username: string;
  joinedAt: number;
}

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  message: string;
  timestamp: number;
}

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [username, setUsername] = useState("");
  const [roomId, setRoomId] = useState("");
  const [joined, setJoined] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize socket connection
  useEffect(() => {
    const newSocket = io("http://localhost:3000");
    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Set up socket event listeners
  useEffect(() => {
    if (!socket) return;

    socket.on("room-users", (roomUsers: User[]) => {
      setUsers(roomUsers);
    });

    socket.on("user-joined", (user: User) => {
      setUsers((prev) => [...prev, user]);
      
      // Add system message when user joins
      const systemMessage: Message = {
        id: `system-${Date.now()}`,
        senderId: "system",
        senderName: "System",
        message: `${user.username} has joined the room`,
        timestamp: Date.now()
      };
      
      setMessages(prev => [...prev, systemMessage]);
    });

    socket.on("user-disconnected", (userId: string) => {
      const disconnectedUser = users.find(user => user.id === userId);
      setUsers((prev) => prev.filter((user) => user.id !== userId));
      
      // Add system message when user leaves
      if (disconnectedUser) {
        const systemMessage: Message = {
          id: `system-${Date.now()}`,
          senderId: "system",
          senderName: "System",
          message: `${disconnectedUser.username} has left the room`,
          timestamp: Date.now()
        };
        
        setMessages(prev => [...prev, systemMessage]);
      }
    });

    socket.on("new-message", (messageData: Message) => {
      setMessages((prev) => [...prev, messageData]);
    });
    
    socket.on("user-typing", ({ userId }) => {
      setTypingUsers(prev => {
        if (!prev.includes(userId)) {
          return [...prev, userId];
        }
        return prev;
      });
    });
    
    socket.on("user-stopped-typing", ({ userId }) => {
      setTypingUsers(prev => prev.filter(id => id !== userId));
    });

    return () => {
      socket.off("room-users");
      socket.off("user-joined");
      socket.off("user-disconnected");
      socket.off("new-message");
      socket.off("user-typing");
      socket.off("user-stopped-typing");
    };
  }, [socket, users]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const joinRoom = () => {
    if (!socket || !username || !roomId) return;

    socket.emit("join-room", { roomId, username });
    setJoined(true);
  };

  const sendMessage = () => {
    if (!socket || !newMessage || !roomId) return;

    // Find the current user
    const currentUser = users.find(user => user.id === socket?.id);
    
    if (!currentUser) return;
    
    // Add message to own list immediately
    const messageData: Message = {
      id: Date.now().toString(),
      senderId: socket.id,
      senderName: currentUser.username,
      message: newMessage,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, messageData]);

    // Send to server to broadcast to others
    socket.emit("send-message", { roomId, message: newMessage });

    // Clear input and typing indicator
    setNewMessage("");
    setIsTyping(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      socket.emit("typing-stop", { roomId });
    }
  };
  
  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    
    // Handle typing indicator
    if (!isTyping && socket) {
      setIsTyping(true);
      socket.emit("typing-start", { roomId });
    }
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set new timeout
    typingTimeoutRef.current = setTimeout(() => {
      if (socket && isTyping) {
        setIsTyping(false);
        socket.emit("typing-stop", { roomId });
      }
    }, 2000);
  };
  
  // Format timestamp
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  // Get typing indicator text
  const getTypingIndicatorText = () => {
    if (typingUsers.length === 0) return "";
    
    const typingUsernames = typingUsers.map(userId => {
      const user = users.find(u => u.id === userId);
      return user ? user.username : "Someone";
    });
    
    if (typingUsernames.length === 1) {
      return `${typingUsernames[0]} is typing...`;
    } else if (typingUsernames.length === 2) {
      return `${typingUsernames[0]} and ${typingUsernames[1]} are typing...`;
    } else {
      return "Several people are typing...";
    }
  };

  if (!joined) {
    return (
      <div className="join-container">
        <div className="join-form">
          <h1>Join a Chat Room</h1>
          <div className="input-group">
            <label htmlFor="username">Your Name</label>
            <input
              id="username"
              type="text"
              placeholder="Enter your name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="input-group">
            <label htmlFor="roomId">Room ID</label>
            <input
              id="roomId"
              type="text"
              placeholder="Enter room ID"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
            />
          </div>
          <button 
            className="join-button"
            onClick={joinRoom}
            disabled={!username || !roomId}
          >
            Join Room
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-container">
      <div className="chat-sidebar">
        <div className="room-info">
          <h2>Room: {roomId}</h2>
          <p>Welcome, {username}!</p>
        </div>
        <div className="users-list">
          <h3>Users in Room</h3>
          <ul>
            {users.map((user) => (
              <li key={user.id} className={user.id === socket?.id ? "current-user" : ""}>
                <span className="user-status"></span>
                {user.username}
                {user.id === socket?.id ? " (You)" : ""}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="chat-main">
        <div className="messages-container">
          <div className="messages">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`message ${
                  msg.senderId === "system" 
                    ? "system-message" 
                    : msg.senderId === socket?.id 
                      ? "own-message" 
                      : "other-message"
                }`}
              >
                {msg.senderId !== "system" && (
                  <div className="message-sender">
                    {msg.senderId === socket?.id ? "You" : msg.senderName}
                  </div>
                )}
                <div className="message-bubble">
                  <div className="message-content">{msg.message}</div>
                  <div className="message-time">{formatTime(msg.timestamp)}</div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          
          {typingUsers.length > 0 && (
            <div className="typing-indicator">
              {getTypingIndicatorText()}
            </div>
          )}
        </div>

        <div className="message-input-container">
          <input
            type="text"
            placeholder="Type a message..."
            value={newMessage}
            onChange={handleTyping}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          />
          <button 
            className="send-button"
            onClick={sendMessage}
            disabled={!newMessage.trim()}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
