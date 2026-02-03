import React, { useEffect, useState, useRef, useCallback } from "react";
import { Socket } from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";

interface Message {
  id: string;
  sender: string;
  content: string;
  timestamp: Date;
  isSystem?: boolean;
}

interface ChatProps {
  socket: Socket | null;
  gameCode: string;
  userName: string;
}

const Chat: React.FC<ChatProps> = ({ socket, gameCode, userName }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isExpanded, setIsExpanded] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll vers le bas quand nouveaux messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (!socket) return;

    // Rejoindre le chat de la partie
    socket.emit("join_chat", { gameCode, userName });

    // Écouter les messages
    socket.on("chat_message", (message: Message) => {
      setMessages((prev) => [...prev, { ...message, timestamp: new Date(message.timestamp) }]);
    });

    // Message système quand quelqu'un rejoint
    socket.on("chat_user_joined", ({ userName: joinedUser }: { userName: string }) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `system-${Date.now()}`,
          sender: "Système",
          content: `${joinedUser} a rejoint le chat`,
          timestamp: new Date(),
          isSystem: true,
        },
      ]);
    });

    // Message système quand quelqu'un quitte
    socket.on("chat_user_left", ({ userName: leftUser }: { userName: string }) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `system-${Date.now()}`,
          sender: "Système",
          content: `${leftUser} a quitté le chat`,
          timestamp: new Date(),
          isSystem: true,
        },
      ]);
    });

    return () => {
      socket.off("chat_message");
      socket.off("chat_user_joined");
      socket.off("chat_user_left");
    };
  }, [socket, gameCode, userName]);

  const sendMessage = useCallback(() => {
    if (!socket || !input.trim()) return;

    const message: Omit<Message, "id"> = {
      sender: userName,
      content: input.trim(),
      timestamp: new Date(),
    };

    socket.emit("send_chat_message", { gameCode, message });
    setInput("");
    inputRef.current?.focus();
  }, [socket, input, gameCode, userName]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex flex-col bg-black/60 backdrop-blur-md rounded-2xl border border-purple-500/30 overflow-hidden"
      style={{ width: "320px", maxHeight: isExpanded ? "500px" : "50px" }}
    >
      {/* En-tête du chat */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-purple-900/50 cursor-pointer border-b border-purple-500/30"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-purple-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          <span className="font-semibold text-purple-200">Chat Spectateurs</span>
          {messages.length > 0 && (
            <span className="bg-purple-500 text-white text-xs px-2 py-0.5 rounded-full">
              {messages.length}
            </span>
          )}
        </div>
        <motion.svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 text-purple-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          animate={{ rotate: isExpanded ? 180 : 0 }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </motion.svg>
      </div>

      {/* Corps du chat */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col flex-1 overflow-hidden"
          >
            {/* Zone des messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2" style={{ maxHeight: "350px" }}>
              {messages.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-12 w-12 mx-auto mb-2 opacity-50"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                  <p className="text-sm">Aucun message</p>
                  <p className="text-xs">Soyez le premier à commenter !</p>
                </div>
              ) : (
                messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`${
                      message.isSystem
                        ? "text-center"
                        : message.sender === userName
                        ? "text-right"
                        : "text-left"
                    }`}
                  >
                    {message.isSystem ? (
                      <span className="text-xs text-gray-500 italic">{message.content}</span>
                    ) : (
                      <div
                        className={`inline-block max-w-[85%] ${
                          message.sender === userName ? "bg-purple-600/80" : "bg-gray-700/80"
                        } rounded-2xl px-3 py-2`}
                      >
                        {message.sender !== userName && (
                          <p className="text-xs font-semibold text-purple-300 mb-0.5">
                            {message.sender}
                          </p>
                        )}
                        <p className="text-sm text-white break-words">{message.content}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {formatTime(message.timestamp)}
                        </p>
                      </div>
                    )}
                  </motion.div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Zone de saisie */}
            <div className="p-3 border-t border-purple-500/30 bg-black/40">
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Écrire un message..."
                  className="flex-1 bg-gray-800/80 text-white text-sm px-4 py-2 rounded-full border border-gray-600 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 placeholder-gray-500"
                  maxLength={200}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim()}
                  className={`p-2 rounded-full transition-all ${
                    input.trim()
                      ? "bg-purple-600 hover:bg-purple-500 text-white"
                      : "bg-gray-700 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                    />
                  </svg>
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1 text-right">{input.length}/200</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Chat;
