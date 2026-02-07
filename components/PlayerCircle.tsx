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
}

const PlayerCircle: React.FC<PlayerCircleProps> = ({
  isDay,
  players,
  speakingPlayers,
}) => {
  // Configuration du cercle - responsive
  const containerSize = 500;
  // Adapter le rayon selon le nombre de joueurs pour éviter le débordement
  const baseRadius = Math.min(190, 80 + players.length * 12);
  const radius = Math.min(baseRadius, (containerSize / 2) - 65);
  const centerX = containerSize / 2;
  const centerY = containerSize / 2;
  const tableSize = 140;

  // Décalage pour commencer en haut (-90 degrés)
  const startAngle = -Math.PI / 2;

  return (
    <div
      className="relative mx-auto w-full"
      style={{ maxWidth: containerSize, aspectRatio: '1 / 1', overflow: 'hidden' }}
    >
      {/* Table ronde centrale */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="game-table absolute rounded-full flex items-center justify-center"
        style={{
          width: tableSize,
          height: tableSize,
          left: centerX - tableSize / 2,
          top: centerY - tableSize / 2,
        }}
      >
        {/* Décoration de la table */}
        <div className="text-center">
          <motion.div
            animate={{
              rotate: isDay ? 0 : 180,
              scale: [1, 1.05, 1],
            }}
            transition={{ duration: 0.5 }}
            className="text-4xl"
          >
            {isDay ? "☀️" : "🌙"}
          </motion.div>
          <span className="text-xs text-amber-200/70 mt-1 block">
            {isDay ? "Jour" : "Nuit"}
          </span>
          <span className="text-xs text-amber-100/50 block">
            {players.length} joueur{players.length > 1 ? "s" : ""}
          </span>
        </div>
      </motion.div>

      {/* Message si aucun joueur */}
      {players.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-gray-400 text-lg">En attente de joueurs...</p>
        </div>
      )}

      {/* Joueurs positionnés en cercle */}
      {players.map((player, index) => {
        const angle = startAngle + (index / players.length) * 2 * Math.PI;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);

        // Position ajustée pour centrer la bulle
        const bubbleWidth = 90;
        const bubbleHeight = 110;

        return (
          <PlayerBubble
            key={player.id}
            id={player.id}
            name={player.name}
            role={player.role}
            canSpeak={player.canSpeak}
            isSpeaking={speakingPlayers[player.id] || false}
            isDay={isDay}
            isEliminated={player.isEliminated}
            style={{
              left: `clamp(0px, ${x - bubbleWidth / 2}px, ${containerSize - bubbleWidth}px)`,
              top: `clamp(0px, ${y - bubbleHeight / 2}px, ${containerSize - bubbleHeight}px)`,
            }}
          />
        );
      })}

      {/* Lignes de connexion décoratives (optionnel) */}
      <svg
        className="absolute inset-0 pointer-events-none"
        width="100%"
        height="100%"
        viewBox={`0 0 ${containerSize} ${containerSize}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <radialGradient id="tableGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(139, 69, 19, 0.3)" />
            <stop offset="100%" stopColor="rgba(139, 69, 19, 0)" />
          </radialGradient>
        </defs>
        {/* Cercle décoratif autour de la table */}
        <circle
          cx={centerX}
          cy={centerY}
          r={tableSize / 2 + 20}
          fill="none"
          stroke="rgba(139, 90, 43, 0.3)"
          strokeWidth="2"
          strokeDasharray="8 4"
        />
        {/* Halo autour de la table */}
        <circle
          cx={centerX}
          cy={centerY}
          r={tableSize / 2 + 40}
          fill="url(#tableGlow)"
        />
      </svg>
    </div>
  );
};

export default PlayerCircle;
