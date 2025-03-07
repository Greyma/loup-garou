"use client";
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { registerUser, loginUser, createGame, joinGame, WatchGame } from "@/pages/api/home";

const buttonVariants = {
  hover: { scale: 1.1 },
  tap: { scale: 0.95 },
};

const playerCardVariants = {
  hidden: { opacity: 0, y: 50 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

const Home: React.FC = () => {
  const router = useRouter();
  const [isNameModalOpen, setNameModalOpen] = useState<boolean>(false);
  const [isRoleModalOpen, setRoleModalOpen] = useState<boolean>(false);
  const [isCodeModalOpen, setCodeModalOpen] = useState<boolean>(false);
  const [name, setName] = useState<string>("");
  const [code, setCode] = useState<string>("");
  const [role, setRole] = useState<"player" | "spectator" | null>(null);
  const [activeVisitors, setActiveVisitors] = useState<number>(0);
  const [players, setPlayers] = useState<{ id: string; name: string; role?: string }[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      setNameModalOpen(false);
      setRoleModalOpen(true);
    } else {
      setNameModalOpen(true);
    }

    const newSocket = io(process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000");
    setSocket(newSocket);

    newSocket.on("player_list", (playerList: { id: string; name: string; role?: string }[]) => {
      setPlayers(playerList);
      setActiveVisitors(playerList.length);
    });

    newSocket.on("user_joined", ({ userId }: { userId: string }) => {
      setPlayers((prev) =>
        prev.some((p) => p.id === userId)
          ? prev
          : [...prev, { id: userId, name: `Joueur ${userId.slice(0, 4)}`, role: "Inconnu" }]
      );
      setActiveVisitors((prev) => prev + 1);
    });

    newSocket.on("user_left", ({ userId }: { userId: string }) => {
      setPlayers((prev) => prev.filter((p) => p.id !== userId));
      setActiveVisitors((prev) => Math.max(prev - 1, 0));
    });

    return () => {
      newSocket.disconnect();
    };
  }, [router]);

  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      await registerUser(name, name); // À améliorer avec un vrai mot de passe
      const res = await loginUser(name, name);
      localStorage.setItem("token", res.data.token);
      setNameModalOpen(false);
      setRoleModalOpen(true);
    } catch (err) {
      console.error("Erreur d’authentification :", err);
      alert("Erreur lors de la connexion. Veuillez réessayer.");
    }
  };

  const handleRoleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!role) return;
    setRoleModalOpen(false);
    setCodeModalOpen(true);
  };

  const handleCreateGame = async () => {
    if (!socket) {
      alert("Connexion au serveur non établie. Réessayez.");
      return;
    }
    try {
      const gameCode: string = await createGame();
      console.log("Code reçu (createGame) :", gameCode); // Log pour débogage
      socket.emit("join_room", gameCode);
      router.push(`/game/${gameCode}`);
    } catch (err: any) {
      console.error("Erreur création partie :", err);
      alert("Impossible de créer la partie : " + (err.message || "Erreur inconnue"));
    }
  };

  const handleJoinGame = async () => {
    if (!socket || !code.trim()) {
      alert("Veuillez entrer un code valide.");
      return;
    }
    try {
      const gameCode: string = await joinGame(code);
      console.log("Code reçu (joinGame) :", gameCode); // Log pour débogage
      socket.emit("join_room", gameCode);
      router.push(`/game/${gameCode}`);
    } catch (err: any) {
      console.error("Erreur rejoindre partie :", err);
      alert("Erreur : " + (err.message || "Erreur inconnue"));
    }
  };

  const handleWatchGame = async () => {
    if (!socket || !code.trim()) {
      alert("Veuillez entrer un code valide.");
      return;
    }
    try {
      const gameCode: string = await WatchGame(code);
      console.log("Code reçu (joinGame) :", gameCode); // Log pour débogage
      socket.emit("join_room", gameCode);
      router.push(`/game/${gameCode}`);
    } catch (err: any) {
      console.error("Erreur rejoindre partie :", err);
      alert("Erreur : " + (err.message || "Erreur inconnue"));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 to-indigo-800 text-white">
      {isNameModalOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        >
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-white p-6 rounded-lg shadow-lg text-black max-w-md w-full"
          >
            <h2 className="text-xl font-bold mb-4">Entrez votre nom</h2>
            <form onSubmit={handleNameSubmit}>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2 border rounded mb-4 text-black"
                placeholder="Votre nom"
                required
              />
              <button
                type="submit"
                className="w-full bg-pink-600 text-white p-2 rounded hover:bg-pink-700"
              >
                Suivant
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}

      {isRoleModalOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        >
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-white p-6 rounded-lg shadow-lg text-black max-w-md w-full"
          >
            <h2 className="text-xl font-bold mb-4">Choisissez votre rôle</h2>
            <form onSubmit={handleRoleSubmit}>
              <div className="mb-4">
                <label className="block mb-2">
                  <input
                    type="radio"
                    value="player"
                    checked={role === "player"}
                    onChange={() => setRole("player")}
                  />
                  <span className="ml-2">Joueur</span>
                </label>
                <label className="block mb-2">
                  <input
                    type="radio"
                    value="spectator"
                    checked={role === "spectator"}
                    onChange={() => setRole("spectator")}
                  />
                  <span className="ml-2">Spectateur</span>
                </label>
              </div>
              <button
                type="submit"
                className="w-full bg-pink-600 text-white p-2 rounded hover:bg-pink-700"
              >
                Confirmer
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}

      {isCodeModalOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        >
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-white p-6 rounded-lg shadow-lg text-black max-w-md w-full"
          >
            <h2 className="text-xl font-bold mb-4">
              {role === "player" ? "Rejoindre ou créer une partie" : "Rejoindre en spectateur"}
            </h2>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Entrez le code de la partie"
              className="w-full p-2 border rounded mb-4 text-black"
            />
            <div className="flex gap-2">
              {role === "spectator" && (
                <button
                  onClick={handleWatchGame}
                  className="w-full bg-purple-600 text-white p-2 rounded hover:bg-purple-700"
                >
                  Rejoindre
                </button>
              )}

              {role === "player" && (
                <button
                  onClick={handleJoinGame}
                  className="w-full bg-purple-600 text-white p-2 rounded hover:bg-purple-700"
                >
                  Rejoindre
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}

      <div className="container mx-auto p-6">
        <motion.h1
          initial={{ y: -50, opacity: 0, rotate: -5 }}
          animate={{ y: 0, opacity: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 120, delay: 0.2 }}
          className="text-6xl font-bold text-center mb-4 bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent"
        >
          Loup-Garou
        </motion.h1>
        <motion.p
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-xl text-center mb-8 text-pink-200"
        >
          Rejoins une partie et plonge dans l’aventure !
        </motion.p>

        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="bg-white bg-opacity-10 p-6 rounded-lg shadow-lg backdrop-blur-sm max-w-3xl mx-auto"
        >
          <h2 className="text-2xl font-bold mb-4 text-pink-200">Salon d’attente</h2>
          <p className="mb-4 text-pink-200">Visiteurs actifs : {activeVisitors}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {players.map((player) => (
              <motion.div
                key={player.id}
                variants={playerCardVariants}
                initial="hidden"
                animate="visible"
                className="bg-gradient-to-r from-pink-600 to-purple-600 p-4 rounded-lg flex items-center shadow-lg"
              >
                <span className="text-2xl mr-2">👤</span>
                <span className="text-white">{player.name}</span>
              </motion.div>
            ))}
          </div>
          <motion.button
            onClick={() => setNameModalOpen(true)}
            variants={buttonVariants}
            whileHover="hover"
            whileTap="tap"
            className="mt-6 w-full bg-gradient-to-r from-pink-500 to-purple-500 text-white p-3 rounded-lg shadow-lg hover:from-pink-600 hover:to-purple-600 transition-all"
          >
            Rejoindre la partie
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
};

export default Home;