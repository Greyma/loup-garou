import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface Game {
  code: string;
  players: number;
  spectators: number;
  status: "waiting" | "in_progress";
}

const fetchGames = async (): Promise<Game[]> => {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "";
  const res = await fetch(`${backendUrl}/api/games`);
  if (!res.ok) {
    const errorData: { error: string } = await res.json();
    throw new Error(errorData.error || "Erreur lors de la récupération des parties");
  }
  return await res.json();
};

const GameList: React.FC = () => {
  const [games, setGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadGames = async () => {
      try {
        const fetchedGames = await fetchGames();
        setGames(fetchedGames);
        setIsLoading(false);
      } catch (err) {
        if (err instanceof Error) {
          console.error("Erreur lors du chargement des parties :", err);
          setError(err.message || "Impossible de charger les parties");
        } else {
          setError("Erreur inconnue");
        }
        setIsLoading(false);
      }
    };

    loadGames();
  }, []);

  if (isLoading) {
    return <div className="text-red-200 text-center py-10">Chargement des parties...</div>;
  }

  if (error) {
    return <div className="text-red-400 text-center py-10">Erreur : {error}</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <motion.h2
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-3xl font-bold text-red-500 text-center mb-6"
      >
        Parties Actuelles
      </motion.h2>
      {games.length === 0 ? (
        <p className="text-red-400 text-center">Aucune partie en cours pour le moment.</p>
      ) : (
        <motion.table
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="w-full bg-black/50 rounded-lg shadow-lg backdrop-blur-sm text-white border-2 border-red-600"
        >
          <thead>
            <tr className="bg-red-800/60">
              <th className="p-3 text-left">Code de la Partie</th>
              <th className="p-3 text-left">Joueurs</th>
              <th className="p-3 text-left">Spectateurs</th>
              <th className="p-3 text-left">Statut</th>
            </tr>
          </thead>
          <tbody>
            {games.map((game) => (
              <tr
                key={game.code}
                className="border-t border-red-600/50 hover:bg-red-800/20 transition-colors"
              >
                <td className="p-3 text-red-200">{game.code}</td>
                <td className="p-3 text-red-200">{game.players}</td>
                <td className="p-3 text-red-200">{game.spectators}</td>
                <td className="p-3">
                  <span
                    className={`px-3 py-1 rounded-full ${
                      game.status === "waiting" ? "bg-yellow-500/50" : "bg-green-500/50"
                    }`}
                  >
                    {game.status === "waiting" ? "En attente" : "En cours"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </motion.table>
      )}
    </div>
  );
};

export default GameList;