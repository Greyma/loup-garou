import React from "react";
import { motion } from "framer-motion";

interface PlayerBubbleProps {
  id: string;
  name: string;
  role?: string;
  canSpeak: boolean;
  isSpeaking: boolean;
  isDay: boolean;
  isEliminated?: boolean;
  style?: React.CSSProperties;
}

// Générer une couleur basée sur le nom du joueur
const getAvatarColor = (name: string): string => {
  const colors = [
    "from-purple-500 to-indigo-600",
    "from-blue-500 to-cyan-600",
    "from-green-500 to-emerald-600",
    "from-yellow-500 to-orange-600",
    "from-red-500 to-pink-600",
    "from-pink-500 to-rose-600",
    "from-indigo-500 to-violet-600",
    "from-teal-500 to-green-600",
  ];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
};

// Extraire les initiales du nom
const getInitials = (name: string): string => {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

const PlayerBubble: React.FC<PlayerBubbleProps> = ({
  name,
  role,
  canSpeak,
  isSpeaking,
  isDay,
  isEliminated = false,
  style,
}) => {
  const initials = getInitials(name);
  const avatarColor = getAvatarColor(name);

  const bubbleVariants = {
    hidden: { opacity: 0, scale: 0 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.4, type: "spring", stiffness: 200 },
    },
  };

  return (
    <motion.div
      variants={bubbleVariants}
      initial="hidden"
      animate="visible"
      className={`player-bubble absolute flex flex-col items-center ${
        isEliminated ? "player-eliminated" : ""
      }`}
      style={style}
    >
      {/* Container de la bulle */}
      <div
        className={`relative flex flex-col items-center justify-center p-3 rounded-2xl
          bg-black/60 backdrop-blur-sm border-2 transition-all duration-300
          ${canSpeak ? "player-active-turn border-green-500" : "border-gray-600"}
          ${isSpeaking && !isEliminated ? "player-speaking" : ""}
        `}
      >
        {/* Animation de parole - cercles qui s'étendent */}
        {isSpeaking && !isEliminated && (
          <>
            <div className="speaking-ring" />
            <div
              className="speaking-ring"
              style={{ animationDelay: "0.3s" }}
            />
          </>
        )}

        {/* Avatar avec initiales */}
        <div
          className={`player-avatar bg-gradient-to-br ${avatarColor}
            w-14 h-14 rounded-full flex items-center justify-center
            text-white font-bold text-lg shadow-lg
            ${isEliminated ? "grayscale" : ""}
          `}
        >
          {initials}
        </div>

        {/* Nom du joueur */}
        <span className="mt-2 text-sm font-semibold text-white truncate max-w-[80px]">
          {name}
        </span>

        {/* Rôle (visible uniquement le jour) */}
        <span className="text-xs text-gray-400 mt-0.5">
          {isDay && role ? role : "???"}
        </span>

        {/* Indicateur de permission de parole */}
        <div className="flex items-center gap-1 mt-1">
          <span
            className={`w-2 h-2 rounded-full ${
              canSpeak ? "bg-green-500" : "bg-red-500"
            }`}
          />
          <span className="text-xs text-gray-500">
            {canSpeak ? "Peut parler" : "Muet"}
          </span>
        </div>
      </div>
    </motion.div>
  );
};

export default PlayerBubble;
