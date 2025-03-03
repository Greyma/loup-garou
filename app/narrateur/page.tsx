"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { GameState } from "@/types";

const NarrateurPage: React.FC = () => {
  const [games, setGames] = useState<GameState[]>([]);
  const router = useRouter();

  useEffect(() => {
    const fetchGames = async () => {
      const response = await fetch("/api/game");
      const data = await response.json();
      setGames(data);
    };

    fetchGames();
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-4xl font-bold mb-8">Tableau de bord du narrateur</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {games.map((game) => (
          <div
            key={game.id}
            className="bg-gray-800 p-6 rounded-lg shadow-lg hover:shadow-xl transition-shadow"
          >
            <h2 className="text-2xl font-semibold">{game.name}</h2>
            <p className="text-gray-400">Statut : {game.phase}</p>
            <button
              onClick={() => router.push(`/narrateur/${game.id}`)}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Gérer cette partie
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={() => router.push("/narrateur/create")}
        className="mt-8 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
      >
        Créer une nouvelle partie
      </button>
    </div>
  );
};

export default NarrateurPage;