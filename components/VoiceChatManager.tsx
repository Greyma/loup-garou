import { useEffect, useCallback } from "react";
import { Socket } from "socket.io-client";

interface Player {
  id: string;
  name: string;
  role?: string;
  canSpeak: boolean;
}

interface VoiceChatManagerProps {
  socket: Socket | null;
  gameCode: string;
  players: Player[];
  gameStatus: "in_progress" | "paused" | "stopped";
}

/**
 * VoiceChatManager - Gère les permissions de parole des joueurs
 * Ce composant ne rend rien visuellement, il gère uniquement la logique
 * des permissions de voix basée sur le statut du jeu.
 */
const VoiceChatManager: React.FC<VoiceChatManagerProps> = ({
  socket,
  gameCode,
  players,
  gameStatus,
}) => {
  const updateVoicePermissions = useCallback(() => {
    if (!socket) return;

    if (gameStatus === "paused" || gameStatus === "stopped") {
      // Tout le monde peut parler en pause ou arrêt
      players.forEach((player) => {
        socket.emit("toggle_voice", {
          roomCode: gameCode,
          playerId: player.id,
          canSpeak: true,
        });
      });
    } else if (gameStatus === "in_progress") {
      // Seuls les joueurs avec canSpeak = true peuvent parler
      players.forEach((player) => {
        socket.emit("toggle_voice", {
          roomCode: gameCode,
          playerId: player.id,
          canSpeak: player.canSpeak,
        });
      });
    }
  }, [socket, gameCode, players, gameStatus]);

  useEffect(() => {
    updateVoicePermissions();
  }, [updateVoicePermissions]);

  // Ce composant ne rend rien - il gère uniquement la logique
  return null;
};

export default VoiceChatManager;
