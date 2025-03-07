import React from "react";
import { motion } from "framer-motion";
import VoiceChatManager from "./VoiceChatManager";
import { Socket } from "socket.io-client";

interface Player {
  id: string;
  name: string;
  role?: string;
  canSpeak: boolean;
}

interface PlayerCircleProps {
  isDay: boolean;
  socket: Socket | null;
  gameCode: string;
  players: Player[];
  gameStatus: "in_progress" | "paused" | "stopped";
}

const PlayerCircle: React.FC<PlayerCircleProps> = ({ isDay, socket, gameCode, players, gameStatus }) => {
  const radius = 150; // Rayon du cercle en pixels
  const centerX = 200; // Centre X du cercle
  const centerY = 200; // Centre Y du cercle

  const playerVariants = {
    hidden: { opacity: 0, scale: 0 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.3 } },
  };

  return (
    <div className="relative w-[400px] h-[400px] flex items-center justify-center">
      {players.length === 0 ? (
        <p className="text-gray-400">Aucun joueur...</p>
      ) : (
        <>
          {players.map((player, index) => {
            const angle = (index / players.length) * 2 * Math.PI; // Position en radians
            const x = centerX + radius * Math.cos(angle) - 40; // -40 pour centrer le joueur
            const y = centerY + radius * Math.sin(angle) - 40;

            return (
              <motion.div
                key={player.id}
                variants={playerVariants}
                initial="hidden"
                animate="visible"
                className="absolute w-20 h-20 bg-purple-700 bg-opacity-50 rounded-full flex flex-col items-center justify-center border border-purple-500"
                style={{ left: `${x}px`, top: `${y}px` }}
              >
              <span className="font-medium text-sm">{player.name}</span>
              <span className="text-xs text-purple-300">
              {player.name} - {player.canSpeak ? "🟢" : "🔴"}
              {isDay ? player.role || "Inconnu" : "??"}
              </span>
                <VoiceChatManager
                  socket={socket}
                  gameCode={gameCode}
                  players={players}
                  gameStatus={gameStatus}
                />
              </motion.div>
            );
          })}
        </>
      )}
    </div>
  );
};

export default PlayerCircle;