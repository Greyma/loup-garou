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
  index?: number;
  style?: React.CSSProperties;
  isSelf?: boolean;
}

// Générer une couleur basée sur le nom du joueur
const getAvatarGradient = (name: string): string => {
  const colors = [
    "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
    "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
    "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
    "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)",
    "linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)",
    "linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)",
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

// Icône selon le rôle
const getRoleIcon = (role?: string): string => {
  if (!role) return "❓";
  const r = role.toLowerCase();
  if (r.includes("loup")) return "🐺";
  if (r.includes("sorcière") || r.includes("sorciere")) return "🧙‍♀️";
  if (r.includes("voyante")) return "🔮";
  if (r.includes("chasseur")) return "🏹";
  if (r.includes("cupidon")) return "💘";
  if (r.includes("petite fille")) return "👧";
  if (r.includes("ancien")) return "👴";
  if (r.includes("salvateur")) return "🛡️";
  if (r.includes("villageois")) return "👤";
  return "🎭";
};

const PlayerBubble: React.FC<PlayerBubbleProps> = ({
  name,
  role,
  canSpeak,
  isSpeaking,
  isDay,
  isEliminated = false,
  index = 0,
  isSelf = false,
}) => {
  const initials = getInitials(name);
  const avatarGradient = getAvatarGradient(name);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, delay: index * 0.05, type: "spring", stiffness: 200 }}
      className={`player-card ${isEliminated ? "player-card--eliminated" : ""} ${
        canSpeak ? "player-card--active" : ""
      } ${isSpeaking && !isEliminated && isDay ? "player-card--speaking" : ""}`}
    >
      {/* Indicateur de parole animé (masqué la nuit pour ne pas révéler qui parle) */}
      {isSpeaking && !isEliminated && isDay && (
        <div className="speaking-indicator">
          <span className="speaking-bar" style={{ animationDelay: "0s" }} />
          <span className="speaking-bar" style={{ animationDelay: "0.15s" }} />
          <span className="speaking-bar" style={{ animationDelay: "0.3s" }} />
          <span className="speaking-bar" style={{ animationDelay: "0.15s" }} />
          <span className="speaking-bar" style={{ animationDelay: "0s" }} />
        </div>
      )}

      {/* Avatar */}
      <div className="player-card__avatar-wrapper">
        <div
          className="player-card__avatar"
          style={{ background: isEliminated ? "#374151" : avatarGradient }}
        >
          {isEliminated ? "💀" : initials}
        </div>
        {/* Status dot */}
        <span
          className={`player-card__status ${
            isEliminated
              ? "player-card__status--dead"
              : canSpeak
              ? "player-card__status--active"
              : "player-card__status--muted"
          }`}
        />
      </div>

      {/* Infos */}
      <div className="player-card__info">
        <span className="player-card__name" title={name}>
          {name}
          {isSelf && (
            <span className="ml-1 text-xs text-amber-400">(vous)</span>
          )}
        </span>
        <span className="player-card__role">
          {isDay ? (
            isSelf && role ? (
              <>
                <span className="player-card__role-icon">{getRoleIcon(role)}</span>
                {role}
              </>
            ) : (
              <>
                <span className="player-card__role-icon">👤</span>
                Villageois
              </>
            )
          ) : (
            <>
              <span className="player-card__role-icon">🎭</span>
              ???
            </>
          )}
        </span>
      </div>

      {/* Badge éliminé */}
      {isEliminated && (
        <div className="player-card__eliminated-badge">ÉLIMINÉ</div>
      )}
    </motion.div>
  );
};

export default PlayerBubble;
