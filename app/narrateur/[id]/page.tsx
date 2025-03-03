"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { GameState } from "@/types";

const GamePage: React.FC = () => {
  const param = useParams();
  const { id } = param as { id: string };
  const [game, setGame] = useState<GameState | null>(null);

  // Charge les détails de la partie
  useEffect(() => {
    if (id) {
      const fetchGame = async () => {
        const response = await fetch(`/api/game/${id}`);
        const data = await response.json();
        setGame(data);
      };

      fetchGame();
    }
  }, [id]);

  if (!game) {
    return <div className="p-8 text-white">Chargement...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-4xl font-bold mb-8">Gestion de la partie : {game.name}</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Section joueurs */}
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
          <h2 className="text-2xl font-semibold mb-4">Joueurs</h2>
          <ul>
            {game.players?.map((player) => (
              <li key={player.id} className="mb-2">
                <span className="font-medium">{player.name}</span> -{" "}
                <span className="text-gray-400">{player.role}</span> -{" "}
                <span className={player.isAlive ? "text-green-400" : "text-red-400"}>
                  {player.isAlive ? "Vivant" : "Mort"}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Section actions */}
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
          <h2 className="text-2xl font-semibold mb-4">Actions</h2>
          <div className="space-y-4">
            <button
              onClick={() => console.log("Lancer la partie")}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Lancer la partie
            </button>
            <button
              onClick={() => console.log("Interrompre la partie")}
              className="w-full px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
            >
              Interrompre la partie
            </button>
            <button
              onClick={() => console.log("Terminer la partie")}
              className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Terminer la partie
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GamePage;