import React from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Socket } from "socket.io-client";
import { startGame } from "@/pages/api/home";

const buttonVariants = {
  hover: { scale: 1.05, boxShadow: "0 0 10px rgba(255, 0, 0, 0.5)" },
  tap: { scale: 0.95 },
};

interface User {
  id: string;
  name: string;
  role?: string;
}

interface GameLobbyProps {
  socket: Socket | null;
  gameCode: string;
  players: User[];
  spectators: User[];
  maxPlayers: number;
}

const GameLobby: React.FC<GameLobbyProps> = ({ socket, gameCode, players, spectators, maxPlayers }) => {
  const router = useRouter();

  const handleStartGame = async () => {
    if (!socket || !gameCode) {
      alert("Créez d’abord une partie !");
      return;
    }
    try {
      await startGame(gameCode);
      router.push(`/narrator/${gameCode}`); // Redirige vers la page de supervision
    } catch (err) {
      console.error("Erreur démarrage partie :", err);
      alert("Erreur : " + (err instanceof Error ? err.message : "Impossible de démarrer la partie"));
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="mirror-effect bg-black/80 p-8 rounded-xl border-2 border-red-600 backdrop-blur-sm mb-6"
    >
      <h2 className="text-3xl font-bold mb-6 text-red-500">Partie en attente : {gameCode}</h2>
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-red-500 mb-4">
          Joueurs ({players.length}/{maxPlayers}) :
        </h3>
        {players.map((player) => (
          <div
            key={player.id}
            className="py-3 px-4 bg-black/50 rounded-lg border border-red-600/50 mb-2 text-red-200"
          >
            {player.name}
          </div>
        ))}
        <h3 className="text-2xl font-bold text-red-500 mt-6 mb-4">
          Spectateurs ({spectators.length}) :
        </h3>
        {spectators.map((spectator) => (
          <div
            key={spectator.id}
            className="py-3 px-4 bg-black/50 rounded-lg border border-red-600/50 mb-2 text-red-200"
          >
            {spectator.name}
          </div>
        ))}
      </div>
      <motion.button
        onClick={handleStartGame}
        variants={buttonVariants}
        whileHover="hover"
        whileTap="tap"
        disabled={players.length === 0}
        className={`w-full bg-red-800/60 hover:bg-red-700/80 text-red-100 py-3 rounded-lg transition-all ${
          players.length === 0 ? "opacity-50 cursor-not-allowed" : ""
        }`}
      >
        Lancer la partie
      </motion.button>
    </motion.div>
  );
};

export default GameLobby;