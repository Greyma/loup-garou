import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

interface ChatProps {
  gameId: string;
}

const Chat: React.FC<ChatProps> = ({ gameId }) => {
  const [messages, setMessages] = useState<string[]>([]);
  const [input, setInput] = useState("");

  useEffect(() => {
    const socket: Socket = io(`${process.env.NEXT_PUBLIC_BACKEND_URL}/chat`);
    socket.on("message", (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    return () => {
      socket.disconnect();
    };
  }, [gameId]);

  const sendMessage = () => {
    const socket: Socket = io();
    socket.emit("message", input);
    setInput("");
  };

  return (
    <div>
      <div>
        {messages.map((msg, index) => (
          <div key={index}>{msg}</div>
        ))}
      </div>
      <input value={input} onChange={(e) => setInput(e.target.value)} />
      <button onClick={sendMessage}>Envoyer</button>
    </div>
  );
};

export default Chat;