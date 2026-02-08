import React from "react";
import { motion } from "framer-motion";
import PlayerBubble from "./PlayerBubble";

interface Player {
  id: string;
  name: string;
  role?: string;
  canSpeak: boolean;
  isEliminated?: boolean;
}

interface PlayerCircleProps {
  isDay: boolean;
  players: Player[];
  speakingPlayers: Record<string, boolean>;
  currentSocketId?: string;
}

const PlayerCircle: React.FC<PlayerCircleProps> = ({
  isDay,
  players,
  speakingPlayers,
  currentSocketId,
}) => {
  const aliveCount = players.filter((p) => !p.isEliminated).length;
  const eliminatedCount = players.filter((p) => p.isEliminated).length;

  return (
    <div className="werewolf-table-wrapper">
      {/* Bannière de phase */}
      <motion.div
        className={`phase-banner ${isDay ? "phase-day" : "phase-night"}`}
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        <motion.span
          className="phase-icon"
          animate={{ rotate: isDay ? 0 : 180, scale: [1, 1.1, 1] }}
          transition={{ duration: 0.6 }}
        >
          {isDay ? "☀️" : "🌙"}
        </motion.span>
        <span className="phase-label">{isDay ? "Phase de Jour" : "Phase de Nuit"}</span>
        <div className="phase-stats">
          <span className="stat-alive">🟢 {aliveCount} en vie</span>
          {eliminatedCount > 0 && (
            <span className="stat-dead">💀 {eliminatedCount} éliminé{eliminatedCount > 1 ? "s" : ""}</span>
          )}
        </div>
      </motion.div>

      {/* Message si aucun joueur */}
      {players.length === 0 && (
        <motion.div
          className="empty-table"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <span className="text-5xl mb-3 block">🐺</span>
          <p className="text-gray-400 text-lg">En attente de joueurs...</p>
          <p className="text-gray-600 text-sm mt-1">Les joueurs apparaîtront ici</p>
        </motion.div>
      )}

      {/* Grille des joueurs */}
      {players.length > 0 && (
        <div className="players-grid">
          {players.map((player, index) => (
            <PlayerBubble
              key={player.id}
              id={player.id}
              name={player.name}
              role={player.role}
              canSpeak={player.canSpeak}
              isSpeaking={speakingPlayers[player.id] || false}
              isDay={isDay}
              isEliminated={player.isEliminated}
              index={index}
              isSelf={player.id === currentSocketId}
            />
          ))}
        </div>
      )}

      {/* Décoration de fond */}
      <div className="table-decoration">
        <div className={`table-glow ${isDay ? "glow-day" : "glow-night"}`} />
      </div>
    </div>
  );
};

export default PlayerCircle;
