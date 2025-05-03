import { useEffect, useState } from "react";
import { io } from "socket.io-client";

function App() {
  const [message, setMessage] = useState("");
  function sendMessage() {
    const socket = io("ws://localhost:3000");
    socket.on("Hello", (msg) => {
      console.log(msg);
    });

    socket.emit("message", message);
    return () => {
      socket.disconnect();
    };
  }
  useEffect(() => {}, []);

  return (
    <>
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <button onClick={sendMessage}>Send</button>
    </>
  );
}

export default App;
