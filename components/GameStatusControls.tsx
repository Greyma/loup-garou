import React from "react";
import { Socket } from "socket.io-client";

interface GameStatusControlsProps {
  socket: Socket | null;
  gameCode: string;
  gameStatus: "in_progress" | "paused" | "stopped";
  isDay: boolean;
}

const GameStatusControls: React.FC<GameStatusControlsProps> = ({ socket, gameCode, gameStatus, isDay }) => {
  const handleStatusChange = (status: "in_progress" | "paused" | "stopped") => {
    if (socket) {
      socket.emit("update_game_status", { roomCode: gameCode, status });
    }
  };

  const toggleDayNight = () => {
    if (socket) {
      socket.emit("set_day_night", { roomCode: gameCode, isDay: !isDay });
    }
  };

  return (
    <div className="flex justify-center gap-4 mb-6">
      <button
        onClick={() => handleStatusChange("in_progress")}
        className={`p-2 rounded ${gameStatus === "in_progress" ? "bg-green-600" : "bg-gray-600"} hover:bg-green-700`}
      >
        En cours
      </button>
      <button
        onClick={() => handleStatusChange("paused")}
        className={`p-2 rounded ${gameStatus === "paused" ? "bg-yellow-600" : "bg-gray-600"} hover:bg-yellow-700`}
      >
        Pause
      </button>
      <button
        onClick={() => handleStatusChange("stopped")}
        className={`p-2 rounded ${gameStatus === "stopped" ? "bg-red-600" : "bg-gray-600"} hover:bg-red-700`}
      >
        Arrêter
      </button>
      <button
        onClick={toggleDayNight}
        className={`p-2 rounded ${isDay ? "bg-blue-600" : "bg-gray-800"} hover:bg-blue-700`}
      >
        {isDay ? "Passer à la nuit" : "Passer au jour"}
      </button>
    </div>
  );
};

export default GameStatusControls;