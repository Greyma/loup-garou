"use client";
import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { io, Socket } from "socket.io-client";
import PlayerCircle from "@/components/PlayerCircle";
import SpectatorList from "@/components/SpectatorList";
import GameStatusControls from "@/components/GameStatusControls";
// Styles globaux pour les effets spéciaux
const globalStyles = `
  .halloween-bg-day {
    background-image: 
      radial-gradient(circle at 100% 100%, rgba(255,0,0,0.1) 0%, rgba(0,0,0,0) 20%),
      linear-gradient(45deg, rgba(0,0,0,0.8), rgba(70,0,0,0.8)),
      url('background-day.avif'); /* Image de fond pour le jour */
    background-size: cover;
    background-blend-mode: multiply;
  }

  .halloween-bg-night {
    background-image: 
      radial-gradient(circle at 100% 100%, rgba(255,0,0,0.1) 0%, rgba(0,0,0,0) 20%),
      linear-gradient(45deg, rgba(0,0,0,0.8), rgba(70,0,0,0.8)),
      url('background-night.avif'); /* Image de fond pour la nuit */
    background-size: cover;
    background-blend-mode: multiply;
    filter: brightness(0.7);
  }

  .mirror-effect {
    transform: perspective(1000px) rotateX(10deg) scale(0.95);
    box-shadow: 0 0 20px rgba(255,0,0,0.4);
    position: relative;
    overflow: hidden;
  }

  .mirror-effect::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    height: 50%;
    background: linear-gradient(to bottom, rgba(255,255,255,0.1) 0%, rgba(0,0,0,0.5) 100%);
    transform: rotateX(180deg) translateY(100%);
    pointer-events: none; /* Empêche les interactions */
  }

  @media (max-width: 768px) {
    .responsive-flex {
      flex-direction: column;
    }
  }
`;

interface Player {
  id: string;
  name: string;
  role?: string;
  canSpeak: boolean;
}

const GamePage = () => {
  const params = useParams();
  const gameCode = Array.isArray(params?.id) ? params.id[0] : params?.id ?? "";
  const [socket, setSocket] = useState<Socket | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [spectators, setSpectators] = useState<Player[]>([]);
  const [gameStatus, setGameStatus] = useState<"in_progress" | "paused" | "stopped">("in_progress");
  const [isDay, setIsDay] = useState<boolean>(true);

  useEffect(() => {
    const newSocket = io(process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000");
    setSocket(newSocket);

    if (gameCode) {
      newSocket.emit("join_room", gameCode);
    }

    newSocket.on("player_list", (playerList: Player[]) => {
      setPlayers(playerList.filter((p) => p.role !== "spectator"));
      setSpectators(playerList.filter((p) => p.role === "spectator"));
    });

    newSocket.on("user_joined", ({ userId, role }: { userId: string; role?: string }) => {
      const userName = `Utilisateur ${userId.slice(0, 4)}`;
      const newUser = { id: userId, name: userName, role, canSpeak: false };
      if (role === "spectator") {
        setSpectators((prev) => (prev.some((s) => s.id === userId) ? prev : [...prev, newUser]));
      } else {
        setPlayers((prev) => (prev.some((p) => p.id === userId) ? prev : [...prev, newUser]));
      }
    });

    newSocket.on("user_left", ({ userId }: { userId: string }) => {
      setPlayers((prev) => prev.filter((p) => p.id !== userId));
      setSpectators((prev) => prev.filter((s) => s.id !== userId));
    });

    newSocket.on("game_status", (status: "in_progress" | "paused" | "stopped") => {
      setGameStatus(status);
    });

    newSocket.on("day_night_updated", ({ isDay }: { isDay: boolean }) => {
      setIsDay(isDay);
    });

    newSocket.on("voice_updated", ({ playerId, canSpeak }: { playerId: string; canSpeak: boolean }) => {
      setPlayers((prev) => prev.map((p) => (p.id === playerId ? { ...p, canSpeak } : p)));
    });

    return () => {
      newSocket.disconnect();
    };
  }, [gameCode]);

  const themeClass = isDay ? "halloween-bg-day" : "halloween-bg-night";

  return (
    <>
      <style>{globalStyles}</style>
      <div className={`min-h-screen text-white p-6 transition-all duration-500 ${themeClass}`}>
        <div className="max-w-7xl mx-auto flex flex-col gap-6">
          <GameStatusControls socket={socket} gameCode={gameCode} gameStatus={gameStatus} isDay={isDay} />
          <div className="flex justify-around gap-6 responsive-flex">
            <div className="mirror-effect bg-black/50 p-6 rounded-xl border-2 border-red-600">
              <PlayerCircle isDay={isDay} socket={socket} gameCode={gameCode} players={players} gameStatus={gameStatus} />
            </div>
            <div className="mirror-effect bg-black/50 p-6 rounded-xl border-2 border-red-600">
              <SpectatorList spectators={spectators} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default GamePage;